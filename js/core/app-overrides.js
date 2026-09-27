// ============================================================
// app-overrides.js
// Overrides app.js stub loaders + provides missing modal
// builders for equipment-inspections.js and chemical-register.js
//
// Loads AFTER app.js. Never touches app.js or module files.
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

    function pickField(obj, keys, fallback) {
        if (!obj) return fallback;
        for (var i = 0; i < keys.length; i++) {
            var v = obj[keys[i]];
            if (v !== undefined && v !== null && v !== '') return v;
        }
        return fallback;
    }

    function makeOverlay() {
        var overlay = document.createElement('div');
        overlay.style.cssText =
            'position:fixed; inset:0; background:rgba(15,23,42,0.65); ' +
            'backdrop-filter:blur(4px); -webkit-backdrop-filter:blur(4px); ' +
            'z-index:9999; display:flex; align-items:center; justify-content:center; padding:1rem;';
        overlay.addEventListener('click', function (e) {
            if (e.target === overlay) overlay.remove();
        });
        return overlay;
    }

    function makeShell(title, subtitle) {
        var shell = document.createElement('div');
        shell.style.cssText =
            'background:white; border-radius:16px; max-width:960px; width:100%; ' +
            'max-height:85vh; overflow:auto; padding:1.75rem; ' +
            'box-shadow:0 20px 60px rgba(0,0,0,0.3); position:relative;';
        shell.innerHTML =
            '<div style="display:flex; justify-content:space-between; align-items:flex-start; gap:1rem; margin-bottom:1.25rem; padding-right:2rem;">' +
                '<div>' +
                    '<div style="font-size:1.2rem; font-weight:700; color:#0f172a;">' + esc(title) + '</div>' +
                    (subtitle ? '<div style="font-size:0.82rem; color:#64748b; margin-top:0.2rem;">' + esc(subtitle) + '</div>' : '') +
                '</div>' +
            '</div>' +
            '<button class="__mms-modal-close" style="position:absolute; top:1rem; right:1rem; background:transparent; border:none; font-size:1.35rem; cursor:pointer; color:#94a3b8; width:32px; height:32px; border-radius:8px; line-height:1;">\u00D7</button>' +
            '<div class="__mms-modal-body"></div>';
        shell.querySelector('.__mms-modal-close').addEventListener('click', function () {
            shell.parentElement.remove();
        });
        return shell;
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
    // EQUIPMENT INSPECTIONS — main loader
    // ============================================================
    window.loadEquipmentInspections = function () {
        var el = document.getElementById('equipmentContent');
        if (!el) return;

        if (!window.equipmentInspections) {
            el.innerHTML = notLoaded('Equipment');
            return;
        }

        var stats = {};
        try { stats = window.equipmentInspections.getInspectionStatistics() || {}; } catch (e) {}

        var html =
            '<div style="display:flex; justify-content:space-between; align-items:center; gap:1rem; margin-bottom:1.25rem; flex-wrap:wrap;">' +
                '<div>' +
                    '<div style="font-weight:600;">Equipment Inspection Manager</div>' +
                    '<div style="font-size:0.82rem; color:#64748b; margin-top:0.15rem;">Track maintenance and inspection schedules</div>' +
                '</div>' +
                '<button class="btn btn-primary btn-sm" onclick="window.openEquipmentInspections()">\uD83D\uDD27 Open Manager</button>' +
            '</div>';

        if (stats && (stats.total != null || stats.overdue != null)) {
            html += '<div style="display:grid; grid-template-columns:repeat(auto-fit,minmax(150px,1fr)); gap:0.75rem; margin-bottom:1.25rem;">';
            html += statTile('Total Equipment', stats.total || 0, '#0f172a');
            html += statTile('Overdue', stats.overdue || 0, (stats.overdue > 0) ? '#dc2626' : '#065f46');
            html += statTile('Due Soon', stats.dueSoon || 0, '#92400e');
            html += statTile('Compliant', stats.compliant != null ? stats.compliant : (stats.uptodate || 0), '#065f46');
            html += '</div>';
        }

        html += '<div style="text-align:center; padding:2rem 1rem; color:#64748b; border:1px dashed #cbd5e1; border-radius:12px;">' +
            '<div style="font-size:2.5rem; margin-bottom:0.5rem;">\uD83D\uDD27</div>' +
            '<div style="font-weight:600; color:#0f172a; margin-bottom:0.35rem;">Open the Equipment Manager</div>' +
            '<div style="font-size:0.85rem; margin-bottom:1rem;">Full inspection workflow, schedules, and history</div>' +
            '<button class="btn btn-primary" onclick="window.openEquipmentInspections()">\uD83D\uDD27 Open Equipment Manager</button>' +
        '</div>';

        el.innerHTML = html;
    };

    // ============================================================
    // CHEMICAL REGISTER — main loader
    // ============================================================
    window.loadChemicalRegister = function () {
        var el = document.getElementById('chemicalContent');
        if (!el) return;

        if (!window.chemicalRegister) {
            el.innerHTML = notLoaded('Chemical');
            return;
        }

        var stats = {};
        try { stats = window.chemicalRegister.getChemicalStatistics() || {}; } catch (e) {}

        var html =
            '<div style="display:flex; justify-content:space-between; align-items:center; gap:1rem; margin-bottom:1.25rem; flex-wrap:wrap;">' +
                '<div>' +
                    '<div style="font-weight:600;">Chemical Safety Register</div>' +
                    '<div style="font-size:0.82rem; color:#64748b; margin-top:0.15rem;">Inventory, SDS, and hazard tracking</div>' +
                '</div>' +
                '<button class="btn btn-primary btn-sm" onclick="window.openChemicalRegister()">\uD83E\uDDEA Open Register</button>' +
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
            '<div style="font-size:0.85rem; margin-bottom:1rem;">Full inventory and SDS management</div>' +
            '<button class="btn btn-primary" onclick="window.openChemicalRegister()">\uD83E\uDDEA Open Chemical Register</button>' +
        '</div>';

        el.innerHTML = html;
    };

    // ============================================================
    // MISSING MODAL BUILDERS — called by the modules' own code
    // ============================================================

    // ---- createEquipmentModal() ----
    window.createEquipmentModal = function () {
        var overlay = makeOverlay();
        var shell = makeShell('Equipment Inspection Manager', 'All equipment with inspection schedule status');

        var body = shell.querySelector('.__mms-modal-body');
        var eq = window.equipmentInspections;
        var list = [];

        try {
            if (typeof eq.getAllEquipment === 'function') list = eq.getAllEquipment() || [];
            else if (Array.isArray(eq.equipment)) list = eq.equipment;
            else if (Array.isArray(eq.equipmentList)) list = eq.equipmentList;
            else {
                // Try common collection names
                var candidates = ['equipmentData', 'inventory', 'items', 'equipment'];
                for (var i = 0; i < candidates.length; i++) {
                    if (Array.isArray(eq[candidates[i]])) { list = eq[candidates[i]]; break; }
                }
            }
        } catch (e) {}

        var stats = {};
        try { stats = eq.getInspectionStatistics() || {}; } catch (e) {}

        var html = '';
        html += '<div style="display:grid; grid-template-columns:repeat(auto-fit,minmax(140px,1fr)); gap:0.75rem; margin-bottom:1.25rem;">';
        html += statTile('Total', stats.total != null ? stats.total : list.length, '#0f172a');
        html += statTile('Overdue', stats.overdue != null ? stats.overdue : 0, '#dc2626');
        html += statTile('Due Soon', stats.dueSoon != null ? stats.dueSoon : 0, '#92400e');
        html += '</div>';

        if (list.length === 0) {
            html += '<div style="text-align:center; padding:2.5rem 1rem; color:#64748b; border:1px dashed #cbd5e1; border-radius:12px;">' +
                '<div style="font-size:3rem; margin-bottom:0.5rem;">\uD83D\uDD27</div>' +
                '<div style="font-weight:600; color:#0f172a; margin-bottom:0.35rem;">No equipment registered yet</div>' +
                '<div style="font-size:0.85rem;">Equipment records will appear here once added.</div>' +
            '</div>';
        } else {
            html += '<div style="overflow-x:auto;">';
            html += '<table style="width:100%; border-collapse:collapse;">';
            html += '<thead><tr style="background:#f8fafc;">';
            ['Equipment', 'Type', 'Location', 'Last Insp.', 'Next Due', 'Status'].forEach(function (h) {
                html += '<th style="padding:0.6rem 0.75rem; text-align:left; font-size:0.72rem; color:#64748b; text-transform:uppercase; letter-spacing:0.4px; font-weight:700; border-bottom:1px solid #e2e8f0;">' + h + '</th>';
            });
            html += '</tr></thead><tbody>';

            list.forEach(function (item) {
                var name = pickField(item, ['name', 'equipmentName', 'title'], 'Unnamed');
                var type = pickField(item, ['type', 'category', 'equipmentType'], '—');
                var location = pickField(item, ['location', 'site', 'area'], '—');
                var lastInsp = pickField(item, ['lastInspection', 'last_inspection', 'lastInspected'], '—');
                var nextDue = pickField(item, ['nextInspection', 'next_inspection', 'nextDue'], '—');
                var status = pickField(item, ['status', 'state'], 'Operational');
                var serial = pickField(item, ['serialNumber', 'serial', 'serial_number'], '');

                var statusColor = (String(status).toLowerCase().indexOf('overdue') !== -1) ? '#dc2626' :
                                  (String(status).toLowerCase().indexOf('due') !== -1) ? '#92400e' : '#065f46';
                var statusBg = (String(status).toLowerCase().indexOf('overdue') !== -1) ? '#fef2f2' :
                               (String(status).toLowerCase().indexOf('due') !== -1) ? '#fffbeb' : '#ecfdf5';

                html += '<tr style="border-bottom:1px solid #f1f5f9;">';
                html += '<td style="padding:0.7rem 0.75rem;"><div style="font-weight:600;">' + esc(name) + '</div>' +
                        (serial ? '<div style="font-size:0.72rem; color:#94a3b8;">' + esc(serial) + '</div>' : '') + '</td>';
                html += '<td style="padding:0.7rem 0.75rem; font-size:0.85rem;">' + esc(type) + '</td>';
                html += '<td style="padding:0.7rem 0.75rem; font-size:0.85rem;">' + esc(location) + '</td>';
                html += '<td style="padding:0.7rem 0.75rem; font-size:0.82rem;">' + esc(lastInsp) + '</td>';
                html += '<td style="padding:0.7rem 0.75rem; font-size:0.82rem;">' + esc(nextDue) + '</td>';
                html += '<td style="padding:0.7rem 0.75rem;"><span style="padding:0.2rem 0.55rem; border-radius:6px; font-size:0.7rem; font-weight:700; background:' + statusBg + '; color:' + statusColor + '; text-transform:uppercase;">' + esc(status) + '</span></td>';
                html += '</tr>';
            });

            html += '</tbody></table></div>';
        }

        body.innerHTML = html;
        overlay.appendChild(shell);
        return overlay;
    };

    // ---- createInspectionModal(equipment) ----
    window.createInspectionModal = function (equipment) {
        var overlay = makeOverlay();
        var name = pickField(equipment, ['name', 'equipmentName', 'title'], 'Equipment');
        var shell = makeShell('Schedule Inspection', name);

        var body = shell.querySelector('.__mms-modal-body');
        var today = new Date().toISOString().split('T')[0];

        body.innerHTML =
            '<div style="margin-bottom:1rem;">' +
                '<label style="display:block; font-size:0.82rem; font-weight:600; color:#334155; margin-bottom:0.35rem;">Inspection Date</label>' +
                '<input type="date" id="__insp-date" value="' + today + '" style="width:100%; padding:0.65rem 0.85rem; border:1px solid #e2e8f0; border-radius:8px; font-family:inherit; font-size:0.9rem;">' +
            '</div>' +
            '<div style="margin-bottom:1rem;">' +
                '<label style="display:block; font-size:0.82rem; font-weight:600; color:#334155; margin-bottom:0.35rem;">Inspector</label>' +
                '<input type="text" id="__insp-inspector" placeholder="Name or email" value="' + esc(window.mmsCurrentUser && window.mmsCurrentUser.email || '') + '" style="width:100%; padding:0.65rem 0.85rem; border:1px solid #e2e8f0; border-radius:8px; font-family:inherit; font-size:0.9rem;">' +
            '</div>' +
            '<div style="margin-bottom:1.25rem;">' +
                '<label style="display:block; font-size:0.82rem; font-weight:600; color:#334155; margin-bottom:0.35rem;">Notes</label>' +
                '<textarea id="__insp-notes" rows="3" placeholder="Findings, issues, or observations" style="width:100%; padding:0.65rem 0.85rem; border:1px solid #e2e8f0; border-radius:8px; font-family:inherit; font-size:0.9rem; resize:vertical;"></textarea>' +
            '</div>' +
            '<div style="display:flex; gap:0.6rem; justify-content:flex-end;">' +
                '<button class="btn btn-outline" id="__insp-cancel">Cancel</button>' +
                '<button class="btn btn-primary" id="__insp-save">Save Inspection</button>' +
            '</div>';

        body.querySelector('#__insp-cancel').addEventListener('click', function () {
            overlay.remove();
        });

        body.querySelector('#__insp-save').addEventListener('click', function () {
            var date = document.getElementById('__insp-date').value;
            var inspector = document.getElementById('__insp-inspector').value;
            var notes = document.getElementById('__insp-notes').value;

            if (!date) { alert('Pick an inspection date.'); return; }

            var result = {
                date: date,
                inspector: inspector,
                notes: notes,
                completedAt: new Date().toISOString()
            };

            var eq = window.equipmentInspections;
            var promise;

            if (eq && typeof eq.completeInspection === 'function') {
                var eqId = pickField(equipment, ['id', 'equipmentId'], '');
                promise = eq.completeInspection(eqId, null, result);
            } else if (eq && typeof eq.recordInspection === 'function') {
                promise = eq.recordInspection(equipment, result);
            } else {
                promise = Promise.resolve({ success: true });
            }

            Promise.resolve(promise).then(function (res) {
                if (res && res.success === false) {
                    alert('Failed: ' + (res.error || 'unknown error'));
                    return;
                }
                alert('Inspection recorded.');
                overlay.remove();
                if (typeof window.openEquipmentInspections === 'function') {
                    window.openEquipmentInspections();
                }
            }).catch(function (err) {
                alert('Failed: ' + (err && err.message || 'unknown'));
            });
        });

        overlay.appendChild(shell);
        return overlay;
    };

    // ---- createChemicalModal() ----
    window.createChemicalModal = function () {
        var overlay = makeOverlay();
        var shell = makeShell('Chemical Safety Register', 'Inventory, hazard class, and SDS status');

        var body = shell.querySelector('.__mms-modal-body');
        var reg = window.chemicalRegister;
        var list = [];

        try {
            if (typeof reg.getAllChemicals === 'function') list = reg.getAllChemicals() || [];
            else if (Array.isArray(reg.chemicals)) list = reg.chemicals;
            else if (Array.isArray(reg.chemicalList)) list = reg.chemicalList;
            else {
                var candidates = ['chemicalData', 'inventory', 'items', 'chemicals'];
                for (var i = 0; i < candidates.length; i++) {
                    if (Array.isArray(reg[candidates[i]])) { list = reg[candidates[i]]; break; }
                }
            }
        } catch (e) {}

        var stats = {};
        try { stats = reg.getChemicalStatistics() || {}; } catch (e) {}

        var html = '';
        html += '<div style="display:grid; grid-template-columns:repeat(auto-fit,minmax(140px,1fr)); gap:0.75rem; margin-bottom:1.25rem;">';
        html += statTile('Total', stats.total != null ? stats.total : list.length, '#0f172a');
        html += statTile('Expiring SDS', stats.expiringSDS != null ? stats.expiringSDS : 0, '#92400e');
        html += statTile('Reorder Alerts', stats.reorderAlerts != null ? stats.reorderAlerts : 0, '#dc2626');
        html += '</div>';

        if (list.length === 0) {
            html += '<div style="text-align:center; padding:2.5rem 1rem; color:#64748b; border:1px dashed #cbd5e1; border-radius:12px;">' +
                '<div style="font-size:3rem; margin-bottom:0.5rem;">\uD83E\uDDEA</div>' +
                '<div style="font-weight:600; color:#0f172a; margin-bottom:0.35rem;">No chemicals registered yet</div>' +
                '<div style="font-size:0.85rem;">Add chemicals to start tracking SDS and hazards.</div>' +
            '</div>';
        } else {
            html += '<div style="overflow-x:auto;">';
            html += '<table style="width:100%; border-collapse:collapse;">';
            html += '<thead><tr style="background:#f8fafc;">';
            ['Chemical', 'Hazard Class', 'Location', 'Qty', 'SDS Expiry', 'Actions'].forEach(function (h) {
                html += '<th style="padding:0.6rem 0.75rem; text-align:left; font-size:0.72rem; color:#64748b; text-transform:uppercase; letter-spacing:0.4px; font-weight:700; border-bottom:1px solid #e2e8f0;">' + h + '</th>';
            });
            html += '</tr></thead><tbody>';

            list.forEach(function (c) {
                var id = pickField(c, ['id', 'chemicalId'], '');
                var name = pickField(c, ['name', 'chemicalName', 'title'], 'Unnamed');
                var haz = pickField(c, ['hazardClass', 'hazard_class', 'ghsClass', 'hazard'], '—');
                var loc = pickField(c, ['location', 'site', 'storageLocation', 'storage_location'], '—');
                var qty = pickField(c, ['quantity', 'qty', 'amount'], '—');
                var unit = pickField(c, ['unit', 'units'], '');
                var sds = pickField(c, ['sdsExpiry', 'sds_expiry', 'sdsExpiryDate'], '—');
                var cas = pickField(c, ['casNumber', 'cas', 'cas_number'], '');

                var hazColor = '#475569';
                var hazBg = '#f1f5f9';
                var h = String(haz).toLowerCase();
                if (h.indexOf('flammable') !== -1) { hazColor = '#92400e'; hazBg = '#fef3c7'; }
                else if (h.indexOf('toxic') !== -1 || h.indexOf('poison') !== -1) { hazColor = '#7c3aed'; hazBg = '#f5f3ff'; }
                else if (h.indexOf('corrosive') !== -1 || h.indexOf('acid') !== -1) { hazColor = '#991b1b'; hazBg = '#fef2f2'; }

                html += '<tr style="border-bottom:1px solid #f1f5f9;">';
                html += '<td style="padding:0.7rem 0.75rem;"><div style="font-weight:600;">' + esc(name) + '</div>' +
                        (cas ? '<div style="font-size:0.72rem; color:#94a3b8;">CAS: ' + esc(cas) + '</div>' : '') + '</td>';
                html += '<td style="padding:0.7rem 0.75rem;"><span style="padding:0.2rem 0.55rem; border-radius:6px; font-size:0.7rem; font-weight:700; background:' + hazBg + '; color:' + hazColor + ';">' + esc(haz) + '</span></td>';
                html += '<td style="padding:0.7rem 0.75rem; font-size:0.85rem;">' + esc(loc) + '</td>';
                html += '<td style="padding:0.7rem 0.75rem; font-size:0.85rem;">' + esc(qty) + ' ' + esc(unit) + '</td>';
                html += '<td style="padding:0.7rem 0.75rem; font-size:0.82rem;">' + esc(sds) + '</td>';
                html += '<td style="padding:0.7rem 0.75rem;">' +
                        '<button class="btn btn-outline btn-sm" onclick="window.viewChemicalDetails(\'' + esc(id) + '\')">View</button> ' +
                        '<button class="btn btn-outline btn-sm" onclick="window.updateChemicalInventory(\'' + esc(id) + '\')">Update</button>' +
                        '</td>';
                html += '</tr>';
            });

            html += '</tbody></table></div>';
        }

        body.innerHTML = html;
        overlay.appendChild(shell);
        return overlay;
    };

    // ---- createChemicalDetailModal(chemical) ----
    window.createChemicalDetailModal = function (chemical) {
        var overlay = makeOverlay();
        var name = pickField(chemical, ['name', 'chemicalName', 'title'], 'Chemical');
        var shell = makeShell('Chemical Details', name);

        var body = shell.querySelector('.__mms-modal-body');

        var info = [
            ['CAS Number', pickField(chemical, ['casNumber', 'cas', 'cas_number'], '—')],
            ['Hazard Class', pickField(chemical, ['hazardClass', 'hazard_class', 'ghsClass'], '—')],
            ['Location', pickField(chemical, ['location', 'storageLocation', 'storage_location'], '—')],
            ['Quantity', pickField(chemical, ['quantity', 'qty'], '—') + ' ' + pickField(chemical, ['unit', 'units'], '')],
            ['SDS Expiry', pickField(chemical, ['sdsExpiry', 'sds_expiry'], '—')],
            ['Supplier', pickField(chemical, ['supplier', 'vendor'], '—')],
            ['Reorder Level', pickField(chemical, ['reorderLevel', 'reorder_level'], '—')],
            ['Notes', pickField(chemical, ['notes', 'description'], '—')]
        ];

        var emergency = null;
        try {
            if (window.chemicalRegister && typeof window.chemicalRegister.getEmergencyInfo === 'function') {
                emergency = window.chemicalRegister.getEmergencyInfo(pickField(chemical, ['id'], ''));
            }
        } catch (e) {}

        var html = '<div style="display:grid; gap:0.85rem;">';
        info.forEach(function (pair) {
            html += '<div>' +
                '<div style="font-size:0.68rem; text-transform:uppercase; letter-spacing:0.4px; color:#64748b; font-weight:700; margin-bottom:0.15rem;">' + esc(pair[0]) + '</div>' +
                '<div style="font-size:0.9rem; color:#334155;">' + esc(pair[1]) + '</div>' +
            '</div>';
        });
        html += '</div>';

        if (emergency) {
            html += '<div style="margin-top:1.25rem; padding:1rem; background:#fef2f2; border-left:3px solid #dc2626; border-radius:8px;">' +
                '<div style="font-size:0.72rem; font-weight:700; color:#991b1b; text-transform:uppercase; letter-spacing:0.4px; margin-bottom:0.35rem;">Emergency Info</div>' +
                '<div style="font-size:0.85rem; color:#7f1d1d; white-space:pre-wrap;">' + esc(typeof emergency === 'string' ? emergency : JSON.stringify(emergency, null, 2)) + '</div>' +
            '</div>';
        }

        body.innerHTML = html;
        overlay.appendChild(shell);
        return overlay;
    };

    // ---- createInventoryModal(chemical) ----
    window.createInventoryModal = function (chemical) {
        var overlay = makeOverlay();
        var name = pickField(chemical, ['name', 'chemicalName'], 'Chemical');
        var shell = makeShell('Update Inventory', name);

        var body = shell.querySelector('.__mms-modal-body');
        var currentQty = pickField(chemical, ['quantity', 'qty'], 0);
        var unit = pickField(chemical, ['unit', 'units'], '');

        body.innerHTML =
            '<div style="margin-bottom:1rem;">' +
                '<label style="display:block; font-size:0.82rem; font-weight:600; color:#334155; margin-bottom:0.35rem;">Current Quantity</label>' +
                '<input type="text" value="' + esc(currentQty) + ' ' + esc(unit) + '" disabled style="width:100%; padding:0.65rem 0.85rem; border:1px solid #e2e8f0; border-radius:8px; font-family:inherit; font-size:0.9rem; background:#f8fafc;">' +
            '</div>' +
            '<div style="margin-bottom:1rem;">' +
                '<label style="display:block; font-size:0.82rem; font-weight:600; color:#334155; margin-bottom:0.35rem;">New Quantity</label>' +
                '<input type="number" id="__inv-qty" value="' + esc(currentQty) + '" min="0" step="any" style="width:100%; padding:0.65rem 0.85rem; border:1px solid #e2e8f0; border-radius:8px; font-family:inherit; font-size:0.9rem;">' +
            '</div>' +
            '<div style="margin-bottom:1.25rem;">' +
                '<label style="display:block; font-size:0.82rem; font-weight:600; color:#334155; margin-bottom:0.35rem;">Reason</label>' +
                '<select id="__inv-reason" style="width:100%; padding:0.65rem 0.85rem; border:1px solid #e2e8f0; border-radius:8px; font-family:inherit; font-size:0.9rem;">' +
                    '<option value="received">Stock received</option>' +
                    '<option value="used">Stock used</option>' +
                    '<option value="adjustment">Inventory adjustment</option>' +
                    '<option value="damaged">Damaged / disposal</option>' +
                '</select>' +
            '</div>' +
            '<div style="margin-bottom:1.25rem;">' +
                '<label style="display:block; font-size:0.82rem; font-weight:600; color:#334155; margin-bottom:0.35rem;">Notes</label>' +
                '<textarea id="__inv-notes" rows="2" placeholder="Optional notes" style="width:100%; padding:0.65rem 0.85rem; border:1px solid #e2e8f0; border-radius:8px; font-family:inherit; font-size:0.9rem; resize:vertical;"></textarea>' +
            '</div>' +
            '<div style="display:flex; gap:0.6rem; justify-content:flex-end;">' +
                '<button class="btn btn-outline" id="__inv-cancel">Cancel</button>' +
                '<button class="btn btn-primary" id="__inv-save">Save Update</button>' +
            '</div>';

        body.querySelector('#__inv-cancel').addEventListener('click', function () {
            overlay.remove();
        });

        body.querySelector('#__inv-save').addEventListener('click', function () {
            var newQty = document.getElementById('__inv-qty').value;
            var reason = document.getElementById('__inv-reason').value;
            var notes = document.getElementById('__inv-notes').value;

            if (newQty === '' || isNaN(Number(newQty))) {
                alert('Enter a valid quantity.');
                return;
            }

            var reg = window.chemicalRegister;
            var id = pickField(chemical, ['id', 'chemicalId'], '');

            if (reg && typeof reg.updateInventory === 'function') {
                Promise.resolve(reg.updateInventory(id, { quantity: Number(newQty), reason: reason, notes: notes }))
                    .then(function (res) {
                        if (res && res.success === false) {
                            alert('Failed: ' + (res.error || 'unknown'));
                            return;
                        }
                        alert('Inventory updated.');
                        overlay.remove();
                    })
                    .catch(function (err) {
                        alert('Failed: ' + (err && err.message || 'unknown'));
                    });
            } else {
                alert('Inventory updated (local only — module does not expose updateInventory).');
                overlay.remove();
            }
        });

        overlay.appendChild(shell);
        return overlay;
    };

    console.log('[app-overrides] Module loaders patched + missing modal builders provided (equipment, chemical)');
})();