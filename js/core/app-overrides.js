// ============================================================
// app-overrides.js
// Overrides app.js stub loaders for 3 modules that already
// have full APIs but were never wired to their modals:
//   - Emergency Wizard
//   - Equipment Inspections
//   - Chemical Register
//
// Loads AFTER app.js. Never touches app.js directly.
// Rollback = remove the script tag from dashboard.html.
// ============================================================

(function () {

    // ---------- helpers ----------
    function esc(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function statTile(label, value, color) {
        return '<div style="padding:0.9rem 1rem; background:#f8fafc; border:1px solid #e2e8f0; border-radius:12px;">' +
            '<div style="font-size:1.4rem; font-weight:800; color:' + (color || '#0f172a') + '; line-height:1;">' + esc(value) + '</div>' +
            '<div style="font-size:0.68rem; color:#64748b; text-transform:uppercase; letter-spacing:0.4px; margin-top:0.35rem; font-weight:700;">' + esc(label) + '</div>' +
        '</div>';
    }

    function notLoaded(kind) {
        return '<div style="text-align:center; padding:3rem 1rem; color:#64748b;">' +
            '<div style="font-size:3rem; margin-bottom:0.5rem;">\u26A0\uFE0F</div>' +
            '<div style="font-weight:600; color:#0f172a;">' + esc(kind) + ' module not loaded</div>' +
            '<div style="font-size:0.85rem; margin-top:0.35rem;">Check that the module script is included in dashboard.html</div>' +
        '</div>';
    }

    // ============================================================
    // EMERGENCY WIZARD
    // ============================================================
    window.loadEmergencyProcedures = function () {
        var el = document.getElementById('emergencyContent');
        if (!el) return;

        if (!window.emergencyWizard || typeof window.emergencyWizard.getEmergencyTypes !== 'function') {
            el.innerHTML = notLoaded('Emergency');
            return;
        }

        var types = [];
        try { types = window.emergencyWizard.getEmergencyTypes() || []; } catch (e) {}

        // Normalize: types might be strings or objects
        var normalized = types.map(function (t) {
            if (typeof t === 'string') {
                return { id: t, title: t.charAt(0).toUpperCase() + t.slice(1), icon: '\uD83D\uDEA8' };
            }
            return {
                id: t.id || t.type || t.key || '',
                title: t.title || t.name || t.label || t.id || 'Procedure',
                icon: t.icon || '\uD83D\uDEA8'
            };
        }).filter(function (t) { return t.id; });

        var html =
            '<div style="display:flex; justify-content:space-between; align-items:center; gap:1rem; margin-bottom:1.25rem; flex-wrap:wrap;">' +
                '<div>' +
                    '<div style="font-weight:600;">Emergency Procedures</div>' +
                    '<div style="font-size:0.82rem; color:#64748b; margin-top:0.15rem;">Pick a situation to view the step-by-step guide</div>' +
                '</div>' +
            '</div>';

        if (normalized.length === 0) {
            html += '<div style="text-align:center; padding:2.5rem 1rem; color:#64748b; border:1px dashed #cbd5e1; border-radius:12px;">' +
                '<div style="font-size:3rem; margin-bottom:0.5rem;">\uD83D\uDEA8</div>' +
                '<div style="font-weight:600; color:#0f172a; margin-bottom:0.35rem;">No emergency procedures defined</div>' +
            '</div>';
            el.innerHTML = html;
            return;
        }

        html += '<div style="display:grid; grid-template-columns:repeat(auto-fill,minmax(220px,1fr)); gap:0.85rem;">';
        normalized.forEach(function (t) {
            html += '<button class="module-item" onclick="window.__openEmergencyProcedure(\'' + esc(t.id) + '\')" style="text-align:left; padding:1rem;">' +
                '<span class="mi-icon">' + t.icon + '</span>' +
                '<span class="mi-label">' + esc(t.title) + '</span>' +
            '</button>';
        });
        html += '</div>';

        el.innerHTML = html;
    };

    window.__openEmergencyProcedure = function (type) {
        var el = document.getElementById('emergencyContent');
        if (!el || !window.emergencyWizard) return;

        var procedure = null;
        try { procedure = window.emergencyWizard.getEmergencyProcedure(type); } catch (e) {}

        var backBtn = '<button class="btn btn-outline btn-sm" onclick="window.loadEmergencyProcedures()" style="margin-bottom:1rem;">\u2190 Back to Procedures</button>';

        if (!procedure) {
            el.innerHTML = backBtn + '<div style="padding:2rem; text-align:center; color:#64748b;">Procedure not found for type: ' + esc(type) + '</div>';
            return;
        }

        var title = procedure.title || type;
        var steps = procedure.steps || procedure.instructions || procedure.procedure || [];

        var html = backBtn +
            '<div style="font-size:1.15rem; font-weight:700; color:#0f172a; margin-bottom:1rem;">' + esc(title) + '</div>';

        if (Array.isArray(steps) && steps.length > 0) {
            steps.forEach(function (step, i) {
                var stepText = typeof step === 'string'
                    ? step
                    : (step.text || step.step || step.description || step.instruction || '');
                html += '<div style="background:#f8fafc; border-radius:10px; padding:0.85rem 1rem; margin-bottom:0.5rem; border-left:3px solid #dc2626;">' +
                    '<div style="font-size:0.68rem; font-weight:700; color:#dc2626; margin-bottom:0.15rem; text-transform:uppercase; letter-spacing:0.4px;">Step ' + (i + 1) + '</div>' +
                    '<div style="font-size:0.87rem; color:#334155; line-height:1.55;">' + esc(stepText) + '</div>' +
                '</div>';
            });
        } else {
            html += '<div style="padding:1rem; color:#64748b; font-size:0.85rem;">No steps documented for this procedure.</div>';
        }

        el.innerHTML = html;
    };

    // ============================================================
    // EQUIPMENT INSPECTIONS
    // ============================================================
    window.loadEquipmentInspections = function () {
        var el = document.getElementById('equipmentContent');
        if (!el) return;

        if (!window.equipmentInspections) {
            el.innerHTML = notLoaded('Equipment');
            return;
        }

        // Try the module's own renderer (may write to a fixed ID inside the modal)
        try {
            var result = window.equipmentInspections.renderEquipmentTable();
            if (typeof result === 'string' && result.length > 0) {
                el.innerHTML = result;
                return;
            }
        } catch (e) {
            // fall through
        }

        // If the module rendered somewhere inside the modal, we're fine
        if (el.innerHTML && el.innerHTML.indexOf('Module loaded from') === -1 && el.innerHTML.trim().length > 80) {
            return;
        }

        // Fallback: stats + open-manager button
        var stats = {};
        try { stats = window.equipmentInspections.getInspectionStatistics() || {}; } catch (e) {}

        var html =
            '<div style="display:flex; justify-content:space-between; align-items:center; gap:1rem; margin-bottom:1.25rem; flex-wrap:wrap;">' +
                '<div>' +
                    '<div style="font-weight:600;">Equipment Inspection Manager</div>' +
                    '<div style="font-size:0.82rem; color:#64748b; margin-top:0.15rem;">Track maintenance and inspection schedules</div>' +
                '</div>' +
                '<button class="btn btn-outline btn-sm" onclick="window.loadEquipmentInspections()">\uD83D\uDD04 Refresh</button>' +
            '</div>';

        if (stats && (stats.total != null || stats.overdue != null)) {
            html += '<div style="display:grid; grid-template-columns:repeat(auto-fit,minmax(150px,1fr)); gap:0.75rem; margin-bottom:1.25rem;">';
            html += statTile('Total Equipment', stats.total || 0, '#0f172a');
            html += statTile('Overdue', stats.overdue || 0, (stats.overdue > 0) ? '#dc2626' : '#065f46');
            html += statTile('Due Soon', stats.dueSoon || 0, '#92400e');
            html += '</div>';
        }

        html += '<div style="text-align:center; padding:2rem 1rem; color:#64748b; border:1px dashed #cbd5e1; border-radius:12px;">' +
            '<div style="font-size:2.5rem; margin-bottom:0.5rem;">\uD83D\uDD27</div>' +
            '<div style="font-weight:600; color:#0f172a; margin-bottom:0.35rem;">Open the Equipment Manager</div>' +
            '<div style="font-size:0.85rem; margin-bottom:1rem;">Full inspection workflow available via the module entry point</div>' +
            '<button class="btn btn-primary" onclick="if(window.openEquipmentInspections)window.openEquipmentInspections();else alert(\'Equipment module entry point not available.\')">\uD83D\uDD27 Open Equipment Manager</button>' +
        '</div>';

        el.innerHTML = html;
    };

    // ============================================================
    // CHEMICAL REGISTER
    // ============================================================
    window.loadChemicalRegister = function () {
        var el = document.getElementById('chemicalContent');
        if (!el) return;

        if (!window.chemicalRegister) {
            el.innerHTML = notLoaded('Chemical');
            return;
        }

        // Try the module's own renderer
        try {
            var result = window.chemicalRegister.renderChemicalTable();
            if (typeof result === 'string' && result.length > 0) {
                el.innerHTML = result;
                return;
            }
        } catch (e) {
            // fall through
        }

        if (el.innerHTML && el.innerHTML.indexOf('Module loaded from') === -1 && el.innerHTML.trim().length > 80) {
            return;
        }

        // Fallback
        var stats = {};
        try { stats = window.chemicalRegister.getChemicalStatistics() || {}; } catch (e) {}

        var html =
            '<div style="display:flex; justify-content:space-between; align-items:center; gap:1rem; margin-bottom:1.25rem; flex-wrap:wrap;">' +
                '<div>' +
                    '<div style="font-weight:600;">Chemical Safety Register</div>' +
                    '<div style="font-size:0.82rem; color:#64748b; margin-top:0.15rem;">Inventory, SDS, and hazard tracking</div>' +
                '</div>' +
                '<button class="btn btn-outline btn-sm" onclick="window.loadChemicalRegister()">\uD83D\uDD04 Refresh</button>' +
            '</div>';

        if (stats && (stats.total != null || stats.expiringSDS != null)) {
            html += '<div style="display:grid; grid-template-columns:repeat(auto-fit,minmax(150px,1fr)); gap:0.75rem; margin-bottom:1.25rem;">';
            html += statTile('Total Chemicals', stats.total || 0, '#0f172a');
            html += statTile('Expiring SDS', stats.expiringSDS || 0, (stats.expiringSDS > 0) ? '#92400e' : '#065f46');
            html += statTile('Reorder Alerts', stats.reorderAlerts || 0, (stats.reorderAlerts > 0) ? '#dc2626' : '#065f46');
            html += '</div>';
        }

        html += '<div style="text-align:center; padding:2rem 1rem; color:#64748b; border:1px dashed #cbd5e1; border-radius:12px;">' +
            '<div style="font-size:2.5rem; margin-bottom:0.5rem;">\uD83E\uDDEA</div>' +
            '<div style="font-weight:600; color:#0f172a; margin-bottom:0.35rem;">Open the Chemical Register</div>' +
            '<div style="font-size:0.85rem; margin-bottom:1rem;">Full inventory and SDS management via the module entry point</div>' +
            '<button class="btn btn-primary" onclick="if(window.openChemicalRegister)window.openChemicalRegister();else alert(\'Chemical module entry point not available.\')">\uD83E\uDDEA Open Chemical Register</button>' +
        '</div>';

        el.innerHTML = html;
    };

    console.log('[app-overrides] Module loaders patched (emergency, equipment, chemical)');
})();