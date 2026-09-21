/* ═══════════════════════════════════════════════════════════════
   stakeholder-register.js
   ISO 45001:2018 Clause 4.2 — Understanding the needs and
   expectations of workers and other interested parties

   Features:
     - Interested parties register (CRUD, real Firestore)
     - 7 default stakeholder categories
     - Per-stakeholder: needs, expectations, requirements,
       engagement method, review date, status
     - Filter by category and status
     - Zero mock data. Empty state when nothing exists.

   Firestore collections:
     - stakeholders

   Auto-binds to #stakeholderModal in dashboard.html.
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

const CATEGORIES = [
    { key: 'workers',      label: 'Workers & Employees',   icon: '👷', desc: 'Employees, contractors, sub-contractors' },
    { key: 'regulators',   label: 'Regulators',            icon: '⚖️', desc: 'OSHA, NEMC, labour departments, local authorities' },
    { key: 'customers',    label: 'Customers & Clients',   icon: '🏢', desc: 'Buyers, traders, off-takers' },
    { key: 'suppliers',    label: 'Suppliers & Contractors', icon: '🚚', desc: 'Equipment, chemicals, logistics providers' },
    { key: 'community',    label: 'Local Community',       icon: '🏘️', desc: 'Neighbours, host communities' },
    { key: 'shareholders', label: 'Shareholders & Board',  icon: '📊', desc: 'Owners, investors, executive leadership' },
    { key: 'insurers',     label: 'Insurers & Banks',      icon: '🏦', desc: 'Insurance, finance, credit providers' }
];

const STATUS_OPTIONS = ['Active', 'Under Review', 'Inactive'];

const ENGAGEMENT_METHODS = [
    'Committee meetings',
    'Safety briefings',
    'Written reports',
    'Surveys',
    'Site inspections',
    'Public consultations',
    'Grievance mechanism',
    'Training sessions',
    'Contractual requirements',
    'Annual reviews'
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

function categoryMeta(key) {
    return CATEGORIES.find(c => c.key === key) || { key, label: key || 'Other', icon: '👥' };
}

function statusChip(status) {
    const cls =
        status === 'Active'       ? 'status-compliant' :
        status === 'Under Review' ? 'status-pending' :
        status === 'Inactive'     ? 'status-noncompliant' :
                                    'status-pending';
    return `<span class="standard-status ${cls}">${escapeHtml(status || '—')}</span>`;
}

// ═══════════════════════════════════════════════════════════════
// MANAGER
// ═══════════════════════════════════════════════════════════════

class StakeholderManager {
    constructor() {
        this.COLLECTION = 'stakeholders';
    }

    async list() {
        const q = query(collection(db, this.COLLECTION), orderBy('created_at', 'desc'));
        const snap = await getDocs(q);
        const items = [];
        snap.forEach(d => items.push({ id: d.id, ...d.data() }));
        return items;
    }

    async create(data) {
        const id = 'STK-' + Date.now();
        const record = {
            id,
            name: data.name || 'Unnamed stakeholder',
            category: data.category || 'workers',
            contact_person: data.contact_person || '',
            contact_email: data.contact_email || '',
            contact_phone: data.contact_phone || '',
            needs: data.needs || '',
            expectations: data.expectations || '',
            requirements: data.requirements || '',
            engagement_method: data.engagement_method || '',
            engagement_frequency: data.engagement_frequency || '',
            status: data.status || 'Active',
            owner: data.owner || (window.mmsCurrentUser?.email || ''),
            review_date: data.review_date || '',
            notes: data.notes || '',
            created_at: serverTimestamp(),
            created_by: window.mmsCurrentUser?.email || 'unknown',
            updated_at: serverTimestamp()
        };

        await setDoc(doc(db, this.COLLECTION, id), record);
        return { success: true, stakeholder: record };
    }

    async update(id, data) {
        const patch = {
            name: data.name || 'Unnamed stakeholder',
            category: data.category || 'workers',
            contact_person: data.contact_person || '',
            contact_email: data.contact_email || '',
            contact_phone: data.contact_phone || '',
            needs: data.needs || '',
            expectations: data.expectations || '',
            requirements: data.requirements || '',
            engagement_method: data.engagement_method || '',
            engagement_frequency: data.engagement_frequency || '',
            status: data.status || 'Active',
            owner: data.owner || '',
            review_date: data.review_date || '',
            notes: data.notes || '',
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

const stakeholderManager = new StakeholderManager();

// ═══════════════════════════════════════════════════════════════
// STATE
// ═══════════════════════════════════════════════════════════════

let currentView = 'list';         // 'list' | 'detail' | 'form'
let currentStakeholderId = null;
let cachedStakeholders = [];
let filterCategory = '';
let filterStatus = '';

// ═══════════════════════════════════════════════════════════════
// RENDER
// ═══════════════════════════════════════════════════════════════

async function renderStakeholderModule() {
    const host = document.getElementById('stakeholderContent');
    if (!host) return;

    if (!isSignedIn()) {
        host.innerHTML = `<div style="padding:3rem; text-align:center; color:#64748b;">Sign in to access the interested parties register.</div>`;
        return;
    }

    host.innerHTML = `<div style="padding:3rem; text-align:center; color:#64748b;">Loading…</div>`;

    try {
        cachedStakeholders = await stakeholderManager.list();
    } catch (err) {
        console.error('[stakeholder] Load failed:', err);
        host.innerHTML = `<div style="padding:3rem; text-align:center; color:#991b1b;">
            <div style="font-size:2.5rem; margin-bottom:0.5rem;">⚠️</div>
            <div style="font-weight:600;">Could not load stakeholders</div>
            <div style="font-size:0.85rem; margin-top:0.35rem;">${escapeHtml(err.code || err.message)}</div>
        </div>`;
        return;
    }

    if (currentView === 'list')   return renderListView(host);
    if (currentView === 'detail') return renderDetailView(host);
    if (currentView === 'form')   return renderFormView(host);
}

function renderListView(host) {
    const all = cachedStakeholders;

    const filtered = all.filter(s => {
        if (filterCategory && s.category !== filterCategory) return false;
        if (filterStatus && s.status !== filterStatus) return false;
        return true;
    });

    // Stats
    const total = all.length;
    const active = all.filter(s => s.status === 'Active').length;
    const reviewSoon = all.filter(s => {
        if (!s.review_date) return false;
        const d = new Date(s.review_date);
        if (isNaN(d.getTime())) return false;
        const days = (d - new Date()) / (1000 * 60 * 60 * 24);
        return days >= 0 && days <= 30;
    }).length;
    const categoriesUsed = new Set(all.map(s => s.category).filter(Boolean)).size;

    const statsHtml = `
        <div style="display:grid; grid-template-columns:repeat(auto-fit,minmax(150px,1fr)); gap:0.75rem; margin-bottom:1.25rem;">
            <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:12px; padding:1rem 1.15rem;">
                <div style="font-size:1.6rem; font-weight:800; color:#0f172a; line-height:1;">${total}</div>
                <div style="font-size:0.72rem; color:#64748b; text-transform:uppercase; letter-spacing:0.4px; margin-top:0.35rem; font-weight:600;">Total Parties</div>
            </div>
            <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:12px; padding:1rem 1.15rem;">
                <div style="font-size:1.6rem; font-weight:800; color:#0f172a; line-height:1;">${active}</div>
                <div style="font-size:0.72rem; color:#64748b; text-transform:uppercase; letter-spacing:0.4px; margin-top:0.35rem; font-weight:600;">Active</div>
            </div>
            <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:12px; padding:1rem 1.15rem;">
                <div style="font-size:1.6rem; font-weight:800; color:${reviewSoon > 0 ? '#dc2626' : '#0f172a'}; line-height:1;">${reviewSoon}</div>
                <div style="font-size:0.72rem; color:#64748b; text-transform:uppercase; letter-spacing:0.4px; margin-top:0.35rem; font-weight:600;">Review in 30d</div>
            </div>
            <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:12px; padding:1rem 1.15rem;">
                <div style="font-size:1.6rem; font-weight:800; color:#0f172a; line-height:1;">${categoriesUsed}</div>
                <div style="font-size:0.72rem; color:#64748b; text-transform:uppercase; letter-spacing:0.4px; margin-top:0.35rem; font-weight:600;">Categories</div>
            </div>
        </div>
    `;

    const headerHtml = `
        <div style="display:flex; justify-content:space-between; align-items:center; gap:1rem; margin-bottom:1rem; flex-wrap:wrap;">
            <div>
                <div style="font-weight:700; font-size:0.95rem;">Interested Parties Register</div>
                <div style="font-size:0.78rem; color:#64748b; margin-top:0.15rem;">ISO 45001 Clause 4.2 — who affects or is affected by our OH&S system</div>
            </div>
            <button class="btn btn-primary" onclick="window.__stkNew()">+ Add Stakeholder</button>
        </div>
    `;

    // Filters
    const filterHtml = `
        <div style="display:flex; gap:0.6rem; flex-wrap:wrap; margin-bottom:1rem;">
            <select onchange="window.__stkSetCategory(this.value)" style="padding:0.45rem 0.75rem; border:1px solid #e2e8f0; border-radius:8px; font-size:0.82rem; font-family:inherit;">
                <option value="">All Categories</option>
                ${CATEGORIES.map(c => `<option value="${c.key}" ${filterCategory === c.key ? 'selected' : ''}>${c.icon} ${c.label}</option>`).join('')}
            </select>
            <select onchange="window.__stkSetStatus(this.value)" style="padding:0.45rem 0.75rem; border:1px solid #e2e8f0; border-radius:8px; font-size:0.82rem; font-family:inherit;">
                <option value="">All Statuses</option>
                ${STATUS_OPTIONS.map(s => `<option value="${s}" ${filterStatus === s ? 'selected' : ''}>${s}</option>`).join('')}
            </select>
            ${(filterCategory || filterStatus) ? `
                <button class="btn btn-outline btn-sm" onclick="window.__stkClearFilters()">Clear filters</button>
            ` : ''}
        </div>
    `;

    if (all.length === 0) {
        host.innerHTML = statsHtml + headerHtml + `
            <div style="text-align:center; padding:3rem 1rem; color:#64748b; border:1px dashed #cbd5e1; border-radius:12px;">
                <div style="font-size:3rem; margin-bottom:0.75rem;">🤝</div>
                <div style="font-weight:600; color:#0f172a; margin-bottom:0.35rem;">No interested parties registered yet</div>
                <div style="font-size:0.9rem; max-width:460px; margin:0 auto;">Record workers, regulators, customers, and other parties whose needs and expectations affect your OH&S management system.</div>
                <button class="btn btn-primary" style="margin-top:1.25rem;" onclick="window.__stkNew()">+ Add First Stakeholder</button>
            </div>
        `;
        return;
    }

    if (filtered.length === 0) {
        host.innerHTML = statsHtml + headerHtml + filterHtml + `
            <div style="text-align:center; padding:2rem; color:#64748b; border:1px dashed #cbd5e1; border-radius:12px;">
                <div style="font-size:0.9rem;">No stakeholders match the current filters.</div>
            </div>
        `;
        return;
    }

    const rows = filtered.map(s => {
        const meta = categoryMeta(s.category);
        return `<tr style="cursor:pointer;" onclick="window.__stkOpen('${escapeHtml(s.id)}')">
            <td>
                <div style="display:flex; align-items:center; gap:0.6rem;">
                    <span style="font-size:1.15rem;">${meta.icon}</span>
                    <div>
                        <div style="font-weight:600;">${escapeHtml(s.name)}</div>
                        <div style="font-size:0.72rem; color:#94a3b8;">${escapeHtml(meta.label)}</div>
                    </div>
                </div>
            </td>
            <td style="font-size:0.82rem;">${escapeHtml(s.contact_person || '—')}</td>
            <td style="font-size:0.78rem; max-width:280px;">
                ${s.needs ? `<div style="color:#334155; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${escapeHtml(s.needs)}</div>` : '<span style="color:#94a3b8;">Not documented</span>'}
            </td>
            <td style="font-size:0.78rem;">${escapeHtml(s.engagement_method || '—')}</td>
            <td style="font-size:0.78rem;">${escapeHtml(s.review_date || '—')}</td>
            <td>${statusChip(s.status)}</td>
        </tr>`;
    }).join('');

    host.innerHTML = statsHtml + headerHtml + filterHtml + `
        <div style="overflow-x:auto;">
            <table class="data-table">
                <thead>
                    <tr>
                        <th>Stakeholder</th>
                        <th>Contact</th>
                        <th>Key Needs / Expectations</th>
                        <th>Engagement</th>
                        <th>Next Review</th>
                        <th>Status</th>
                    </tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>
        </div>
    `;
}

function renderDetailView(host) {
    const s = cachedStakeholders.find(x => x.id === currentStakeholderId);
    if (!s) {
        currentView = 'list';
        return renderStakeholderModule();
    }

    const meta = categoryMeta(s.category);

    const field = (label, value) => value
        ? `<div style="margin-bottom:1rem;">
             <div style="font-size:0.7rem; text-transform:uppercase; letter-spacing:0.5px; color:#64748b; font-weight:700; margin-bottom:0.25rem;">${escapeHtml(label)}</div>
             <div style="font-size:0.9rem; color:#334155; line-height:1.6; white-space:pre-wrap;">${escapeHtml(value)}</div>
           </div>`
        : '';

    host.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; gap:1rem; margin-bottom:1.25rem; flex-wrap:wrap;">
            <button class="btn btn-outline btn-sm" onclick="window.__stkBackToList()">← Back to Register</button>
            <div style="display:flex; gap:0.5rem;">
                <button class="btn btn-outline btn-sm" onclick="window.__stkEdit('${escapeHtml(s.id)}')">✏️ Edit</button>
                ${isAdmin() ? `<button class="btn btn-danger btn-sm" onclick="window.__stkDelete('${escapeHtml(s.id)}')">🗑️ Delete</button>` : ''}
            </div>
        </div>

        <div style="display:flex; align-items:center; gap:1rem; margin-bottom:1.25rem;">
            <div style="font-size:2rem;">${meta.icon}</div>
            <div>
                <div style="font-family:monospace; font-size:0.72rem; color:#94a3b8; margin-bottom:0.15rem;">${escapeHtml(s.id)}</div>
                <h3 style="font-size:1.25rem; font-weight:700; color:#0f172a;">${escapeHtml(s.name)}</h3>
                <div style="font-size:0.82rem; color:#64748b; margin-top:0.2rem;">${escapeHtml(meta.label)}</div>
            </div>
        </div>

        <div style="display:grid; grid-template-columns:repeat(auto-fit,minmax(220px,1fr)); gap:1rem; margin-bottom:1.5rem; padding:1rem 1.15rem; background:#f8fafc; border-radius:12px; border:1px solid #e2e8f0;">
            ${s.contact_person ? `<div><div style="font-size:0.68rem; text-transform:uppercase; color:#64748b; font-weight:700; margin-bottom:0.2rem;">Contact</div><div style="font-size:0.87rem;">${escapeHtml(s.contact_person)}</div></div>` : ''}
            ${s.contact_email ? `<div><div style="font-size:0.68rem; text-transform:uppercase; color:#64748b; font-weight:700; margin-bottom:0.2rem;">Email</div><div style="font-size:0.87rem;">${escapeHtml(s.contact_email)}</div></div>` : ''}
            ${s.contact_phone ? `<div><div style="font-size:0.68rem; text-transform:uppercase; color:#64748b; font-weight:700; margin-bottom:0.2rem;">Phone</div><div style="font-size:0.87rem;">${escapeHtml(s.contact_phone)}</div></div>` : ''}
            <div><div style="font-size:0.68rem; text-transform:uppercase; color:#64748b; font-weight:700; margin-bottom:0.2rem;">Status</div>${statusChip(s.status)}</div>
        </div>

        <div style="display:grid; gap:0;">
            ${field('Needs', s.needs)}
            ${field('Expectations', s.expectations)}
            ${field('Requirements (legal / contractual)', s.requirements)}
            ${field('Engagement Method', s.engagement_method)}
            ${field('Engagement Frequency', s.engagement_frequency)}
            ${field('Notes', s.notes)}
        </div>

        <div style="display:grid; grid-template-columns:repeat(auto-fit,minmax(180px,1fr)); gap:0.75rem; font-size:0.82rem; color:#64748b; padding-top:1.25rem; border-top:1px solid #e2e8f0; margin-top:1.5rem;">
            ${s.owner ? `<div><strong style="color:#0f172a;">Owner:</strong> ${escapeHtml(s.owner)}</div>` : ''}
            ${s.review_date ? `<div><strong style="color:#0f172a;">Next Review:</strong> ${escapeHtml(s.review_date)}</div>` : ''}
            ${s.created_by ? `<div><strong style="color:#0f172a;">Created by:</strong> ${escapeHtml(s.created_by)}</div>` : ''}
        </div>
    `;
}

function renderFormView(host) {
    const editing = !!currentStakeholderId;
    const s = editing ? (cachedStakeholders.find(x => x.id === currentStakeholderId) || {}) : {};

    host.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; gap:1rem; margin-bottom:1.25rem; flex-wrap:wrap;">
            <button class="btn btn-outline btn-sm" onclick="window.__stkBackToList()">← Back</button>
            <div style="font-weight:700; font-size:0.95rem;">${editing ? 'Edit Interested Party' : 'New Interested Party'}</div>
        </div>

        <div class="form-row">
            <div class="form-group">
                <label>Stakeholder Name *</label>
                <input type="text" id="stk-name" value="${escapeHtml(s.name || '')}" placeholder="e.g., Tanzania OSHA — Regional Office">
            </div>
            <div class="form-group">
                <label>Category *</label>
                <select id="stk-category">
                    <option value="">Select category</option>
                    ${CATEGORIES.map(c => `<option value="${c.key}" ${s.category === c.key ? 'selected' : ''}>${c.icon} ${c.label}</option>`).join('')}
                </select>
            </div>
        </div>

        <div class="form-row">
            <div class="form-group">
                <label>Contact Person</label>
                <input type="text" id="stk-contact" value="${escapeHtml(s.contact_person || '')}" placeholder="e.g., Jane Mwakasege">
            </div>
            <div class="form-group">
                <label>Contact Email</label>
                <input type="email" id="stk-email" value="${escapeHtml(s.contact_email || '')}" placeholder="e.g., contact@osha.go.tz">
            </div>
        </div>

        <div class="form-row">
            <div class="form-group">
                <label>Contact Phone</label>
                <input type="tel" id="stk-phone" value="${escapeHtml(s.contact_phone || '')}" placeholder="e.g., +255 22 123 4567">
            </div>
            <div class="form-group">
                <label>Owner / Relationship Manager</label>
                <input type="text" id="stk-owner" value="${escapeHtml(s.owner || '')}" placeholder="e.g., Safety Manager">
            </div>
        </div>

        <div class="form-group">
            <label>Needs</label>
            <textarea id="stk-needs" rows="3" placeholder="What does this party need from our OH&S system? (e.g., timely incident notification, safe working conditions, regulatory compliance evidence)">${escapeHtml(s.needs || '')}</textarea>
        </div>

        <div class="form-group">
            <label>Expectations</label>
            <textarea id="stk-expectations" rows="3" placeholder="What do they expect from us? (e.g., annual audits, transparency, consultation on major changes)">${escapeHtml(s.expectations || '')}</textarea>
        </div>

        <div class="form-group">
            <label>Requirements (Legal / Contractual)</label>
            <textarea id="stk-requirements" rows="3" placeholder="Legal obligations or contractual requirements this party imposes on us.">${escapeHtml(s.requirements || '')}</textarea>
        </div>

        <div class="form-row">
            <div class="form-group">
                <label>Engagement Method</label>
                <select id="stk-method">
                    <option value="">Select method</option>
                    ${ENGAGEMENT_METHODS.map(m => `<option value="${m}" ${s.engagement_method === m ? 'selected' : ''}>${m}</option>`).join('')}
                </select>
            </div>
            <div class="form-group">
                <label>Engagement Frequency</label>
                <input type="text" id="stk-frequency" value="${escapeHtml(s.engagement_frequency || '')}" placeholder="e.g., Quarterly / Monthly / Annual">
            </div>
        </div>

        <div class="form-row">
            <div class="form-group">
                <label>Status</label>
                <select id="stk-status">
                    ${STATUS_OPTIONS.map(st => `<option value="${st}" ${(s.status || 'Active') === st ? 'selected' : ''}>${st}</option>`).join('')}
                </select>
            </div>
            <div class="form-group">
                <label>Next Review Date</label>
                <input type="date" id="stk-review-date" value="${escapeHtml(s.review_date || '')}">
            </div>
        </div>

        <div class="form-group">
            <label>Notes</label>
            <textarea id="stk-notes" rows="2" placeholder="Anything else worth recording about this relationship.">${escapeHtml(s.notes || '')}</textarea>
        </div>

        <div class="action-buttons">
            <button class="btn btn-primary" onclick="window.__stkSave()">${editing ? '💾 Save Changes' : '💾 Add Stakeholder'}</button>
            <button class="btn btn-outline" onclick="window.__stkBackToList()">Cancel</button>
        </div>
    `;
}

// ═══════════════════════════════════════════════════════════════
// WINDOW FUNCTIONS
// ═══════════════════════════════════════════════════════════════

window.__stkNew = function () {
    currentStakeholderId = null;
    currentView = 'form';
    renderStakeholderModule();
};

window.__stkOpen = function (id) {
    currentStakeholderId = id;
    currentView = 'detail';
    renderStakeholderModule();
};

window.__stkEdit = function (id) {
    currentStakeholderId = id;
    currentView = 'form';
    renderStakeholderModule();
};

window.__stkBackToList = function () {
    currentView = 'list';
    currentStakeholderId = null;
    renderStakeholderModule();
};

window.__stkSetCategory = function (v) {
    filterCategory = v || '';
    renderStakeholderModule();
};

window.__stkSetStatus = function (v) {
    filterStatus = v || '';
    renderStakeholderModule();
};

window.__stkClearFilters = function () {
    filterCategory = '';
    filterStatus = '';
    renderStakeholderModule();
};

window.__stkDelete = async function (id) {
    if (!confirm('Delete this interested party permanently?')) return;
    try {
        await stakeholderManager.remove(id);
        currentView = 'list';
        currentStakeholderId = null;
        await renderStakeholderModule();
    } catch (err) {
        alert('Delete failed: ' + (err.code || err.message));
    }
};

window.__stkSave = async function () {
    const name = (document.getElementById('stk-name') || {}).value?.trim();
    const category = (document.getElementById('stk-category') || {}).value;

    if (!name) { alert('Stakeholder name is required.'); return; }
    if (!category) { alert('Please select a category.'); return; }

    const data = {
        name,
        category,
        contact_person: (document.getElementById('stk-contact') || {}).value?.trim() || '',
        contact_email: (document.getElementById('stk-email') || {}).value?.trim() || '',
        contact_phone: (document.getElementById('stk-phone') || {}).value?.trim() || '',
        owner: (document.getElementById('stk-owner') || {}).value?.trim() || '',
        needs: (document.getElementById('stk-needs') || {}).value?.trim() || '',
        expectations: (document.getElementById('stk-expectations') || {}).value?.trim() || '',
        requirements: (document.getElementById('stk-requirements') || {}).value?.trim() || '',
        engagement_method: (document.getElementById('stk-method') || {}).value || '',
        engagement_frequency: (document.getElementById('stk-frequency') || {}).value?.trim() || '',
        status: (document.getElementById('stk-status') || {}).value || 'Active',
        review_date: (document.getElementById('stk-review-date') || {}).value || '',
        notes: (document.getElementById('stk-notes') || {}).value?.trim() || ''
    };

    try {
        if (currentStakeholderId) {
            await stakeholderManager.update(currentStakeholderId, data);
        } else {
            await stakeholderManager.create(data);
        }
        currentView = 'list';
        currentStakeholderId = null;
        await renderStakeholderModule();
    } catch (err) {
        console.error('[stakeholder] Save failed:', err);
        alert('Save failed: ' + (err.code || err.message));
    }
};

// ═══════════════════════════════════════════════════════════════
// MODAL OBSERVER
// ═══════════════════════════════════════════════════════════════

function attachStakeholderObserver() {
    const modal = document.getElementById('stakeholderModal');
    if (!modal) {
        console.warn('[stakeholder] stakeholderModal not found in DOM');
        return;
    }

    if (modal.classList.contains('show')) {
        currentView = 'list';
        currentStakeholderId = null;
        renderStakeholderModule();
    }

    const observer = new MutationObserver(() => {
        if (modal.classList.contains('show')) {
            currentView = 'list';
            currentStakeholderId = null;
            renderStakeholderModule();
        }
    });
    observer.observe(modal, { attributes: true, attributeFilter: ['class'] });

    console.log('[stakeholder] Observer attached to #stakeholderModal');
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', attachStakeholderObserver);
} else {
    attachStakeholderObserver();
}

console.log('[stakeholder-register] Ready');