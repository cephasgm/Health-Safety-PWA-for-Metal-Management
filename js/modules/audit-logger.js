/* ═══════════════════════════════════════════════════════════════
   audit-logger.js
   ISO 45001:2018 Clause 9.2 — Internal Audit
   ISO 45001:2018 Clause 10.2 — Nonconformity & corrective action
   (spawns corrective actions via window.complianceManager)

   Features:
     - Audit register (CRUD, real Firestore)
     - Audit types: Internal / External / Regulatory / Contractor / Supplier
     - Clause-mapped findings (Major NC, Minor NC, OFI, Positive)
     - Status workflow: Planned → In Progress → Completed
     - One-click "Create Corrective Action" from any NC finding
     - Filter by status and type
     - Zero mock data. Empty state when nothing exists.

   Firestore collections:
     - audits  (this module)
     - corrective_actions  (written via compliance-manager.js)

   Auto-binds to #auditModal in dashboard.html.
   ═══════════════════════════════════════════════════════════════ */

import { db } from '../core/firebase-config.js';
import {
    collection,
    doc,
    setDoc,
    getDocs,
    deleteDoc,
    query,
    orderBy,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";

// ═══════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════

const AUDIT_TYPES = [
    'Internal',
    'External',
    'Regulatory',
    'Contractor',
    'Supplier'
];

const AUDIT_STATUSES = [
    'Planned',
    'In Progress',
    'Completed',
    'Cancelled'
];

const FINDING_CLASSIFICATIONS = [
    { key: 'Major NC', label: 'Major Nonconformity', color: '#dc2626', cls: 'status-noncompliant' },
    { key: 'Minor NC', label: 'Minor Nonconformity', color: '#f59e0b', cls: 'status-pending' },
    { key: 'OFI',      label: 'Opportunity for Improvement', color: '#1e40af', cls: 'status-inprogress' },
    { key: 'Positive', label: 'Positive Observation', color: '#10b981', cls: 'status-compliant' }
];

// Common ISO 45001 clauses for quick reference in finding form
const ISO_CLAUSES = [
    '4.1 Context', '4.2 Interested parties', '4.3 Scope', '4.4 System',
    '5.1 Leadership', '5.2 Policy', '5.3 Roles', '5.4 Participation',
    '6.1.1 General', '6.1.2 Hazards', '6.1.3 Legal', '6.1.4 Planning', '6.2 Objectives',
    '7.1 Resources', '7.2 Competence', '7.3 Awareness', '7.4 Communication', '7.5 Documents',
    '8.1.1 Ops planning', '8.1.2 Hierarchy of controls', '8.1.3 MOC', '8.1.4 Procurement',
    '8.2 Emergency', '8.1 Incidents',
    '9.1.1 Monitoring', '9.1.2 Compliance', '9.2 Internal audit', '9.3 Management review',
    '10.1 General', '10.2 Corrective action', '10.3 Continual improvement'
];

const AUDIT_LOCATIONS = [
    'Cape Town HQ', 'Cosco Durban', 'AGL Durban',
    'Impala Dar', 'Polytra Dar', 'Access Dar',
    'WBCT Bulk Shed', 'WBCT Quay Side Shed', 'Bridge Walvis Bay', 'Pindulo Walvis Bay',
    'Reload Giga Terminal', 'AGL Chingola Hub', 'Polytra Kitwe', 'Impala Ndola',
    'SLS Ndola', 'Poseidon Zambia', 'Polytra Kapiri Mposhi'
];

// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════

function escapeHtml(s) {
    return String(s == null ? '' : s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function isAdmin() {
    return !!(window.mmsCurrentUser && window.mmsCurrentUser.isAdmin);
}

function isSignedIn() {
    return !!(window.mmsCurrentUser);
}

function statusChip(status) {
    const cls =
        status === 'Completed'    ? 'status-compliant' :
        status === 'In Progress'  ? 'status-inprogress' :
        status === 'Planned'      ? 'status-pending' :
        status === 'Cancelled'    ? 'status-noncompliant' :
                                    'status-pending';
    return `<span class="standard-status ${cls}">${escapeHtml(status || '—')}</span>`;
}

function findingBadge(classification) {
    const meta = FINDING_CLASSIFICATIONS.find(c => c.key === classification);
    if (!meta) return `<span class="standard-status">${escapeHtml(classification)}</span>`;
    return `<span class="standard-status ${meta.cls}">${escapeHtml(meta.key)}</span>`;
}

function countFindingsByType(findings, type) {
    return (findings || []).filter(f => f.classification === type).length;
}

function openNcCount(findings) {
    return (findings || []).filter(
        f => (f.classification === 'Major NC' || f.classification === 'Minor NC')
            && !f.corrective_action_id
    ).length;
}

// ═══════════════════════════════════════════════════════════════
// MANAGER
// ═══════════════════════════════════════════════════════════════

class AuditManager {
    constructor() {
        this.COLLECTION = 'audits';
    }

    async list() {
        const q = query(collection(db, this.COLLECTION), orderBy('created_at', 'desc'));
        const snap = await getDocs(q);
        const items = [];
        snap.forEach(d => items.push({ id: d.id, ...d.data() }));
        return items;
    }

    async create(data) {
        const id = 'AUD-' + Date.now();
        const record = {
            id,
            title: data.title || 'Untitled audit',
            type: data.type || 'Internal',
            scope: data.scope || '',
            criteria: data.criteria || '',
            location: data.location || '',
            lead_auditor: data.lead_auditor || (window.mmsCurrentUser?.email || ''),
            auditee: data.auditee || '',
            planned_date: data.planned_date || '',
            completed_date: data.completed_date || '',
            status: data.status || 'Planned',
            summary: data.summary || '',
            findings: data.findings || [],
            created_at: serverTimestamp(),
            created_by: window.mmsCurrentUser?.email || 'unknown',
            updated_at: serverTimestamp()
        };
        await setDoc(doc(db, this.COLLECTION, id), record);
        return { success: true, audit: record };
    }

    async update(id, data) {
        const patch = {
            title: data.title || 'Untitled audit',
            type: data.type || 'Internal',
            scope: data.scope || '',
            criteria: data.criteria || '',
            location: data.location || '',
            lead_auditor: data.lead_auditor || '',
            auditee: data.auditee || '',
            planned_date: data.planned_date || '',
            completed_date: data.completed_date || '',
            status: data.status || 'Planned',
            summary: data.summary || '',
            findings: data.findings || [],
            updated_at: serverTimestamp(),
            updated_by: window.mmsCurrentUser?.email || 'unknown'
        };
        await setDoc(doc(db, this.COLLECTION, id), patch, { merge: true });
        return { success: true };
    }

    async remove(id) {
        await deleteDoc(doc(db, this.COLLECTION, id));
        return { success: true };
    }
}

const auditManager = new AuditManager();

// ═══════════════════════════════════════════════════════════════
// STATE
// ═══════════════════════════════════════════════════════════════

let currentView = 'list';     // 'list' | 'detail' | 'form'
let currentTab = 'records';   // 'records' | 'schedule'
let currentAuditId = null;
let cachedAudits = [];
let filterStatus = '';
let filterType = '';

// Draft findings when editing an audit (persist across re-renders within the form)
let draftFindings = [];

// ═══════════════════════════════════════════════════════════════
// RENDER — replaces the whole #auditModal .modal-content
// ═══════════════════════════════════════════════════════════════

async function renderAuditModule() {
    const modal = document.getElementById('auditModal');
    if (!modal) return;

    const content = modal.querySelector('.modal-content');
    if (!content) return;

    if (!isSignedIn()) {
        content.innerHTML = `
            <button class="close-modal" onclick="closeModal('auditModal')">×</button>
            <div style="padding:3rem; text-align:center; color:#64748b;">Sign in to access audits.</div>
        `;
        return;
    }

    // Show loading state once
    if (currentView === 'list' && cachedAudits.length === 0) {
        content.innerHTML = `
            <button class="close-modal" onclick="closeModal('auditModal')">×</button>
            <div style="padding:3rem; text-align:center; color:#64748b;">Loading…</div>
        `;
    }

    try {
        cachedAudits = await auditManager.list();
    } catch (err) {
        console.error('[audit] Load failed:', err);
        content.innerHTML = `
            <button class="close-modal" onclick="closeModal('auditModal')">×</button>
            <div style="padding:3rem; text-align:center; color:#991b1b;">
                <div style="font-size:2.5rem; margin-bottom:0.5rem;">⚠️</div>
                <div style="font-weight:600;">Could not load audits</div>
                <div style="font-size:0.85rem; margin-top:0.35rem;">${escapeHtml(err.code || err.message)}</div>
            </div>
        `;
        return;
    }

    if (currentView === 'list')   return renderListView(content);
    if (currentView === 'detail') return renderDetailView(content);
    if (currentView === 'form')   return renderFormView(content);
}

function renderListView(content) {
    const all = cachedAudits;

    // Split: records vs schedule
    const records = all.filter(a => a.status === 'Completed' || a.status === 'In Progress' || a.status === 'Cancelled');
    const scheduled = all.filter(a => a.status === 'Planned');

    const total = all.length;
    const completed = all.filter(a => a.status === 'Completed').length;
    const ncOpen = all.reduce((sum, a) => sum + openNcCount(a.findings), 0);
    const withFindings = all.filter(a => (a.findings || []).length > 0).length;

    const statsHtml = `
        <div style="display:grid; grid-template-columns:repeat(auto-fit,minmax(150px,1fr)); gap:0.75rem; margin-bottom:1.25rem;">
            <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:12px; padding:1rem 1.15rem;">
                <div style="font-size:1.6rem; font-weight:800; color:#0f172a; line-height:1;">${total}</div>
                <div style="font-size:0.72rem; color:#64748b; text-transform:uppercase; letter-spacing:0.4px; margin-top:0.35rem; font-weight:600;">Total Audits</div>
            </div>
            <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:12px; padding:1rem 1.15rem;">
                <div style="font-size:1.6rem; font-weight:800; color:#0f172a; line-height:1;">${completed}</div>
                <div style="font-size:0.72rem; color:#64748b; text-transform:uppercase; letter-spacing:0.4px; margin-top:0.35rem; font-weight:600;">Completed</div>
            </div>
            <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:12px; padding:1rem 1.15rem;">
                <div style="font-size:1.6rem; font-weight:800; color:${ncOpen > 0 ? '#dc2626' : '#0f172a'}; line-height:1;">${ncOpen}</div>
                <div style="font-size:0.72rem; color:#64748b; text-transform:uppercase; letter-spacing:0.4px; margin-top:0.35rem; font-weight:600;">Open NCs</div>
            </div>
            <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:12px; padding:1rem 1.15rem;">
                <div style="font-size:1.6rem; font-weight:800; color:#0f172a; line-height:1;">${withFindings}</div>
                <div style="font-size:0.72rem; color:#64748b; text-transform:uppercase; letter-spacing:0.4px; margin-top:0.35rem; font-weight:600;">Audits with Findings</div>
            </div>
        </div>
    `;

    const tabsHtml = `
        <div class="tab-buttons" style="margin-bottom:1.25rem;">
            <button class="tab-button ${currentTab === 'records' ? 'active' : ''}"
                    onclick="window.__auditSetTab('records')">Audit Records (${records.length})</button>
            <button class="tab-button ${currentTab === 'schedule' ? 'active' : ''}"
                    onclick="window.__auditSetTab('schedule')">Schedule (${scheduled.length})</button>
        </div>
    `;

    const headerHtml = `
        <div style="display:flex; justify-content:space-between; align-items:center; gap:1rem; margin-bottom:1rem; flex-wrap:wrap;">
            <div>
                <div style="font-weight:700; font-size:0.95rem;">Internal Audit Register</div>
                <div style="font-size:0.78rem; color:#64748b; margin-top:0.15rem;">ISO 45001 Clause 9.2 — audits and their findings</div>
            </div>
            <button class="btn btn-primary" onclick="window.__auditNew()">+ New Audit</button>
        </div>
    `;

    const filterHtml = `
        <div style="display:flex; gap:0.6rem; flex-wrap:wrap; margin-bottom:1rem;">
            <select onchange="window.__auditSetType(this.value)" style="padding:0.45rem 0.75rem; border:1px solid #e2e8f0; border-radius:8px; font-size:0.82rem; font-family:inherit;">
                <option value="">All Types</option>
                ${AUDIT_TYPES.map(t => `<option value="${t}" ${filterType === t ? 'selected' : ''}>${t}</option>`).join('')}
            </select>
            ${(filterType) ? `<button class="btn btn-outline btn-sm" onclick="window.__auditClearFilters()">Clear filters</button>` : ''}
        </div>
    `;

    // Filter records by type
    const filteredRecords = records.filter(a => !filterType || a.type === filterType);
    const filteredSchedule = scheduled.filter(a => !filterType || a.type === filterType);

    if (currentTab === 'records') {
        if (records.length === 0) {
            content.innerHTML = `
                <button class="close-modal" onclick="closeModal('auditModal')">×</button>
                <div class="modal-header"><h2>Audit & Inspection Management</h2><p>ISO 45001 Clause 9.2 — Internal audit</p></div>
                ${statsHtml}${tabsHtml}${headerHtml}
                <div style="text-align:center; padding:3rem 1rem; color:#64748b; border:1px dashed #cbd5e1; border-radius:12px;">
                    <div style="font-size:3rem; margin-bottom:0.75rem;">🔍</div>
                    <div style="font-weight:600; color:#0f172a; margin-bottom:0.35rem;">No completed or in-progress audits</div>
                    <div style="font-size:0.9rem; max-width:440px; margin:0 auto;">Create an audit to document scope, findings, and nonconformities. Completed audits show their findings and linked corrective actions.</div>
                    <button class="btn btn-primary" style="margin-top:1.25rem;" onclick="window.__auditNew()">+ Create Audit</button>
                </div>
            `;
            return;
        }

        const rows = filteredRecords.map(a => {
            const nc = countFindingsByType(a.findings, 'Major NC') + countFindingsByType(a.findings, 'Minor NC');
            const ofi = countFindingsByType(a.findings, 'OFI');
            const pos = countFindingsByType(a.findings, 'Positive');
            return `<tr style="cursor:pointer;" onclick="window.__auditOpen('${escapeHtml(a.id)}')">
                <td style="font-family:monospace; font-size:0.72rem;">${escapeHtml(a.id)}</td>
                <td>
                    <div style="font-weight:600;">${escapeHtml(a.title)}</div>
                    <div style="font-size:0.72rem; color:#94a3b8;">${escapeHtml(a.type)} · ${escapeHtml(a.location || '—')}</div>
                </td>
                <td style="font-size:0.82rem;">${escapeHtml(a.lead_auditor || '—')}</td>
                <td style="font-size:0.78rem;">${escapeHtml(a.planned_date || '—')}</td>
                <td style="text-align:center;">
                    ${nc > 0 ? `<span style="font-weight:700; color:#dc2626;">${nc}</span>` : '<span style="color:#94a3b8;">0</span>'}
                    ${ofi > 0 ? `<span style="font-size:0.72rem; color:#1e40af; margin-left:0.35rem;">+${ofi} OFI</span>` : ''}
                    ${pos > 0 ? `<span style="font-size:0.72rem; color:#10b981; margin-left:0.35rem;">+${pos} ✓</span>` : ''}
                </td>
                <td>${statusChip(a.status)}</td>
            </tr>`;
        }).join('');

        content.innerHTML = `
            <button class="close-modal" onclick="closeModal('auditModal')">×</button>
            <div class="modal-header"><h2>Audit & Inspection Management</h2><p>ISO 45001 Clause 9.2 — Internal audit</p></div>
            ${statsHtml}${tabsHtml}${headerHtml}${filterHtml}
            <div style="overflow-x:auto;">
                <table class="data-table">
                    <thead><tr>
                        <th>ID</th><th>Audit</th><th>Lead Auditor</th><th>Date</th><th>Findings</th><th>Status</th>
                    </tr></thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>
        `;
        return;
    }

    // Schedule tab
    if (scheduled.length === 0) {
        content.innerHTML = `
            <button class="close-modal" onclick="closeModal('auditModal')">×</button>
            <div class="modal-header"><h2>Audit & Inspection Management</h2><p>ISO 45001 Clause 9.2 — Internal audit</p></div>
            ${statsHtml}${tabsHtml}${headerHtml}
            <div style="text-align:center; padding:3rem 1rem; color:#64748b; border:1px dashed #cbd5e1; border-radius:12px;">
                <div style="font-size:3rem; margin-bottom:0.75rem;">📅</div>
                <div style="font-weight:600; color:#0f172a; margin-bottom:0.35rem;">No audits scheduled</div>
                <div style="font-size:0.9rem; max-width:440px; margin:0 auto;">Plan upcoming internal audits so they don't slip. Planned audits move to Records once they begin.</div>
                <button class="btn btn-primary" style="margin-top:1.25rem;" onclick="window.__auditNew()">+ Schedule Audit</button>
            </div>
        `;
        return;
    }

    const schedRows = filteredSchedule.map(a => `
        <tr style="cursor:pointer;" onclick="window.__auditOpen('${escapeHtml(a.id)}')">
            <td style="font-family:monospace; font-size:0.72rem;">${escapeHtml(a.id)}</td>
            <td>
                <div style="font-weight:600;">${escapeHtml(a.title)}</div>
                <div style="font-size:0.72rem; color:#94a3b8;">${escapeHtml(a.type)} · ${escapeHtml(a.location || '—')}</div>
            </td>
            <td style="font-size:0.82rem;">${escapeHtml(a.lead_auditor || '—')}</td>
            <td style="font-size:0.82rem;">${escapeHtml(a.planned_date || '—')}</td>
            <td>${statusChip(a.status)}</td>
        </tr>
    `).join('');

    content.innerHTML = `
        <button class="close-modal" onclick="closeModal('auditModal')">×</button>
        <div class="modal-header"><h2>Audit & Inspection Management</h2><p>ISO 45001 Clause 9.2 — Internal audit</p></div>
        ${statsHtml}${tabsHtml}${headerHtml}${filterHtml}
        <div style="overflow-x:auto;">
            <table class="data-table">
                <thead><tr>
                    <th>ID</th><th>Audit</th><th>Lead Auditor</th><th>Planned Date</th><th>Status</th>
                </tr></thead>
                <tbody>${schedRows}</tbody>
            </table>
        </div>
    `;
}

function renderDetailView(content) {
    const a = cachedAudits.find(x => x.id === currentAuditId);
    if (!a) {
        currentView = 'list';
        return renderAuditModule();
    }

    const majorNc = countFindingsByType(a.findings, 'Major NC');
    const minorNc = countFindingsByType(a.findings, 'Minor NC');
    const ofi = countFindingsByType(a.findings, 'OFI');
    const positive = countFindingsByType(a.findings, 'Positive');

    const findingsHtml = (a.findings && a.findings.length > 0)
        ? a.findings.map(f => {
            const meta = FINDING_CLASSIFICATIONS.find(c => c.key === f.classification);
            const isNc = f.classification === 'Major NC' || f.classification === 'Minor NC';
            const linked = !!f.corrective_action_id;
            return `
                <div style="margin-bottom:0.85rem; padding:0.95rem 1.15rem; background:#f8fafc; border-radius:10px; border-left:3px solid ${meta ? meta.color : '#94a3b8'};">
                    <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:0.75rem; flex-wrap:wrap; margin-bottom:0.4rem;">
                        <div style="display:flex; gap:0.5rem; align-items:center; flex-wrap:wrap;">
                            ${findingBadge(f.classification)}
                            ${f.clause ? `<span style="font-size:0.72rem; font-family:monospace; color:#64748b; padding:0.15rem 0.5rem; background:#fff; border:1px solid #e2e8f0; border-radius:6px;">${escapeHtml(f.clause)}</span>` : ''}
                        </div>
                        ${isNc && !linked ? `
                            <button class="btn btn-primary btn-sm" onclick="window.__auditCreateCA('${escapeHtml(a.id)}', '${escapeHtml(f.id)}')">
                                → Create Corrective Action
                            </button>
                        ` : ''}
                        ${linked ? `<span style="font-size:0.72rem; color:#059669; font-weight:600;">✓ Linked to ${escapeHtml(f.corrective_action_id)}</span>` : ''}
                    </div>
                    <div style="font-size:0.88rem; color:#334155; line-height:1.6; white-space:pre-wrap;">${escapeHtml(f.description || '')}</div>
                    ${f.evidence ? `<div style="font-size:0.78rem; color:#64748b; margin-top:0.5rem; padding-top:0.5rem; border-top:1px solid #e2e8f0;"><strong>Evidence:</strong> ${escapeHtml(f.evidence)}</div>` : ''}
                </div>
            `;
        }).join('')
        : '<div style="color:#94a3b8; font-size:0.85rem; padding:1rem 0;">No findings recorded for this audit.</div>';

    content.innerHTML = `
        <button class="close-modal" onclick="closeModal('auditModal')">×</button>
        <div style="display:flex; justify-content:space-between; align-items:center; gap:1rem; margin-bottom:1.25rem; flex-wrap:wrap;">
            <button class="btn btn-outline btn-sm" onclick="window.__auditBackToList()">← Back to Register</button>
            <div style="display:flex; gap:0.5rem;">
                <button class="btn btn-outline btn-sm" onclick="window.__auditEdit('${escapeHtml(a.id)}')">✏️ Edit</button>
                ${isAdmin() ? `<button class="btn btn-danger btn-sm" onclick="window.__auditDelete('${escapeHtml(a.id)}')">🗑️ Delete</button>` : ''}
            </div>
        </div>

        <div style="font-family:monospace; font-size:0.75rem; color:#94a3b8; margin-bottom:0.25rem;">${escapeHtml(a.id)}</div>
        <h3 style="font-size:1.25rem; font-weight:700; color:#0f172a; margin-bottom:0.75rem;">${escapeHtml(a.title)}</h3>

        <div style="display:flex; gap:0.75rem; flex-wrap:wrap; font-size:0.82rem; color:#64748b; margin-bottom:1.25rem;">
            ${a.type ? `<span>🏷️ ${escapeHtml(a.type)}</span>` : ''}
            ${a.location ? `<span>📍 ${escapeHtml(a.location)}</span>` : ''}
            ${a.planned_date ? `<span>📅 ${escapeHtml(a.planned_date)}</span>` : ''}
            ${statusChip(a.status)}
        </div>

        <div style="display:grid; grid-template-columns:repeat(auto-fit,minmax(140px,1fr)); gap:0.75rem; margin-bottom:1.5rem;">
            <div style="padding:0.85rem 1rem; background:#fef2f2; border-radius:10px;">
                <div style="font-size:1.35rem; font-weight:800; color:#991b1b; line-height:1;">${majorNc}</div>
                <div style="font-size:0.72rem; color:#991b1b; margin-top:0.25rem; font-weight:600;">Major NC</div>
            </div>
            <div style="padding:0.85rem 1rem; background:#fffbeb; border-radius:10px;">
                <div style="font-size:1.35rem; font-weight:800; color:#92400e; line-height:1;">${minorNc}</div>
                <div style="font-size:0.72rem; color:#92400e; margin-top:0.25rem; font-weight:600;">Minor NC</div>
            </div>
            <div style="padding:0.85rem 1rem; background:#eff6ff; border-radius:10px;">
                <div style="font-size:1.35rem; font-weight:800; color:#1e40af; line-height:1;">${ofi}</div>
                <div style="font-size:0.72rem; color:#1e40af; margin-top:0.25rem; font-weight:600;">OFI</div>
            </div>
            <div style="padding:0.85rem 1rem; background:#ecfdf5; border-radius:10px;">
                <div style="font-size:1.35rem; font-weight:800; color:#065f46; line-height:1;">${positive}</div>
                <div style="font-size:0.72rem; color:#065f46; margin-top:0.25rem; font-weight:600;">Positive</div>
            </div>
        </div>

        <div style="display:grid; gap:0.5rem; margin-bottom:1.5rem; font-size:0.85rem; color:#64748b;">
            ${a.scope ? `<div><strong style="color:#0f172a;">Scope:</strong> ${escapeHtml(a.scope)}</div>` : ''}
            ${a.criteria ? `<div><strong style="color:#0f172a;">Criteria:</strong> ${escapeHtml(a.criteria)}</div>` : ''}
            ${a.lead_auditor ? `<div><strong style="color:#0f172a;">Lead Auditor:</strong> ${escapeHtml(a.lead_auditor)}</div>` : ''}
            ${a.auditee ? `<div><strong style="color:#0f172a;">Auditee:</strong> ${escapeHtml(a.auditee)}</div>` : ''}
            ${a.completed_date ? `<div><strong style="color:#0f172a;">Completed:</strong> ${escapeHtml(a.completed_date)}</div>` : ''}
        </div>

        ${a.summary ? `
            <div style="margin-bottom:1.5rem;">
                <div style="font-size:0.72rem; text-transform:uppercase; letter-spacing:0.5px; color:#64748b; font-weight:700; margin-bottom:0.4rem;">Summary</div>
                <div style="font-size:0.9rem; color:#334155; line-height:1.6; white-space:pre-wrap;">${escapeHtml(a.summary)}</div>
            </div>
        ` : ''}

        <div style="font-size:0.72rem; text-transform:uppercase; letter-spacing:0.5px; color:#64748b; font-weight:700; margin-bottom:0.6rem;">
            Findings (${(a.findings || []).length})
        </div>
        ${findingsHtml}
    `;
}

function renderFormView(content) {
    const editing = !!currentAuditId;
    const a = editing ? (cachedAudits.find(x => x.id === currentAuditId) || {}) : {};

    // Load findings into draft on first entry
    if (editing && draftFindings.length === 0 && a.findings && a.findings.length > 0) {
        draftFindings = JSON.parse(JSON.stringify(a.findings));
    }

    const today = new Date().toISOString().slice(0, 10);

    content.innerHTML = `
        <button class="close-modal" onclick="closeModal('auditModal')">×</button>
        <div style="display:flex; justify-content:space-between; align-items:center; gap:1rem; margin-bottom:1.25rem; flex-wrap:wrap;">
            <button class="btn btn-outline btn-sm" onclick="window.__auditBackToList()">← Back</button>
            <div style="font-weight:700; font-size:0.95rem;">${editing ? 'Edit Audit' : 'New Internal Audit'}</div>
        </div>

        <div class="form-row">
            <div class="form-group">
                <label>Audit Title *</label>
                <input type="text" id="audit-title" value="${escapeHtml(a.title || '')}" placeholder="e.g., Q3 2026 Internal Safety Audit">
            </div>
            <div class="form-group">
                <label>Type *</label>
                <select id="audit-type">
                    ${AUDIT_TYPES.map(t => `<option value="${t}" ${(a.type || 'Internal') === t ? 'selected' : ''}>${t}</option>`).join('')}
                </select>
            </div>
        </div>

        <div class="form-row">
            <div class="form-group">
                <label>Location</label>
                <select id="audit-location">
                    <option value="">Select location</option>
                    ${AUDIT_LOCATIONS.map(l => `<option value="${l}" ${a.location === l ? 'selected' : ''}>${l}</option>`).join('')}
                </select>
            </div>
            <div class="form-group">
                <label>Status</label>
                <select id="audit-status">
                    ${AUDIT_STATUSES.map(s => `<option value="${s}" ${(a.status || 'Planned') === s ? 'selected' : ''}>${s}</option>`).join('')}
                </select>
            </div>
        </div>

        <div class="form-group">
            <label>Scope</label>
            <textarea id="audit-scope" rows="2" placeholder="What is being audited? e.g., Warehouse operations, equipment inspections, training records.">${escapeHtml(a.scope || '')}</textarea>
        </div>

        <div class="form-group">
            <label>Audit Criteria</label>
            <input type="text" id="audit-criteria" value="${escapeHtml(a.criteria || 'ISO 45001:2018')}" placeholder="e.g., ISO 45001:2018 clauses 6-10, Tanzania OSHA Act 2003">
        </div>

        <div class="form-row">
            <div class="form-group">
                <label>Lead Auditor</label>
                <input type="text" id="audit-lead" value="${escapeHtml(a.lead_auditor || (window.mmsCurrentUser?.email || ''))}" placeholder="Name or email">
            </div>
            <div class="form-group">
                <label>Auditee (Department)</label>
                <input type="text" id="audit-auditee" value="${escapeHtml(a.auditee || '')}" placeholder="e.g., Operations Manager">
            </div>
        </div>

        <div class="form-row">
            <div class="form-group">
                <label>Planned Date</label>
                <input type="date" id="audit-planned" value="${escapeHtml(a.planned_date || today)}">
            </div>
            <div class="form-group">
                <label>Completed Date</label>
                <input type="date" id="audit-completed" value="${escapeHtml(a.completed_date || '')}">
            </div>
        </div>

        <div style="margin:1.5rem 0 1rem; padding-top:1.25rem; border-top:1px solid #e2e8f0;">
            <div style="display:flex; justify-content:space-between; align-items:center; gap:1rem; margin-bottom:0.85rem; flex-wrap:wrap;">
                <div>
                    <div style="font-weight:700; font-size:0.92rem; color:#0f172a;">Findings</div>
                    <div style="font-size:0.78rem; color:#64748b; margin-top:0.15rem;">Nonconformities, opportunities for improvement, and positive observations</div>
                </div>
                <button class="btn btn-outline btn-sm" onclick="window.__auditShowFindingForm()">+ Add Finding</button>
            </div>
            <div id="audit-findings-list"></div>
            <div id="audit-finding-form" style="display:none;"></div>
        </div>

        <div class="form-group" style="margin-top:1.5rem;">
            <label>Audit Summary</label>
            <textarea id="audit-summary" rows="3" placeholder="Overall assessment, positive aspects, and key observations.">${escapeHtml(a.summary || '')}</textarea>
        </div>

        <div class="action-buttons">
            <button class="btn btn-primary" onclick="window.__auditSave()">${editing ? '💾 Save Changes' : '💾 Create Audit'}</button>
            <button class="btn btn-outline" onclick="window.__auditBackToList()">Cancel</button>
        </div>
    `;

    renderDraftFindings();
}

function renderDraftFindings() {
    const host = document.getElementById('audit-findings-list');
    if (!host) return;

    if (draftFindings.length === 0) {
        host.innerHTML = `
            <div style="padding:1.5rem; text-align:center; color:#94a3b8; font-size:0.85rem; border:1px dashed #cbd5e1; border-radius:10px;">
                No findings yet. Click "+ Add Finding" to record the first one.
            </div>
        `;
        return;
    }

    host.innerHTML = draftFindings.map((f, idx) => {
        const meta = FINDING_CLASSIFICATIONS.find(c => c.key === f.classification);
        return `
            <div style="margin-bottom:0.75rem; padding:0.85rem 1rem; background:#f8fafc; border-radius:10px; border-left:3px solid ${meta ? meta.color : '#94a3b8'};">
                <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:0.75rem; margin-bottom:0.4rem; flex-wrap:wrap;">
                    <div style="display:flex; gap:0.5rem; align-items:center; flex-wrap:wrap;">
                        ${findingBadge(f.classification)}
                        ${f.clause ? `<span style="font-size:0.72rem; font-family:monospace; color:#64748b; padding:0.15rem 0.5rem; background:#fff; border:1px solid #e2e8f0; border-radius:6px;">${escapeHtml(f.clause)}</span>` : ''}
                    </div>
                    <button class="btn btn-danger btn-sm" onclick="window.__auditRemoveFinding(${idx})">Remove</button>
                </div>
                <div style="font-size:0.85rem; color:#334155; line-height:1.5;">${escapeHtml(f.description || '')}</div>
            </div>
        `;
    }).join('');
}

// ═══════════════════════════════════════════════════════════════
// WINDOW FUNCTIONS
// ═══════════════════════════════════════════════════════════════

window.__auditSetTab = function (tab) {
    currentTab = tab;
    currentView = 'list';
    renderAuditModule();
};

window.__auditNew = function () {
    currentAuditId = null;
    currentView = 'form';
    draftFindings = [];
    renderAuditModule();
};

window.__auditOpen = function (id) {
    currentAuditId = id;
    currentView = 'detail';
    renderAuditModule();
};

window.__auditEdit = function (id) {
    currentAuditId = id;
    currentView = 'form';
    draftFindings = [];  // will be re-hydrated in renderFormView
    renderAuditModule();
};

window.__auditBackToList = function () {
    currentView = 'list';
    currentAuditId = null;
    draftFindings = [];
    renderAuditModule();
};

window.__auditSetType = function (v) {
    filterType = v || '';
    renderAuditModule();
};

window.__auditClearFilters = function () {
    filterType = '';
    renderAuditModule();
};

window.__auditDelete = async function (id) {
    if (!confirm('Delete this audit permanently? Findings will also be removed. Corrective actions already created will not be deleted.')) return;
    try {
        await auditManager.remove(id);
        currentView = 'list';
        currentAuditId = null;
        await renderAuditModule();
    } catch (err) {
        alert('Delete failed: ' + (err.code || err.message));
    }
};

window.__auditShowFindingForm = function () {
    const host = document.getElementById('audit-finding-form');
    if (!host) return;

    host.style.display = 'block';
    host.innerHTML = `
        <div style="margin-top:0.75rem; padding:1rem 1.15rem; background:#f8fafc; border-radius:10px; border:1px solid #e2e8f0;">
            <div style="font-weight:600; font-size:0.87rem; margin-bottom:0.75rem;">New Finding</div>
            <div class="form-row">
                <div class="form-group">
                    <label>Classification *</label>
                    <select id="fnd-class">
                        ${FINDING_CLASSIFICATIONS.map(c => `<option value="${c.key}">${c.label}</option>`).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label>ISO 45001 Clause</label>
                    <select id="fnd-clause">
                        <option value="">— Select clause —</option>
                        ${ISO_CLAUSES.map(c => `<option value="${c}">${c}</option>`).join('')}
                    </select>
                </div>
            </div>
            <div class="form-group">
                <label>Description *</label>
                <textarea id="fnd-desc" rows="3" placeholder="What was found? Be specific — what was expected vs what was observed."></textarea>
            </div>
            <div class="form-group">
                <label>Evidence / Reference</label>
                <input type="text" id="fnd-evidence" placeholder="Photo ref, document ID, or observation notes">
            </div>
            <div style="display:flex; gap:0.6rem;">
                <button class="btn btn-primary btn-sm" onclick="window.__auditAddFinding()">Add Finding</button>
                <button class="btn btn-outline btn-sm" onclick="window.__auditHideFindingForm()">Cancel</button>
            </div>
        </div>
    `;
};

window.__auditHideFindingForm = function () {
    const host = document.getElementById('audit-finding-form');
    if (host) {
        host.style.display = 'none';
        host.innerHTML = '';
    }
};

window.__auditAddFinding = function () {
    const classification = (document.getElementById('fnd-class') || {}).value;
    const clause = (document.getElementById('fnd-clause') || {}).value;
    const description = (document.getElementById('fnd-desc') || {}).value?.trim();
    const evidence = (document.getElementById('fnd-evidence') || {}).value?.trim() || '';

    if (!description) {
        alert('Please describe the finding.');
        return;
    }

    draftFindings.push({
        id: 'FND-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
        classification,
        clause,
        description,
        evidence,
        corrective_action_id: ''
    });

    window.__auditHideFindingForm();
    renderDraftFindings();
};

window.__auditRemoveFinding = function (idx) {
    if (!confirm('Remove this finding from the draft?')) return;
    draftFindings.splice(idx, 1);
    renderDraftFindings();
};

window.__auditSave = async function () {
    const title = (document.getElementById('audit-title') || {}).value?.trim();
    if (!title) { alert('Audit title is required.'); return; }

    const data = {
        title,
        type: (document.getElementById('audit-type') || {}).value || 'Internal',
        location: (document.getElementById('audit-location') || {}).value || '',
        status: (document.getElementById('audit-status') || {}).value || 'Planned',
        scope: (document.getElementById('audit-scope') || {}).value?.trim() || '',
        criteria: (document.getElementById('audit-criteria') || {}).value?.trim() || '',
        lead_auditor: (document.getElementById('audit-lead') || {}).value?.trim() || '',
        auditee: (document.getElementById('audit-auditee') || {}).value?.trim() || '',
        planned_date: (document.getElementById('audit-planned') || {}).value || '',
        completed_date: (document.getElementById('audit-completed') || {}).value || '',
        summary: (document.getElementById('audit-summary') || {}).value?.trim() || '',
        findings: draftFindings
    };

    try {
        if (currentAuditId) {
            await auditManager.update(currentAuditId, data);
        } else {
            await auditManager.create(data);
        }
        currentView = 'list';
        currentAuditId = null;
        draftFindings = [];
        await renderAuditModule();
    } catch (err) {
        console.error('[audit] Save failed:', err);
        alert('Save failed: ' + (err.code || err.message));
    }
};

// ═══════════════════════════════════════════════════════════════
// SPAWN CORRECTIVE ACTION — delegates to compliance-manager
// ═══════════════════════════════════════════════════════════════

window.__auditCreateCA = async function (auditId, findingId) {
    const audit = cachedAudits.find(x => x.id === auditId);
    if (!audit) return;

    const finding = (audit.findings || []).find(f => f.id === findingId);
    if (!finding) return;

    if (!window.complianceManager) {
        alert('Corrective action module not available. Please reload.');
        return;
    }

    const confirmed = confirm(
        'Create Corrective Action\n\n' +
        'Audit: ' + audit.title + '\n' +
        'Finding: ' + finding.classification + (finding.clause ? ' (' + finding.clause + ')' : '') + '\n\n' +
        'A new corrective action will be created and linked to this finding. Continue?'
    );
    if (!confirmed) return;

    try {
        const result = await window.complianceManager.createCorrectiveAction({
            title: finding.description.substring(0, 90) || 'Corrective action',
            source: 'audit',
            source_ref: audit.id,
            description: finding.description,
            priority: finding.classification === 'Major NC' ? 'High' : 'Medium',
            due_date: '',
            owner: audit.lead_auditor || ''
        });

        if (!result.success) {
            alert('Failed to create corrective action: ' + (result.error || 'unknown error'));
            return;
        }

        // Persist the link back onto the finding
        const updatedFindings = audit.findings.map(f => {
            if (f.id === findingId) {
                return { ...f, corrective_action_id: result.action.id };
            }
            return f;
        });

        await auditManager.update(auditId, { ...audit, findings: updatedFindings });

        alert('✅ Corrective action ' + result.action.id + ' created and linked.');
        await renderAuditModule();
    } catch (err) {
        console.error('[audit] Create CA failed:', err);
        alert('Failed: ' + (err.code || err.message));
    }
};

// ═══════════════════════════════════════════════════════════════
// MODAL OBSERVER
// ═══════════════════════════════════════════════════════════════

function attachAuditObserver() {
    const modal = document.getElementById('auditModal');
    if (!modal) {
        console.warn('[audit] auditModal not found in DOM');
        return;
    }

    const onOpen = () => {
        currentView = 'list';
        currentAuditId = null;
        draftFindings = [];
        renderAuditModule();
    };

    if (modal.classList.contains('show')) onOpen();

    const observer = new MutationObserver(() => {
        if (modal.classList.contains('show')) onOpen();
    });
    observer.observe(modal, { attributes: true, attributeFilter: ['class'] });

    console.log('[audit] Observer attached to #auditModal');
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', attachAuditObserver);
} else {
    attachAuditObserver();
}

console.log('[audit-logger] Ready');