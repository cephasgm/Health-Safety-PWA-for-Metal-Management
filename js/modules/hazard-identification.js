/* ═══════════════════════════════════════════════════════════════
   hazard-identification.js
   ISO 45001:2018 Clause 6.1.2 — Hazard identification and
   assessment of risks and opportunities

   Features:
     - Hazard register (CRUD, real Firestore)
     - JHA / JSA builder with task breakdown
     - Hierarchy of controls (elimination → PPE)
     - Likelihood × Severity risk scoring
     - Residual risk comparison (before vs after controls)
     - LOTOTO procedure sub-module
     - Metal-industry JHA templates
     - Zero mock data. Empty state when nothing exists.

   Firestore collections:
     - hazards
     - lototo_procedures

   Auto-binds to #hazardModal in dashboard.html via MutationObserver.
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

const HAZARD_TYPES = [
    'Physical',
    'Chemical',
    'Biological',
    'Ergonomic',
    'Psychosocial',
    'Mechanical',
    'Electrical',
    'Thermal',
    'Radiation',
    'Environmental'
];

const CONTROL_HIERARCHY = [
    { key: 'elimination',    label: 'Elimination',    rank: 1, desc: 'Physically remove the hazard' },
    { key: 'substitution',   label: 'Substitution',   rank: 2, desc: 'Replace with a safer alternative' },
    { key: 'engineering',    label: 'Engineering',    rank: 3, desc: 'Isolate people from the hazard' },
    { key: 'administrative', label: 'Administrative', rank: 4, desc: 'Change the way people work' },
    { key: 'ppe',            label: 'PPE',            rank: 5, desc: 'Protect the worker with equipment' }
];

const STATUS_OPTIONS = ['Open', 'In Progress', 'Controlled', 'Closed'];

const METAL_JHA_TEMPLATES = [
    {
        id: 'molten-metal',
        title: 'Molten Metal Handling',
        task: 'Transporting and pouring molten metal',
        hazard_type: 'Thermal',
        description: 'Exposure to molten metal during transfer and pouring operations',
        likelihood: 4, severity: 5,
        controls: {
            elimination: 'Use enclosed transfer systems where metallurgically viable',
            substitution: 'Reduce pour temperature where process allows',
            engineering: 'Guard curtains, splash shields, moisture-detection sensors before charging',
            administrative: 'Written SOP, exclusion zones during pour, 2-person rule, PPE verification',
            ppe: 'Aluminised suit, face shield, heat-resistant gloves, safety boots'
        },
        residual_likelihood: 2, residual_severity: 5
    },
    {
        id: 'crane-lift',
        title: 'Overhead Crane / Heavy Lift',
        task: 'Lifting metal coils or plates with overhead crane',
        hazard_type: 'Mechanical',
        description: 'Load drop, swinging load, rigging failure during crane operations',
        likelihood: 4, severity: 5,
        controls: {
            elimination: 'Mechanical handling system (conveyor) instead of crane where feasible',
            substitution: 'Lighter loads, smaller coils where process allows',
            engineering: 'Load limiters, anti-sway systems, coil tag verification, cameras',
            administrative: 'Rigging inspection schedule, lift plan >5T, banksman, exclusion under load',
            ppe: 'Hard hat, safety boots, high-vis, gloves'
        },
        residual_likelihood: 2, residual_severity: 5
    },
    {
        id: 'confined-space',
        title: 'Confined Space Entry',
        task: 'Entry into tanks, vessels, or pits for maintenance',
        hazard_type: 'Physical',
        description: 'Atmospheric hazards, engulfment, or entrapment during confined space work',
        likelihood: 3, severity: 5,
        controls: {
            elimination: 'Perform work from outside using remote tools',
            substitution: 'Robotic inspection where technology permits',
            engineering: 'Forced ventilation, continuous atmospheric monitoring',
            administrative: 'Permit-to-work, standby person, entry log, rescue plan rehearsed',
            ppe: 'SCBA/airline as required, harness, tripod, multi-gas detector'
        },
        residual_likelihood: 1, residual_severity: 5
    },
    {
        id: 'chemical-pickling',
        title: 'Acid Pickling / Surface Treatment',
        task: 'Immersion of metal in acid baths',
        hazard_type: 'Chemical',
        description: 'Chemical burns, acid mist, reaction splashes during pickling',
        likelihood: 3, severity: 4,
        controls: {
            elimination: 'Mechanical surface prep (shot blasting) where possible',
            substitution: 'Less hazardous acid formulations',
            engineering: 'Local exhaust ventilation, splash guards, emergency showers/eyewash',
            administrative: 'Chemical handling training, SDS register, buddy system, no lone work',
            ppe: 'Acid-resistant apron, face shield, chemical gloves, respirator'
        },
        residual_likelihood: 2, residual_severity: 4
    },
    {
        id: 'machine-guarding',
        title: 'Machine Operation (Press, Shear, Guillotine)',
        task: 'Operating power presses and shears',
        hazard_type: 'Mechanical',
        description: 'Amputation, crush injuries, entanglement from unguarded machinery',
        likelihood: 4, severity: 5,
        controls: {
            elimination: 'Automated material feed removes hand exposure',
            substitution: 'Less hazardous forming processes where applicable',
            engineering: 'Two-hand controls, light curtains, interlocked guards, LOTO before service',
            administrative: 'Pre-use inspection, trained operators only, no loose clothing/jewellery',
            ppe: 'Safety glasses, safety boots; gloves only where machine-spec permits'
        },
        residual_likelihood: 1, residual_severity: 5
    },
    {
        id: 'forklift',
        title: 'Forklift Operations',
        task: 'Movement of metal stock in warehouse or yard',
        hazard_type: 'Mechanical',
        description: 'Pedestrian strikes, tip-overs, load drops during forklift movement',
        likelihood: 4, severity: 4,
        controls: {
            elimination: 'Segregate pedestrian and vehicle traffic routes fully',
            substitution: 'Smaller loads moved more frequently',
            engineering: 'Speed limiters, blue safety lights, cameras, proximity alarms',
            administrative: 'Licensed operators only, pre-shift checklists, designated walkways',
            ppe: 'High-vis vest, safety boots, hard hat'
        },
        residual_likelihood: 2, residual_severity: 4
    },
    {
        id: 'fall-height',
        title: 'Working at Height',
        task: 'Maintenance on roof, crane gantry, or mezzanine',
        hazard_type: 'Physical',
        description: 'Fall from height, falling objects, fragile surface failure',
        likelihood: 3, severity: 5,
        controls: {
            elimination: 'Ground-level access where possible',
            substitution: 'Drones or remote cameras for inspection tasks',
            engineering: 'Guardrails, anchor points, skylight covers, fixed platforms',
            administrative: 'Working-at-height permit, rescue plan, weather monitoring',
            ppe: 'Full-body harness, lanyard, helmet with chin strap'
        },
        residual_likelihood: 1, residual_severity: 5
    }
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

function getRiskLevel(score) {
    const s = Number(score) || 0;
    if (s <= 4)  return { label: 'Low',       cls: 'risk-low',        text: '#065f46' };
    if (s <= 9)  return { label: 'Medium',    cls: 'risk-medium',     text: '#92400e' };
    if (s <= 14) return { label: 'High',      cls: 'risk-high',       text: '#9a3412' };
    if (s <= 19) return { label: 'Very High', cls: 'risk-very-high',  text: '#991b1b' };
    return { label: 'Extreme', cls: 'risk-extreme', text: '#7f1d1d' };
}

function statusChip(status) {
    const cls =
        status === 'Closed'      ? 'status-compliant' :
        status === 'Controlled'  ? 'status-compliant' :
        status === 'In Progress' ? 'status-inprogress' :
        status === 'Open'        ? 'status-pending' :
                                   'status-pending';
    return `<span class="standard-status ${cls}">${escapeHtml(status)}</span>`;
}

// ═══════════════════════════════════════════════════════════════
// MANAGER
// ═══════════════════════════════════════════════════════════════

class HazardManager {
    constructor() {
        this.COLLECTION = 'hazards';
        this.LOTOTO_COLLECTION = 'lototo_procedures';
    }

    async list() {
        const q = query(collection(db, this.COLLECTION), orderBy('created_at', 'desc'));
        const snap = await getDocs(q);
        const items = [];
        snap.forEach(d => items.push({ id: d.id, ...d.data() }));
        return items;
    }

    async get(id) {
        // No separate get — call list and filter in memory
        const items = await this.list();
        return items.find(x => x.id === id) || null;
    }

    async create(data) {
        const likelihood = Number(data.likelihood) || 1;
        const severity = Number(data.severity) || 1;
        const initialScore = likelihood * severity;

        const resL = Number(data.residual_likelihood) || 0;
        const resS = Number(data.residual_severity) || 0;
        const residualScore = (resL && resS) ? resL * resS : null;

        const id = 'HAZ-' + Date.now();
        const record = {
            id,
            title: data.title || 'Untitled hazard',
            task: data.task || '',
            location: data.location || '',
            hazard_type: data.hazard_type || '',
            description: data.description || '',
            likelihood,
            severity,
            risk_score: initialScore,
            risk_level: getRiskLevel(initialScore).label,
            controls: data.controls || {
                elimination: '', substitution: '', engineering: '',
                administrative: '', ppe: ''
            },
            residual_likelihood: resL || null,
            residual_severity: resS || null,
            residual_risk_score: residualScore,
            residual_risk_level: residualScore != null ? getRiskLevel(residualScore).label : null,
            status: data.status || 'Open',
            owner: data.owner || (window.mmsCurrentUser?.email || ''),
            review_date: data.review_date || '',
            created_at: serverTimestamp(),
            created_by: window.mmsCurrentUser?.email || 'unknown',
            updated_at: serverTimestamp()
        };

        await setDoc(doc(db, this.COLLECTION, id), record);
        return { success: true, hazard: record };
    }

    async update(id, data) {
        const likelihood = Number(data.likelihood) || 1;
        const severity = Number(data.severity) || 1;
        const initialScore = likelihood * severity;

        const resL = Number(data.residual_likelihood) || 0;
        const resS = Number(data.residual_severity) || 0;
        const residualScore = (resL && resS) ? resL * resS : null;

        const patch = {
            title: data.title || 'Untitled hazard',
            task: data.task || '',
            location: data.location || '',
            hazard_type: data.hazard_type || '',
            description: data.description || '',
            likelihood,
            severity,
            risk_score: initialScore,
            risk_level: getRiskLevel(initialScore).label,
            controls: data.controls || {},
            residual_likelihood: resL || null,
            residual_severity: resS || null,
            residual_risk_score: residualScore,
            residual_risk_level: residualScore != null ? getRiskLevel(residualScore).label : null,
            status: data.status || 'Open',
            owner: data.owner || '',
            review_date: data.review_date || '',
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

    async listLototo() {
        const q = query(collection(db, this.LOTOTO_COLLECTION), orderBy('created_at', 'desc'));
        const snap = await getDocs(q);
        const items = [];
        snap.forEach(d => items.push({ id: d.id, ...d.data() }));
        return items;
    }

    async createLototo(data) {
        const id = 'LOTO-' + Date.now();
        const record = {
            id,
            equipment: data.equipment || '',
            location: data.location || '',
            energy_sources: data.energy_sources || [],
            isolation_points: data.isolation_points || '',
            verification_steps: data.verification_steps || '',
            lock_type: data.lock_type || '',
            tag_info: data.tag_info || '',
            authorized_by: data.authorized_by || '',
            review_date: data.review_date || '',
            created_at: serverTimestamp(),
            created_by: window.mmsCurrentUser?.email || 'unknown'
        };
        await setDoc(doc(db, this.LOTOTO_COLLECTION, id), record);
        return { success: true, procedure: record };
    }

    async removeLototo(id) {
        await deleteDoc(doc(db, this.LOTOTO_COLLECTION, id));
        return { success: true };
    }
}

const hazardManager = new HazardManager();

// ═══════════════════════════════════════════════════════════════
// UI RENDERERS
// ═══════════════════════════════════════════════════════════════

let currentTab = 'register'; // 'register' | 'lototo'
let currentView = 'list';    // 'list' | 'detail' | 'form'
let currentHazardId = null;
let cachedHazards = [];
let cachedLototo = [];

async function renderHazardModule() {
    const host = document.getElementById('hazardContent');
    if (!host) return;

    if (!isSignedIn()) {
        host.innerHTML = `<div style="padding:3rem; text-align:center; color:#64748b;">Sign in to access the hazard register.</div>`;
        return;
    }

    host.innerHTML = `<div style="padding:3rem; text-align:center; color:#64748b;">Loading…</div>`;

    try {
        cachedHazards = await hazardManager.list();
        cachedLototo  = await hazardManager.listLototo();
    } catch (err) {
        console.error('[hazard] Load failed:', err);
        host.innerHTML = `<div style="padding:3rem; text-align:center; color:#991b1b;">
            <div style="font-size:2.5rem; margin-bottom:0.5rem;">⚠️</div>
            <div style="font-weight:600;">Could not load hazard data</div>
            <div style="font-size:0.85rem; margin-top:0.35rem;">${escapeHtml(err.code || err.message)}</div>
        </div>`;
        return;
    }

    if (currentView === 'list')    return renderListView(host);
    if (currentView === 'detail')  return renderDetailView(host);
    if (currentView === 'form')    return renderFormView(host);
}

function renderListView(host) {
    const hazards = cachedHazards;
    const lototo  = cachedLototo;

    // Stats
    const total = hazards.length;
    const high = hazards.filter(h => h.risk_level === 'High' || h.risk_level === 'Very High' || h.risk_level === 'Extreme').length;
    const open = hazards.filter(h => h.status === 'Open' || h.status === 'In Progress').length;

    const tabsHtml = `
        <div class="tab-buttons" style="margin-bottom:1.25rem;">
            <button class="tab-button ${currentTab === 'register' ? 'active' : ''}"
                    onclick="window.__hzSwitchTab('register')">Hazard Register</button>
            <button class="tab-button ${currentTab === 'lototo' ? 'active' : ''}"
                    onclick="window.__hzSwitchTab('lototo')">LOTOTO Procedures</button>
        </div>
    `;

    let statsHtml = `
        <div style="display:grid; grid-template-columns:repeat(auto-fit,minmax(150px,1fr)); gap:0.75rem; margin-bottom:1.25rem;">
            <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:12px; padding:1rem 1.15rem;">
                <div style="font-size:1.6rem; font-weight:800; color:#0f172a; line-height:1;">${total}</div>
                <div style="font-size:0.72rem; color:#64748b; text-transform:uppercase; letter-spacing:0.4px; margin-top:0.35rem; font-weight:600;">Total Hazards</div>
            </div>
            <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:12px; padding:1rem 1.15rem;">
                <div style="font-size:1.6rem; font-weight:800; color:${high > 0 ? '#dc2626' : '#0f172a'}; line-height:1;">${high}</div>
                <div style="font-size:0.72rem; color:#64748b; text-transform:uppercase; letter-spacing:0.4px; margin-top:0.35rem; font-weight:600;">High+ Risk</div>
            </div>
            <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:12px; padding:1rem 1.15rem;">
                <div style="font-size:1.6rem; font-weight:800; color:#0f172a; line-height:1;">${open}</div>
                <div style="font-size:0.72rem; color:#64748b; text-transform:uppercase; letter-spacing:0.4px; margin-top:0.35rem; font-weight:600;">Open / In Progress</div>
            </div>
            <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:12px; padding:1rem 1.15rem;">
                <div style="font-size:1.6rem; font-weight:800; color:#0f172a; line-height:1;">${lototo.length}</div>
                <div style="font-size:0.72rem; color:#64748b; text-transform:uppercase; letter-spacing:0.4px; margin-top:0.35rem; font-weight:600;">LOTOTO Procedures</div>
            </div>
        </div>
    `;

    if (currentTab === 'register') {
        host.innerHTML = tabsHtml + statsHtml + renderHazardTable(hazards);
    } else {
        host.innerHTML = tabsHtml + statsHtml + renderLototoTable(lototo);
    }
}

function renderHazardTable(hazards) {
    const headerHtml = `
        <div style="display:flex; justify-content:space-between; align-items:center; gap:1rem; margin-bottom:1rem; flex-wrap:wrap;">
            <div>
                <div style="font-weight:700; font-size:0.95rem;">Hazard Register</div>
                <div style="font-size:0.78rem; color:#64748b; margin-top:0.15rem;">ISO 45001 Clause 6.1.2 — identified hazards and their controls</div>
            </div>
            <button class="btn btn-primary" onclick="window.__hzNewHazard()">+ New JHA/JSA Assessment</button>
        </div>
    `;

    if (hazards.length === 0) {
        return headerHtml + `
            <div style="text-align:center; padding:3rem 1rem; color:#64748b; border:1px dashed #cbd5e1; border-radius:12px;">
                <div style="font-size:3rem; margin-bottom:0.75rem;">⚠️</div>
                <div style="font-weight:600; color:#0f172a; margin-bottom:0.35rem;">No hazards identified yet</div>
                <div style="font-size:0.9rem; max-width:420px; margin:0 auto;">Start by running a JHA/JSA for a task at your site. Use one of the built-in metal-industry templates to save time.</div>
                <button class="btn btn-primary" style="margin-top:1.25rem;" onclick="window.__hzNewHazard()">+ New Assessment</button>
            </div>
        `;
    }

    const rows = hazards.map(h => {
        const riskBadge = `<span class="standard-status ${getRiskLevel(h.risk_score).cls === 'risk-low' ? 'status-compliant' : getRiskLevel(h.risk_score).cls === 'risk-medium' ? 'status-pending' : 'status-noncompliant'}">${escapeHtml(h.risk_level || '—')}</span>`;
        const residualBadge = h.residual_risk_level
            ? `<span class="standard-status ${getRiskLevel(h.residual_risk_score).cls === 'risk-low' ? 'status-compliant' : getRiskLevel(h.residual_risk_score).cls === 'risk-medium' ? 'status-pending' : 'status-noncompliant'}">${escapeHtml(h.residual_risk_level)}</span>`
            : '<span style="font-size:0.78rem; color:#94a3b8;">Not set</span>';

        return `<tr style="cursor:pointer;" onclick="window.__hzOpenHazard('${escapeHtml(h.id)}')">
            <td style="font-family:monospace; font-size:0.72rem;">${escapeHtml(h.id)}</td>
            <td>
                <div style="font-weight:600;">${escapeHtml(h.title)}</div>
                ${h.task ? `<div style="font-size:0.72rem; color:#94a3b8;">${escapeHtml(h.task)}</div>` : ''}
            </td>
            <td style="font-size:0.82rem;">${escapeHtml(h.location || '—')}</td>
            <td style="font-size:0.78rem;">${escapeHtml(h.hazard_type || '—')}</td>
            <td style="text-align:center;">
                <div style="font-weight:700; color:${getRiskLevel(h.risk_score).text};">${h.risk_score || 0}</div>
                <div style="font-size:0.68rem; color:#94a3b8;">L${h.likelihood} × S${h.severity}</div>
            </td>
            <td style="text-align:center;">
                ${h.residual_risk_score
                    ? `<div style="font-weight:700; color:${getRiskLevel(h.residual_risk_score).text};">${h.residual_risk_score}</div>`
                    : '<span style="color:#94a3b8; font-size:0.78rem;">—</span>'}
            </td>
            <td>${statusChip(h.status)}</td>
        </tr>`;
    }).join('');

    return headerHtml + `
        <div style="overflow-x:auto;">
            <table class="data-table">
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>Hazard / Task</th>
                        <th>Location</th>
                        <th>Type</th>
                        <th>Initial Risk</th>
                        <th>Residual</th>
                        <th>Status</th>
                    </tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>
        </div>
    `;
}

function renderLototoTable(procedures) {
    const headerHtml = `
        <div style="display:flex; justify-content:space-between; align-items:center; gap:1rem; margin-bottom:1rem; flex-wrap:wrap;">
            <div>
                <div style="font-weight:700; font-size:0.95rem;">LOTOTO Procedures</div>
                <div style="font-size:0.78rem; color:#64748b; margin-top:0.15rem;">Lockout / Tagout / Tryout — isolation procedures for hazardous energy</div>
            </div>
            <button class="btn btn-primary" onclick="window.__hzNewLototo()">+ New LOTOTO Procedure</button>
        </div>
    `;

    if (procedures.length === 0) {
        return headerHtml + `
            <div style="text-align:center; padding:3rem 1rem; color:#64748b; border:1px dashed #cbd5e1; border-radius:12px;">
                <div style="font-size:3rem; margin-bottom:0.75rem;">🔒</div>
                <div style="font-weight:600; color:#0f172a; margin-bottom:0.35rem;">No LOTOTO procedures yet</div>
                <div style="font-size:0.9rem; max-width:420px; margin:0 auto;">Document lockout/tagout/tryout procedures for equipment with hazardous energy sources — presses, conveyors, drives, and hydraulic systems.</div>
                <button class="btn btn-primary" style="margin-top:1.25rem;" onclick="window.__hzNewLototo()">+ New Procedure</button>
            </div>
        `;
    }

    const rows = procedures.map(p => `
        <tr style="cursor:pointer;" onclick="window.__hzViewLototo('${escapeHtml(p.id)}')">
            <td style="font-family:monospace; font-size:0.72rem;">${escapeHtml(p.id)}</td>
            <td style="font-weight:600;">${escapeHtml(p.equipment || '—')}</td>
            <td style="font-size:0.82rem;">${escapeHtml(p.location || '—')}</td>
            <td style="font-size:0.78rem;">${(p.energy_sources || []).map(s => escapeHtml(s)).join(', ') || '—'}</td>
            <td style="font-size:0.78rem;">${escapeHtml(p.review_date || '—')}</td>
        </tr>
    `).join('');

    return headerHtml + `
        <div style="overflow-x:auto;">
            <table class="data-table">
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>Equipment</th>
                        <th>Location</th>
                        <th>Energy Sources</th>
                        <th>Review Date</th>
                    </tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>
        </div>
    `;
}

function renderDetailView(host) {
    const h = cachedHazards.find(x => x.id === currentHazardId);
    if (!h) {
        currentView = 'list';
        return renderHazardModule();
    }

    const controlsHtml = CONTROL_HIERARCHY.map(c => {
        const value = h.controls && h.controls[c.key];
        if (!value) return '';
        return `
            <div style="margin-bottom:0.85rem; padding:0.85rem 1rem; background:#f8fafc; border-radius:10px; border-left:3px solid #dc2626;">
                <div style="font-weight:700; font-size:0.82rem; color:#0f172a; margin-bottom:0.25rem;">
                    ${c.rank}. ${c.label}
                </div>
                <div style="font-size:0.87rem; color:#475569; line-height:1.55;">${escapeHtml(value)}</div>
            </div>
        `;
    }).join('') || '<div style="color:#94a3b8; font-size:0.85rem; padding:1rem 0;">No controls documented.</div>';

    const initialRisk = getRiskLevel(h.risk_score);
    const residualRisk = h.residual_risk_score != null ? getRiskLevel(h.residual_risk_score) : null;

    host.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; gap:1rem; margin-bottom:1.25rem; flex-wrap:wrap;">
            <button class="btn btn-outline btn-sm" onclick="window.__hzBackToList()">← Back to Register</button>
            <div style="display:flex; gap:0.5rem;">
                <button class="btn btn-outline btn-sm" onclick="window.__hzEditHazard('${escapeHtml(h.id)}')">✏️ Edit</button>
                ${isAdmin() ? `<button class="btn btn-danger btn-sm" onclick="window.__hzDeleteHazard('${escapeHtml(h.id)}')">🗑️ Delete</button>` : ''}
            </div>
        </div>

        <div style="margin-bottom:1.5rem;">
            <div style="font-family:monospace; font-size:0.75rem; color:#94a3b8; margin-bottom:0.25rem;">${escapeHtml(h.id)}</div>
            <h3 style="font-size:1.25rem; font-weight:700; color:#0f172a; margin-bottom:0.5rem;">${escapeHtml(h.title)}</h3>
            <div style="display:flex; gap:0.75rem; flex-wrap:wrap; font-size:0.82rem; color:#64748b;">
                ${h.location ? `<span>📍 ${escapeHtml(h.location)}</span>` : ''}
                ${h.hazard_type ? `<span>🏷️ ${escapeHtml(h.hazard_type)}</span>` : ''}
                ${h.task ? `<span>🔧 ${escapeHtml(h.task)}</span>` : ''}
            </div>
        </div>

        <div style="display:grid; grid-template-columns:1fr 1fr; gap:1rem; margin-bottom:1.5rem;">
            <div style="padding:1.25rem; border:1px solid #e2e8f0; border-radius:12px;">
                <div style="font-size:0.72rem; text-transform:uppercase; letter-spacing:0.5px; color:#64748b; font-weight:700; margin-bottom:0.5rem;">Initial Risk</div>
                <div style="font-size:2rem; font-weight:800; color:${initialRisk.text}; line-height:1;">${h.risk_score}</div>
                <div style="font-size:0.85rem; color:${initialRisk.text}; font-weight:600; margin-top:0.25rem;">${initialRisk.label}</div>
                <div style="font-size:0.78rem; color:#94a3b8; margin-top:0.5rem;">Likelihood ${h.likelihood} × Severity ${h.severity}</div>
            </div>
            <div style="padding:1.25rem; border:1px solid #e2e8f0; border-radius:12px;">
                <div style="font-size:0.72rem; text-transform:uppercase; letter-spacing:0.5px; color:#64748b; font-weight:700; margin-bottom:0.5rem;">Residual Risk</div>
                ${residualRisk
                    ? `<div style="font-size:2rem; font-weight:800; color:${residualRisk.text}; line-height:1;">${h.residual_risk_score}</div>
                       <div style="font-size:0.85rem; color:${residualRisk.text}; font-weight:600; margin-top:0.25rem;">${residualRisk.label}</div>
                       <div style="font-size:0.78rem; color:#94a3b8; margin-top:0.5rem;">Likelihood ${h.residual_likelihood} × Severity ${h.residual_severity}</div>`
                    : `<div style="font-size:0.85rem; color:#94a3b8;">Not yet assessed</div>`}
            </div>
        </div>

        ${h.description ? `
            <div style="margin-bottom:1.5rem;">
                <div style="font-size:0.72rem; text-transform:uppercase; letter-spacing:0.5px; color:#64748b; font-weight:700; margin-bottom:0.5rem;">Description</div>
                <div style="font-size:0.9rem; color:#334155; line-height:1.6;">${escapeHtml(h.description)}</div>
            </div>
        ` : ''}

        <div style="margin-bottom:1.5rem;">
            <div style="font-size:0.72rem; text-transform:uppercase; letter-spacing:0.5px; color:#64748b; font-weight:700; margin-bottom:0.75rem;">Hierarchy of Controls</div>
            ${controlsHtml}
        </div>

        <div style="display:grid; grid-template-columns:repeat(auto-fit,minmax(180px,1fr)); gap:0.75rem; font-size:0.82rem; color:#64748b; padding-top:1.25rem; border-top:1px solid #e2e8f0;">
            <div><strong style="color:#0f172a;">Status:</strong> ${statusChip(h.status)}</div>
            ${h.owner ? `<div><strong style="color:#0f172a;">Owner:</strong> ${escapeHtml(h.owner)}</div>` : ''}
            ${h.review_date ? `<div><strong style="color:#0f172a;">Review:</strong> ${escapeHtml(h.review_date)}</div>` : ''}
            ${h.created_by ? `<div><strong style="color:#0f172a;">Created by:</strong> ${escapeHtml(h.created_by)}</div>` : ''}
        </div>
    `;
}

function renderFormView(host) {
    const editing = !!currentHazardId;
    const h = editing ? (cachedHazards.find(x => x.id === currentHazardId) || {}) : {};

    const templateOptions = METAL_JHA_TEMPLATES.map(t =>
        `<option value="${escapeHtml(t.id)}">${escapeHtml(t.title)}</option>`
    ).join('');

    const controlsHtml = CONTROL_HIERARCHY.map(c => `
        <div class="form-group">
            <label>${c.rank}. ${c.label} <span style="font-weight:400; color:#94a3b8; font-size:0.78rem;">— ${c.desc}</span></label>
            <textarea id="hz-ctrl-${c.key}" rows="2" placeholder="Describe controls at this level…">${escapeHtml((h.controls && h.controls[c.key]) || '')}</textarea>
        </div>
    `).join('');

    host.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; gap:1rem; margin-bottom:1.25rem; flex-wrap:wrap;">
            <button class="btn btn-outline btn-sm" onclick="window.__hzBackToList()">← Back</button>
            <div style="font-weight:700; font-size:0.95rem;">${editing ? 'Edit Hazard Assessment' : 'New Hazard Assessment (JHA/JSA)'}</div>
        </div>

        ${!editing ? `
            <div class="form-group" style="background:#eff6ff; padding:1rem 1.15rem; border-radius:10px; border:1px solid #bfdbfe; margin-bottom:1.25rem;">
                <label style="color:#1e40af;">⚡ Load a Metal-Industry Template (optional)</label>
                <select id="hz-template" onchange="window.__hzLoadTemplate(this.value)" style="margin-top:0.35rem;">
                    <option value="">— Start from scratch —</option>
                    ${templateOptions}
                </select>
                <div style="font-size:0.78rem; color:#1e40af; margin-top:0.35rem;">Loads a pre-filled JHA for a common metal-handling task. You can edit every field afterwards.</div>
            </div>
        ` : ''}

        <div class="form-row">
            <div class="form-group">
                <label>Hazard Title *</label>
                <input type="text" id="hz-title" value="${escapeHtml(h.title || '')}" placeholder="e.g., Forklift-pedestrian collision in Yard B">
            </div>
            <div class="form-group">
                <label>Hazard Type</label>
                <select id="hz-type">
                    <option value="">Select type</option>
                    ${HAZARD_TYPES.map(t => `<option value="${t}" ${h.hazard_type === t ? 'selected' : ''}>${t}</option>`).join('')}
                </select>
            </div>
        </div>

        <div class="form-row">
            <div class="form-group">
                <label>Location *</label>
                <input type="text" id="hz-location" value="${escapeHtml(h.location || '')}" placeholder="e.g., Cape Town HQ — Yard B">
            </div>
            <div class="form-group">
                <label>Task / Activity</label>
                <input type="text" id="hz-task" value="${escapeHtml(h.task || '')}" placeholder="e.g., Loading steel coils onto flatbed">
            </div>
        </div>

        <div class="form-group">
            <label>Description</label>
            <textarea id="hz-description" rows="2" placeholder="Describe the hazard and how exposure could occur…">${escapeHtml(h.description || '')}</textarea>
        </div>

        <div style="margin:1.5rem 0 1rem; padding-top:1.25rem; border-top:1px solid #e2e8f0;">
            <div style="font-weight:700; font-size:0.92rem; color:#0f172a; margin-bottom:0.75rem;">Initial Risk (before controls)</div>
            <div class="form-row">
                <div class="form-group">
                    <label>Likelihood (1–5)</label>
                    <select id="hz-likelihood" onchange="window.__hzUpdateRiskPreview()">
                        ${[1,2,3,4,5].map(n => `<option value="${n}" ${(h.likelihood || 3) == n ? 'selected' : ''}>${n} — ${['Rare','Unlikely','Possible','Likely','Almost Certain'][n-1]}</option>`).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label>Severity (1–5)</label>
                    <select id="hz-severity" onchange="window.__hzUpdateRiskPreview()">
                        ${[1,2,3,4,5].map(n => `<option value="${n}" ${(h.severity || 3) == n ? 'selected' : ''}>${n} — ${['Insignificant','Minor','Moderate','Major','Catastrophic'][n-1]}</option>`).join('')}
                    </select>
                </div>
            </div>
            <div id="hz-initial-preview" style="padding:0.75rem 1rem; border-radius:8px; font-size:0.85rem; font-weight:600; background:#f1f5f9; color:#334155;">
                Initial risk score will appear here
            </div>
        </div>

        <div style="margin:1.5rem 0 1rem; padding-top:1.25rem; border-top:1px solid #e2e8f0;">
            <div style="font-weight:700; font-size:0.92rem; color:#0f172a; margin-bottom:0.5rem;">Hierarchy of Controls</div>
            <div style="font-size:0.78rem; color:#64748b; margin-bottom:1rem;">Document the controls you are applying. Prioritize higher levels (elimination first). Not every level will apply — leave blank if not used.</div>
            ${controlsHtml}
        </div>

        <div style="margin:1.5rem 0 1rem; padding-top:1.25rem; border-top:1px solid #e2e8f0;">
            <div style="font-weight:700; font-size:0.92rem; color:#0f172a; margin-bottom:0.75rem;">Residual Risk (after controls)</div>
            <div class="form-row">
                <div class="form-group">
                    <label>Likelihood (1–5)</label>
                    <select id="hz-residual-likelihood" onchange="window.__hzUpdateRiskPreview()">
                        <option value="">— Not set —</option>
                        ${[1,2,3,4,5].map(n => `<option value="${n}" ${h.residual_likelihood == n ? 'selected' : ''}>${n}</option>`).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label>Severity (1–5)</label>
                    <select id="hz-residual-severity" onchange="window.__hzUpdateRiskPreview()">
                        <option value="">— Not set —</option>
                        ${[1,2,3,4,5].map(n => `<option value="${n}" ${h.residual_severity == n ? 'selected' : ''}>${n}</option>`).join('')}
                    </select>
                </div>
            </div>
            <div id="hz-residual-preview" style="padding:0.75rem 1rem; border-radius:8px; font-size:0.85rem; font-weight:600; background:#f1f5f9; color:#334155;">
                Residual risk score will appear here
            </div>
        </div>

        <div class="form-row" style="margin-top:1.5rem;">
            <div class="form-group">
                <label>Status</label>
                <select id="hz-status">
                    ${STATUS_OPTIONS.map(s => `<option value="${s}" ${(h.status || 'Open') === s ? 'selected' : ''}>${s}</option>`).join('')}
                </select>
            </div>
            <div class="form-group">
                <label>Owner / Responsible</label>
                <input type="text" id="hz-owner" value="${escapeHtml(h.owner || '')}" placeholder="e.g., Safety Officer">
            </div>
        </div>

        <div class="form-group">
            <label>Next Review Date</label>
            <input type="date" id="hz-review-date" value="${escapeHtml(h.review_date || '')}">
        </div>

        <div class="action-buttons">
            <button class="btn btn-primary" onclick="window.__hzSaveHazard()">${editing ? '💾 Save Changes' : '💾 Create Hazard'}</button>
            <button class="btn btn-outline" onclick="window.__hzBackToList()">Cancel</button>
        </div>
    `;

    // Initialize previews
    setTimeout(() => window.__hzUpdateRiskPreview(), 20);
}

// ═══════════════════════════════════════════════════════════════
// WINDOW FUNCTIONS — bound to UI
// ═══════════════════════════════════════════════════════════════

window.__hzSwitchTab = function (tab) {
    currentTab = tab;
    currentView = 'list';
    renderHazardModule();
};

window.__hzBackToList = function () {
    currentView = 'list';
    currentHazardId = null;
    renderHazardModule();
};

window.__hzNewHazard = function () {
    currentHazardId = null;
    currentView = 'form';
    renderHazardModule();
};

window.__hzOpenHazard = function (id) {
    currentHazardId = id;
    currentView = 'detail';
    renderHazardModule();
};

window.__hzEditHazard = function (id) {
    currentHazardId = id;
    currentView = 'form';
    renderHazardModule();
};

window.__hzDeleteHazard = async function (id) {
    if (!confirm('Delete this hazard permanently? This cannot be undone.')) return;
    try {
        await hazardManager.remove(id);
        currentView = 'list';
        currentHazardId = null;
        await renderHazardModule();
    } catch (err) {
        alert('Delete failed: ' + (err.code || err.message));
    }
};

window.__hzUpdateRiskPreview = function () {
    const L = Number((document.getElementById('hz-likelihood') || {}).value) || 0;
    const S = Number((document.getElementById('hz-severity') || {}).value) || 0;
    const RL = Number((document.getElementById('hz-residual-likelihood') || {}).value) || 0;
    const RS = Number((document.getElementById('hz-residual-severity') || {}).value) || 0;

    const initialBox = document.getElementById('hz-initial-preview');
    if (initialBox) {
        if (L && S) {
            const score = L * S;
            const level = getRiskLevel(score);
            initialBox.style.background = level.cls === 'risk-low' ? '#ecfdf5'
                                        : level.cls === 'risk-medium' ? '#fffbeb'
                                        : level.cls === 'risk-high' ? '#fff7ed'
                                        : '#fef2f2';
            initialBox.style.color = level.text;
            initialBox.innerHTML = `Score: <strong>${score}</strong> — ${level.label} Risk`;
        } else {
            initialBox.style.background = '#f1f5f9';
            initialBox.style.color = '#334155';
            initialBox.textContent = 'Initial risk score will appear here';
        }
    }

    const residualBox = document.getElementById('hz-residual-preview');
    if (residualBox) {
        if (RL && RS) {
            const score = RL * RS;
            const level = getRiskLevel(score);
            residualBox.style.background = level.cls === 'risk-low' ? '#ecfdf5'
                                         : level.cls === 'risk-medium' ? '#fffbeb'
                                         : level.cls === 'risk-high' ? '#fff7ed'
                                         : '#fef2f2';
            residualBox.style.color = level.text;
            residualBox.innerHTML = `Score: <strong>${score}</strong> — ${level.label} Risk`;
        } else {
            residualBox.style.background = '#f1f5f9';
            residualBox.style.color = '#334155';
            residualBox.textContent = 'Residual risk score will appear here';
        }
    }
};

window.__hzLoadTemplate = function (templateId) {
    if (!templateId) return;
    const t = METAL_JHA_TEMPLATES.find(x => x.id === templateId);
    if (!t) return;

    document.getElementById('hz-title').value = t.title;
    document.getElementById('hz-type').value = t.hazard_type;
    document.getElementById('hz-task').value = t.task;
    document.getElementById('hz-description').value = t.description;
    document.getElementById('hz-likelihood').value = t.likelihood;
    document.getElementById('hz-severity').value = t.severity;
    document.getElementById('hz-residual-likelihood').value = t.residual_likelihood;
    document.getElementById('hz-residual-severity').value = t.residual_severity;

    CONTROL_HIERARCHY.forEach(c => {
        const el = document.getElementById('hz-ctrl-' + c.key);
        if (el) el.value = t.controls[c.key] || '';
    });

    window.__hzUpdateRiskPreview();
};

window.__hzSaveHazard = async function () {
    const title = (document.getElementById('hz-title') || {}).value?.trim();
    const location = (document.getElementById('hz-location') || {}).value?.trim();

    if (!title) { alert('Hazard title is required.'); return; }
    if (!location) { alert('Location is required.'); return; }

    const controls = {};
    CONTROL_HIERARCHY.forEach(c => {
        const el = document.getElementById('hz-ctrl-' + c.key);
        if (el) controls[c.key] = el.value.trim();
    });

    const data = {
        title,
        location,
        task: (document.getElementById('hz-task') || {}).value?.trim() || '',
        hazard_type: (document.getElementById('hz-type') || {}).value || '',
        description: (document.getElementById('hz-description') || {}).value?.trim() || '',
        likelihood: (document.getElementById('hz-likelihood') || {}).value || 3,
        severity: (document.getElementById('hz-severity') || {}).value || 3,
        controls,
        residual_likelihood: (document.getElementById('hz-residual-likelihood') || {}).value || '',
        residual_severity: (document.getElementById('hz-residual-severity') || {}).value || '',
        status: (document.getElementById('hz-status') || {}).value || 'Open',
        owner: (document.getElementById('hz-owner') || {}).value?.trim() || '',
        review_date: (document.getElementById('hz-review-date') || {}).value || ''
    };

    try {
        if (currentHazardId) {
            await hazardManager.update(currentHazardId, data);
        } else {
            await hazardManager.create(data);
        }
        currentView = 'list';
        currentHazardId = null;
        await renderHazardModule();
    } catch (err) {
        console.error('[hazard] Save failed:', err);
        alert('Save failed: ' + (err.code || err.message));
    }
};

// ─── LOTOTO ───────────────────────────────────────────────────

window.__hzNewLototo = function () {
    const host = document.getElementById('hazardContent');
    if (!host) return;

    const today = new Date().toISOString().slice(0, 10);

    host.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; gap:1rem; margin-bottom:1.25rem;">
            <button class="btn btn-outline btn-sm" onclick="window.__hzBackToList()">← Back</button>
            <div style="font-weight:700; font-size:0.95rem;">New LOTOTO Procedure</div>
        </div>

        <div class="form-group">
            <label>Equipment *</label>
            <input type="text" id="loto-equipment" placeholder="e.g., Hydraulic Press #3">
        </div>
        <div class="form-group">
            <label>Location</label>
            <input type="text" id="loto-location" placeholder="e.g., Fabrication Shop — Bay 4">
        </div>
        <div class="form-group">
            <label>Energy Sources (comma-separated)</label>
            <input type="text" id="loto-energy" placeholder="e.g., Electrical 480V, Hydraulic, Pneumatic, Stored pressure">
        </div>
        <div class="form-group">
            <label>Isolation Points</label>
            <textarea id="loto-points" rows="3" placeholder="List each isolation point in order of operation"></textarea>
        </div>
        <div class="form-group">
            <label>Verification / Tryout Steps</label>
            <textarea id="loto-verify" rows="3" placeholder="How will you verify zero energy state before work begins?"></textarea>
        </div>
        <div class="form-row">
            <div class="form-group">
                <label>Lock Type</label>
                <input type="text" id="loto-lock" placeholder="e.g., Group lock box with individual locks">
            </div>
            <div class="form-group">
                <label>Authorized By</label>
                <input type="text" id="loto-auth" placeholder="Name of authorizing person">
            </div>
        </div>
        <div class="form-row">
            <div class="form-group">
                <label>Tag Information</label>
                <input type="text" id="loto-tag" placeholder="e.g., Red tag — DO NOT OPERATE">
            </div>
            <div class="form-group">
                <label>Next Review Date</label>
                <input type="date" id="loto-review" value="${today}">
            </div>
        </div>

        <div class="action-buttons">
            <button class="btn btn-primary" onclick="window.__hzSaveLototo()">💾 Save Procedure</button>
            <button class="btn btn-outline" onclick="window.__hzBackToList()">Cancel</button>
        </div>
    `;
};

window.__hzSaveLototo = async function () {
    const equipment = (document.getElementById('loto-equipment') || {}).value?.trim();
    if (!equipment) { alert('Equipment is required.'); return; }

    const data = {
        equipment,
        location: (document.getElementById('loto-location') || {}).value?.trim() || '',
        energy_sources: ((document.getElementById('loto-energy') || {}).value || '')
            .split(',').map(s => s.trim()).filter(Boolean),
        isolation_points: (document.getElementById('loto-points') || {}).value?.trim() || '',
        verification_steps: (document.getElementById('loto-verify') || {}).value?.trim() || '',
        lock_type: (document.getElementById('loto-lock') || {}).value?.trim() || '',
        tag_info: (document.getElementById('loto-tag') || {}).value?.trim() || '',
        authorized_by: (document.getElementById('loto-auth') || {}).value?.trim() || '',
        review_date: (document.getElementById('loto-review') || {}).value || ''
    };

    try {
        await hazardManager.createLototo(data);
        currentView = 'list';
        currentTab = 'lototo';
        await renderHazardModule();
    } catch (err) {
        alert('Save failed: ' + (err.code || err.message));
    }
};

window.__hzViewLototo = function (id) {
    const p = cachedLototo.find(x => x.id === id);
    if (!p) return;
    const host = document.getElementById('hazardContent');
    if (!host) return;

    host.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; gap:1rem; margin-bottom:1.25rem; flex-wrap:wrap;">
            <button class="btn btn-outline btn-sm" onclick="window.__hzBackToList()">← Back</button>
            ${isAdmin() ? `<button class="btn btn-danger btn-sm" onclick="window.__hzDeleteLototo('${escapeHtml(p.id)}')">🗑️ Delete</button>` : ''}
        </div>

        <div style="font-family:monospace; font-size:0.75rem; color:#94a3b8; margin-bottom:0.25rem;">${escapeHtml(p.id)}</div>
        <h3 style="font-size:1.2rem; font-weight:700; color:#0f172a; margin-bottom:1.25rem;">${escapeHtml(p.equipment)}</h3>

        <div style="display:grid; gap:1rem;">
            ${p.location ? `<div><div style="font-size:0.72rem; text-transform:uppercase; letter-spacing:0.5px; color:#64748b; font-weight:700; margin-bottom:0.25rem;">Location</div><div style="font-size:0.9rem;">${escapeHtml(p.location)}</div></div>` : ''}
            ${p.energy_sources && p.energy_sources.length ? `<div><div style="font-size:0.72rem; text-transform:uppercase; letter-spacing:0.5px; color:#64748b; font-weight:700; margin-bottom:0.25rem;">Energy Sources</div><div style="font-size:0.9rem;">${p.energy_sources.map(escapeHtml).join(' · ')}</div></div>` : ''}
            ${p.isolation_points ? `<div><div style="font-size:0.72rem; text-transform:uppercase; letter-spacing:0.5px; color:#64748b; font-weight:700; margin-bottom:0.25rem;">Isolation Points</div><div style="font-size:0.9rem; white-space:pre-wrap;">${escapeHtml(p.isolation_points)}</div></div>` : ''}
            ${p.verification_steps ? `<div><div style="font-size:0.72rem; text-transform:uppercase; letter-spacing:0.5px; color:#64748b; font-weight:700; margin-bottom:0.25rem;">Verification / Tryout</div><div style="font-size:0.9rem; white-space:pre-wrap;">${escapeHtml(p.verification_steps)}</div></div>` : ''}
            ${p.lock_type ? `<div><div style="font-size:0.72rem; text-transform:uppercase; letter-spacing:0.5px; color:#64748b; font-weight:700; margin-bottom:0.25rem;">Lock Type</div><div style="font-size:0.9rem;">${escapeHtml(p.lock_type)}</div></div>` : ''}
            ${p.tag_info ? `<div><div style="font-size:0.72rem; text-transform:uppercase; letter-spacing:0.5px; color:#64748b; font-weight:700; margin-bottom:0.25rem;">Tag Info</div><div style="font-size:0.9rem;">${escapeHtml(p.tag_info)}</div></div>` : ''}
            ${p.authorized_by ? `<div><div style="font-size:0.72rem; text-transform:uppercase; letter-spacing:0.5px; color:#64748b; font-weight:700; margin-bottom:0.25rem;">Authorized By</div><div style="font-size:0.9rem;">${escapeHtml(p.authorized_by)}</div></div>` : ''}
            ${p.review_date ? `<div><div style="font-size:0.72rem; text-transform:uppercase; letter-spacing:0.5px; color:#64748b; font-weight:700; margin-bottom:0.25rem;">Next Review</div><div style="font-size:0.9rem;">${escapeHtml(p.review_date)}</div></div>` : ''}
        </div>
    `;
};

window.__hzDeleteLototo = async function (id) {
    if (!confirm('Delete this LOTOTO procedure?')) return;
    try {
        await hazardManager.removeLototo(id);
        currentView = 'list';
        currentTab = 'lototo';
        await renderHazardModule();
    } catch (err) {
        alert('Delete failed: ' + (err.code || err.message));
    }
};

// ═══════════════════════════════════════════════════════════════
// MODAL OBSERVER — auto-render when hazardModal opens
// ═══════════════════════════════════════════════════════════════

function attachHazardObserver() {
    const modal = document.getElementById('hazardModal');
    if (!modal) {
        console.warn('[hazard] hazardModal not found in DOM');
        return;
    }

    if (modal.classList.contains('show')) {
        currentView = 'list';
        currentHazardId = null;
        renderHazardModule();
    }

    const observer = new MutationObserver(() => {
        if (modal.classList.contains('show')) {
            currentView = 'list';
            currentHazardId = null;
            renderHazardModule();
        }
    });
    observer.observe(modal, { attributes: true, attributeFilter: ['class'] });

    console.log('[hazard] Observer attached to #hazardModal');
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', attachHazardObserver);
} else {
    attachHazardObserver();
}

console.log('[hazard-identification] Ready');