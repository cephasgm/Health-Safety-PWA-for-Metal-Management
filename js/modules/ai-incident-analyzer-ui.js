/* ═══════════════════════════════════════════════════════════════
   ai-incident-analyzer-ui.js
   ═══════════════════════════════════════════════════════════════

   Wires the "Analyze with AI" button in the incident report modal
   to window.mmsAI.analyzeImage().

   Behaviour:
     - Button appears once a photo is attached to the incident form
     - Click → shows loading → shows result panel or error
     - "Apply to Form" prefills severity + description + controls
     - "Re-analyze" resets and lets user retry

   Depends on:
     - window.mmsAI from ai-incident-analyzer.js
     - #incidentFileInput, #incidentFilesList
     - #aiAnalysisPanel, #aiAnalyzeBtnArea, #aiAnalyzeLoading,
       #aiAnalyzeError, #aiAnalyzeResult (already in dashboard.html)
   ═══════════════════════════════════════════════════════════════ */

let incidentFiles = [];

function escapeHtml(s) {
    return String(s == null ? '' : s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// ─── Show / hide the AI panel based on selected files ───
function refreshAiPanelVisibility() {
    const panel = document.getElementById('aiAnalysisPanel');
    if (!panel) return;

    const hasImage = incidentFiles.some((f) => f.type && f.type.startsWith('image/'));
    panel.style.display = hasImage ? 'block' : 'none';

    if (!hasImage) {
        // Reset inner states
        const loading = document.getElementById('aiAnalyzeLoading');
        const errEl   = document.getElementById('aiAnalyzeError');
        const resEl   = document.getElementById('aiAnalyzeResult');
        const btnArea = document.getElementById('aiAnalyzeBtnArea');
        if (loading) loading.style.display = 'none';
        if (errEl)   errEl.style.display = 'none';
        if (resEl)   resEl.style.display = 'none';
        if (btnArea) btnArea.style.display = 'block';
    }
}

// ─── Hook into the existing incident file input ───
function attachFileInputListener() {
    const input = document.getElementById('incidentFileInput');
    if (!input) return;

    // Prevent double-binding across modal reopens
    if (input.dataset.aiBound === '1') return;
    input.dataset.aiBound = '1';

    input.addEventListener('change', (e) => {
        incidentFiles = Array.from(e.target.files || []);

        // Render file list (basic — app.js may also handle this)
        const list = document.getElementById('incidentFilesList');
        if (list) {
            list.innerHTML = incidentFiles.map((f) => `
                <div class="file-item">
                    <div style="display: flex; align-items: center; gap: 0.5rem; min-width: 0;">
                        <span>${f.type.startsWith('image/') ? '🖼️' : '📎'}</span>
                        <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(f.name)}</span>
                        <span style="color: #94a3b8; font-size: 0.75rem;">${(f.size / 1024).toFixed(0)} KB</span>
                    </div>
                </div>
            `).join('');
        }

        refreshAiPanelVisibility();
    });
}

// ═══════════════════════════════════════════════════════════════
// ANALYZE BUTTON
// ═══════════════════════════════════════════════════════════════

window.__aiAnalyzeIncident = async function () {
    const imageFile = incidentFiles.find((f) => f.type && f.type.startsWith('image/'));
    if (!imageFile) return;

    if (!window.mmsAI || !window.mmsAI.isReady()) {
        showError('AI module not ready. Please reload the page.');
        return;
    }

    // UI states
    document.getElementById('aiAnalyzeBtnArea').style.display = 'none';
    document.getElementById('aiAnalyzeError').style.display = 'none';
    document.getElementById('aiAnalyzeResult').style.display = 'none';
    document.getElementById('aiAnalyzeLoading').style.display = 'block';

    // Site context — from the currently-selected incident location
    const locationEl = document.getElementById('incidentLocation');
    const siteContext = locationEl && locationEl.value ? 'Site: ' + locationEl.value : '';

    try {
        const analysis = await window.mmsAI.analyzeImage(imageFile, siteContext);
        renderAnalysis(analysis);
    } catch (err) {
        console.error('[ai-ui] Analysis failed:', err);
        showError(err.message || 'Analysis failed.');
    }
};

function showError(msg) {
    document.getElementById('aiAnalyzeLoading').style.display = 'none';
    const errEl = document.getElementById('aiAnalyzeError');
    errEl.textContent = '⚠️ ' + msg;
    errEl.style.display = 'block';
    document.getElementById('aiAnalyzeBtnArea').style.display = 'block';
}

// ═══════════════════════════════════════════════════════════════
// RESULT PANEL
// ═══════════════════════════════════════════════════════════════

function renderAnalysis(a) {
    document.getElementById('aiAnalyzeLoading').style.display = 'none';
    document.getElementById('aiAnalyzeBtnArea').style.display = 'none';

    const severityColors = {
        'Low':      { bg: '#ecfdf5', fg: '#065f46', border: '#a7f3d0' },
        'Medium':   { bg: '#fffbeb', fg: '#92400e', border: '#fde68a' },
        'High':     { bg: '#fff7ed', fg: '#9a3412', border: '#fed7aa' },
        'Critical': { bg: '#fef2f2', fg: '#991b1b', border: '#fecaca' }
    };
    const colors = severityColors[a.risk_severity] || severityColors.Medium;

    const c = a.recommended_controls || {};
    const controlRows = [
        ['1. Elimination',    c.elimination],
        ['2. Substitution',   c.substitution],
        ['3. Engineering',    c.engineering],
        ['4. Administrative', c.administrative],
        ['5. PPE',            c.ppe]
    ].filter(([, v]) => v && v !== 'Not applicable');

    const immediateActions = (a.immediate_actions || []).map((x) => `<li>${escapeHtml(x)}</li>`).join('');

    document.getElementById('aiAnalyzeResult').innerHTML = `
        <div style="padding: 1.25rem; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px;">
            <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 1rem;">
                <span style="font-size: 1.25rem;">🤖</span>
                <div style="font-weight: 700; color: #0f172a;">AI Analysis</div>
                <span style="font-size: 0.72rem; color: #64748b; margin-left: auto;">Confidence: ${escapeHtml(a.confidence || '—')}</span>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; margin-bottom: 1rem;">
                <div style="padding: 0.75rem; background: #ffffff; border-radius: 8px; border: 1px solid #e2e8f0;">
                    <div style="font-size: 0.68rem; color: #64748b; text-transform: uppercase; letter-spacing: 0.4px; font-weight: 700;">Hazard Type</div>
                    <div style="font-weight: 600; color: #0f172a; margin-top: 0.15rem;">${escapeHtml(a.hazard_type || '—')}</div>
                </div>
                <div style="padding: 0.75rem; background: ${colors.bg}; border-radius: 8px; border: 1px solid ${colors.border};">
                    <div style="font-size: 0.68rem; color: ${colors.fg}; text-transform: uppercase; letter-spacing: 0.4px; font-weight: 700;">Severity</div>
                    <div style="font-weight: 700; color: ${colors.fg}; margin-top: 0.15rem;">${escapeHtml(a.risk_severity || '—')} (${a.risk_score_estimate || '?'}/25)</div>
                </div>
            </div>

            <div style="margin-bottom: 1rem;">
                <div style="font-size: 0.68rem; color: #64748b; text-transform: uppercase; letter-spacing: 0.4px; font-weight: 700; margin-bottom: 0.35rem;">Description</div>
                <div style="font-size: 0.88rem; color: #334155; line-height: 1.55;">${escapeHtml(a.description || '—')}</div>
            </div>

            ${controlRows.length ? `
                <div style="margin-bottom: 1rem;">
                    <div style="font-size: 0.68rem; color: #64748b; text-transform: uppercase; letter-spacing: 0.4px; font-weight: 700; margin-bottom: 0.35rem;">Recommended Controls</div>
                    ${controlRows.map(([label, value]) => `
                        <div style="margin-bottom: 0.5rem; padding: 0.5rem 0.75rem; background: #ffffff; border-radius: 6px; border-left: 3px solid #dc2626;">
                            <div style="font-size: 0.75rem; font-weight: 700; color: #0f172a;">${label}</div>
                            <div style="font-size: 0.82rem; color: #475569; margin-top: 0.15rem;">${escapeHtml(value)}</div>
                        </div>
                    `).join('')}
                </div>
            ` : ''}

            ${immediateActions ? `
                <div style="margin-bottom: 1rem;">
                    <div style="font-size: 0.68rem; color: #64748b; text-transform: uppercase; letter-spacing: 0.4px; font-weight: 700; margin-bottom: 0.35rem;">Immediate Actions</div>
                    <ul style="margin: 0; padding-left: 1.25rem; font-size: 0.85rem; color: #334155; line-height: 1.65;">${immediateActions}</ul>
                </div>
            ` : ''}

            <div style="font-size: 0.72rem; color: #64748b; margin-bottom: 0.75rem;">
                ISO 45001 reference: <code style="background: #eff6ff; color: #1e40af; padding: 0.1rem 0.4rem; border-radius: 4px;">${escapeHtml(a.iso_45001_clause || '6.1.2')}</code>
            </div>

            <div style="display: flex; gap: 0.5rem;">
                <button type="button" class="btn btn-outline btn-sm" onclick="window.__aiApplyToForm()" style="flex: 1;">Apply to Form</button>
                <button type="button" class="btn btn-outline btn-sm" onclick="window.__aiReset()" style="flex: 1;">Re-analyze</button>
            </div>
        </div>
    `;

    document.getElementById('aiAnalyzeResult').style.display = 'block';
    window.__aiLastAnalysis = a;
}

// ═══════════════════════════════════════════════════════════════
// APPLY TO FORM
// ═══════════════════════════════════════════════════════════════

window.__aiApplyToForm = function (event) {
    const a = window.__aiLastAnalysis;
    if (!a) return;

    const severityMap = {
        'Low': 'Minor',
        'Medium': 'Moderate',
        'High': 'Serious',
        'Critical': 'Critical'
    };

    const sevEl = document.getElementById('incidentSeverity');
    if (sevEl && severityMap[a.risk_severity]) sevEl.value = severityMap[a.risk_severity];

    const descEl = document.getElementById('incidentDescription');
    if (descEl && !descEl.value.includes('[AI Analysis]')) {
        const block = `\n\n[AI Analysis]\nHazard: ${a.hazard_type || '—'}\nSeverity: ${a.risk_severity || '—'} (${a.risk_score_estimate || '?'}/25)\n\n${a.description || ''}`;
        descEl.value = (descEl.value || '').trim() + block;
    }

    const recEl = document.getElementById('recommendations');
    if (recEl && a.recommended_controls && !recEl.value.includes('AI-recommended controls')) {
        const c = a.recommended_controls;
        const lines = [
            'AI-recommended controls:',
            c.elimination && c.elimination !== 'Not applicable' ? `• Elimination: ${c.elimination}` : '',
            c.substitution && c.substitution !== 'Not applicable' ? `• Substitution: ${c.substitution}` : '',
            c.engineering && c.engineering !== 'Not applicable' ? `• Engineering: ${c.engineering}` : '',
            c.administrative && c.administrative !== 'Not applicable' ? `• Administrative: ${c.administrative}` : '',
            c.ppe && c.ppe !== 'Not applicable' ? `• PPE: ${c.ppe}` : ''
        ].filter(Boolean).join('\n');
        recEl.value = (recEl.value || '').trim() + (recEl.value ? '\n\n' : '') + lines;
    }

    const btn = event && event.target;
    if (btn) {
        const original = btn.textContent;
        btn.textContent = '✓ Applied';
        btn.disabled = true;
        setTimeout(() => { btn.textContent = original; btn.disabled = false; }, 1800);
    }
};

window.__aiReset = function () {
    document.getElementById('aiAnalyzeResult').style.display = 'none';
    document.getElementById('aiAnalyzeError').style.display = 'none';
    document.getElementById('aiAnalyzeBtnArea').style.display = 'block';
    window.__aiLastAnalysis = null;
};

// ═══════════════════════════════════════════════════════════════
// BOOTSTRAP
// ═══════════════════════════════════════════════════════════════

function bootstrap() {
    attachFileInputListener();

    // Re-bind whenever the incident modal opens (in case DOM is replaced)
    const modal = document.getElementById('reportIncidentModal');
    if (modal) {
        const observer = new MutationObserver(() => {
            if (modal.classList.contains('show')) {
                setTimeout(attachFileInputListener, 50);
            }
        });
        observer.observe(modal, { attributes: true, attributeFilter: ['class'] });
    }

    console.log('[ai-incident-analyzer-ui] Ready');
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrap);
} else {
    bootstrap();
}