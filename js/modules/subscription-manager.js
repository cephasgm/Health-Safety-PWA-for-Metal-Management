/* ═══════════════════════════════════════════════════════════════
   subscription-manager.js
   Phase 6 — Commercialization
   ═══════════════════════════════════════════════════════════════

   Features:
     - Per-org subscription plan (pilot / standard / enterprise)
     - Two billing models — per_site OR per_seat — admin toggle
     - Real usage counting from Firestore (seats from users,
       sites from locations + unique incident locations)
     - Limit enforcement with soft warnings
     - Billing event audit trail
     - Zero mocks

   Firestore:
     - subscriptions/{orgId}
     - billing_events/{id}

   Exposes: window.mmsSubscription
   ═══════════════════════════════════════════════════════════════ */

import { db } from '../core/firebase-config.js';
import {
    collection,
    doc,
    setDoc,
    getDoc,
    getDocs,
    query,
    orderBy,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";

// ═══════════════════════════════════════════════════════════════
// PLANS & RATES
// ═══════════════════════════════════════════════════════════════

const PLANS = {
    pilot: {
        key: 'pilot',
        label: 'Pilot',
        monthly_base: 0,
        seat_limit: 25,
        site_limit: 5,
        features: [
            'All safety modules',
            'Offline-first PWA',
            'AI hazard analysis',
            'Predictive analytics',
            'Lone worker monitoring',
            'Email support'
        ]
    },
    standard: {
        key: 'standard',
        label: 'Standard',
        monthly_base: 200,          // applies per site OR per 10 seats
        seat_limit: null,           // computed by billing model
        site_limit: null,
        features: [
            'Everything in Pilot',
            'Unlimited users (per-site)',
            'OSHA compliance reports',
            'ISO 45001 evidence packages',
            'Priority email support',
            '99% uptime SLA'
        ]
    },
    enterprise: {
        key: 'enterprise',
        label: 'Enterprise',
        monthly_base: 0,            // custom pricing
        seat_limit: null,
        site_limit: null,
        features: [
            'Everything in Standard',
            'Custom integrations',
            'Dedicated account manager',
            'On-site training',
            'SLA with credits',
            'Custom data residency'
        ]
    }
};

const RATES = {
    per_site: {
        key: 'per_site',
        label: 'Per Site',
        unit_label: 'site',
        price_per_unit: 200,        // USD / site / month
        hint: 'Best for operations with many workers per site.'
    },
    per_seat: {
        key: 'per_seat',
        label: 'Per Seat',
        unit_label: 'user',
        price_per_unit: 15,         // USD / user / month
        hint: 'Best for smaller teams or mixed sites.'
    }
};

const DEFAULT_ORG_ID = 'mms_metal_management';
const DEFAULT_PLAN   = 'pilot';
const DEFAULT_MODEL  = 'per_site';

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

function isSignedIn() { return !!window.mmsCurrentUser; }
function isAdmin()    { return !!(window.mmsCurrentUser && window.mmsCurrentUser.isAdmin); }

function uid8() { return Math.random().toString(36).slice(2, 10); }

function fmtUsd(n) {
    return '$' + Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function toDate(v) {
    if (!v) return null;
    if (v instanceof Date) return v;
    if (typeof v === 'object' && 'seconds' in v) return new Date(v.seconds * 1000);
    if (typeof v === 'number') return new Date(v);
    const d = new Date(v);
    return isNaN(d.getTime()) ? null : d;
}

// ═══════════════════════════════════════════════════════════════
// SUBSCRIPTION MANAGER
// ═══════════════════════════════════════════════════════════════

class SubscriptionManager {
    constructor() {
        this.COLLECTION = 'subscriptions';
        this.EVENTS_COLLECTION = 'billing_events';
        this.orgId = DEFAULT_ORG_ID;
    }

    /** Derive orgId from current user's company (falls back to DEFAULT_ORG_ID). */
    resolveOrgId() {
        const company = window.mmsCurrentUser?.company;
        if (!company || typeof company !== 'string') return DEFAULT_ORG_ID;
        // Slugify: lowercase, spaces→underscore, strip non-alnum/underscore
        const slug = company.toLowerCase()
            .trim()
            .replace(/[^a-z0-9]+/g, '_')
            .replace(/^_+|_+$/g, '')
            .slice(0, 40);
        return slug || DEFAULT_ORG_ID;
    }

    async load() {
        this.orgId = this.resolveOrgId();
        try {
            const ref = doc(db, this.COLLECTION, this.orgId);
            const snap = await getDoc(ref);
            if (snap.exists()) return snap.data();
            // First load — create a default pilot subscription
            return await this.createDefault();
        } catch (err) {
            console.warn('[subscription] Load failed:', err.code || err.message);
            return this.defaultRecord();
        }
    }

    defaultRecord() {
        return {
            org_id: this.orgId,
            plan: DEFAULT_PLAN,
            billing_model: DEFAULT_MODEL,
            status: 'pilot',
            trial_ends_at_iso: new Date(Date.now() + 90 * 86400000).toISOString(),
            created_at_iso: new Date().toISOString(),
            updated_at_iso: new Date().toISOString(),
            notes: ''
        };
    }

    async createDefault() {
        const record = this.defaultRecord();
        try {
            await setDoc(doc(db, this.COLLECTION, this.orgId), {
                ...record,
                created_at: serverTimestamp(),
                updated_at: serverTimestamp(),
                created_by: window.mmsCurrentUser?.email || 'system'
            });
            console.log('[subscription] Created default pilot subscription for', this.orgId);
        } catch (err) {
            console.warn('[subscription] Could not persist default:', err.code || err.message);
        }
        return record;
    }

    async update(patch, reason = 'admin update') {
        if (!isAdmin()) {
            throw new Error('Admin access required to change subscription.');
        }
        const ref = doc(db, this.COLLECTION, this.orgId);
        await setDoc(ref, {
            ...patch,
            updated_at: serverTimestamp(),
            updated_at_iso: new Date().toISOString(),
            updated_by: window.mmsCurrentUser?.email || 'unknown'
        }, { merge: true });

        // Log billing event
        const eventId = 'EVT-' + Date.now() + '-' + uid8();
        try {
            await setDoc(doc(db, this.EVENTS_COLLECTION, eventId), {
                id: eventId,
                org_id: this.orgId,
                patch,
                reason,
                actor_email: window.mmsCurrentUser?.email || 'unknown',
                created_at: serverTimestamp(),
                created_at_iso: new Date().toISOString()
            });
        } catch (err) {
            console.warn('[subscription] Event log failed:', err.code || err.message);
        }
        console.log('[subscription] Updated:', patch);
    }

    async listEvents(limit = 20) {
        try {
            const q = query(
                collection(db, this.EVENTS_COLLECTION),
                orderBy('created_at_iso', 'desc')
            );
            const snap = await getDocs(q);
            const out = [];
            snap.forEach((d) => out.push(d.data()));
            return out.filter((e) => e.org_id === this.orgId).slice(0, limit);
        } catch (err) {
            return [];
        }
    }

    // ─── Usage counting ───

    async countSeats() {
        try {
            const snap = await getDocs(collection(db, 'users'));
            return snap.size;
        } catch (err) {
            console.warn('[subscription] Seat count failed:', err.code || err.message);
            return 0;
        }
    }

    async countSites() {
        // Primary: locations collection
        let fromLocations = 0;
        try {
            const snap = await getDocs(collection(db, 'locations'));
            fromLocations = snap.size;
        } catch (err) {
            // silent
        }

        // Secondary: unique location values from incidents
        let fromIncidents = 0;
        try {
            const snap = await getDocs(collection(db, 'incidents'));
            const set = new Set();
            snap.forEach((d) => {
                const loc = (d.data()?.location || '').trim();
                if (loc) set.add(loc);
            });
            fromIncidents = set.size;
        } catch (err) {
            // silent
        }

        // Sites = union of both sources (dedup by exact string is imperfect
        // but fine for now — the biggest value wins)
        return Math.max(fromLocations, fromIncidents);
    }

    async computeUsage(subscription) {
        const seats = await this.countSeats();
        const sites = await this.countSites();

        const plan = PLANS[subscription.plan] || PLANS[DEFAULT_PLAN];
        const model = RATES[subscription.billing_model] || RATES[DEFAULT_MODEL];

        let seatLimit = plan.seat_limit;
        let siteLimit = plan.site_limit;

        // Standard plan is metered — unlimited soft caps for display
        if (plan.key === 'standard') {
            seatLimit = null;
            siteLimit = null;
        }

        const billableUnits = subscription.billing_model === 'per_site' ? sites : seats;
        const pricePerUnit = subscription.plan === 'pilot' ? 0 : model.price_per_unit;
        const monthlyCost = subscription.plan === 'pilot'
            ? 0
            : subscription.plan === 'enterprise'
                ? null   // custom
                : billableUnits * pricePerUnit;

        return {
            seats,
            sites,
            seatLimit,
            siteLimit,
            planKey: plan.key,
            planLabel: plan.label,
            billingModel: model.key,
            billingLabel: model.label,
            pricePerUnit,
            billableUnits,
            monthlyCost,
            overSeatLimit: seatLimit != null && seats > seatLimit,
            overSiteLimit: siteLimit != null && sites > siteLimit
        };
    }
}

// ═══════════════════════════════════════════════════════════════
// STATE
// ═══════════════════════════════════════════════════════════════

let _manager = null;
let _subscription = null;
let _usage = null;
let _events = [];

// ═══════════════════════════════════════════════════════════════
// UI
// ═══════════════════════════════════════════════════════════════

function ensureWidget() {
    const mount = document.getElementById('subscriptionWidgetMount');
    if (!mount) return null;
    let widget = document.getElementById('subscriptionWidgetCard');
    if (!widget) {
        widget = document.createElement('div');
        widget.id = 'subscriptionWidgetCard';
        widget.className = 'card';
        widget.style.marginBottom = '1.5rem';
        mount.appendChild(widget);
    }
    return widget;
}

function renderWidget() {
    const widget = ensureWidget();
    if (!widget) return;

    if (!_subscription || !_usage) {
        widget.innerHTML = `
            <div class="card-header">
                <div>
                    <div class="card-title">Subscription & Billing</div>
                    <div class="card-subtitle">Plan, usage, and billing model</div>
                </div>
            </div>
            <div style="padding:1.5rem; text-align:center; color:#64748b; font-size:0.85rem;">Loading subscription…</div>
        `;
        return;
    }

    const { planKey, planLabel, billingModel, billingLabel, pricePerUnit, billableUnits, monthlyCost, seats, sites, seatLimit, siteLimit, overSeatLimit, overSiteLimit } = _usage;
    const plan = PLANS[planKey] || PLANS[DEFAULT_PLAN];

    const trialEnds = toDate(_subscription.trial_ends_at_iso);
    const trialDaysLeft = trialEnds ? Math.max(0, Math.round((trialEnds.getTime() - Date.now()) / 86400000)) : 0;

    // Cost label
    let costLabel;
    if (planKey === 'pilot') {
        costLabel = 'Free (Pilot)';
    } else if (planKey === 'enterprise') {
        costLabel = 'Custom';
    } else {
        costLabel = fmtUsd(monthlyCost) + ' / month';
    }

    // Usage bar helper
    const bar = (current, limit, color) => {
        if (limit == null) {
            return `
                <div style="height:6px; background:var(--gray-100); border-radius:3px; margin-top:0.5rem;"></div>
                <div style="font-size:0.72rem; color:#94a3b8; margin-top:0.35rem;">No limit on this plan</div>
            `;
        }
        const pct = Math.min(100, Math.round((current / limit) * 100));
        const over = current > limit;
        return `
            <div style="height:6px; background:var(--gray-100); border-radius:3px; margin-top:0.5rem; overflow:hidden;">
                <div style="height:100%; width:${pct}%; background:${over ? '#dc2626' : color}; transition:width 0.3s;"></div>
            </div>
            <div style="font-size:0.72rem; color:${over ? '#991b1b' : '#94a3b8'}; margin-top:0.35rem;">${current} of ${limit}${over ? ' — over limit' : ''}</div>
        `;
    };

    const adminControls = isAdmin() ? `
        <div style="margin-top:1.25rem; padding-top:1.25rem; border-top:1px solid var(--gray-100);">
            <div style="font-size:0.72rem; text-transform:uppercase; letter-spacing:0.5px; color:#64748b; font-weight:700; margin-bottom:0.75rem;">Admin Controls</div>

            <div style="display:grid; grid-template-columns:repeat(auto-fit,minmax(220px,1fr)); gap:1rem; margin-bottom:1rem;">
                <div>
                    <label style="font-size:0.78rem; color:#64748b; font-weight:600; display:block; margin-bottom:0.35rem;">Plan</label>
                    <select id="sub-plan-select" style="width:100%; padding:0.5rem 0.75rem; border:1px solid #e2e8f0; border-radius:8px; font-family:inherit; font-size:0.85rem;">
                        <option value="pilot" ${planKey === 'pilot' ? 'selected' : ''}>Pilot (Free)</option>
                        <option value="standard" ${planKey === 'standard' ? 'selected' : ''}>Standard (Metered)</option>
                        <option value="enterprise" ${planKey === 'enterprise' ? 'selected' : ''}>Enterprise (Custom)</option>
                    </select>
                </div>
                <div>
                    <label style="font-size:0.78rem; color:#64748b; font-weight:600; display:block; margin-bottom:0.35rem;">Billing Model</label>
                    <select id="sub-model-select" style="width:100%; padding:0.5rem 0.75rem; border:1px solid #e2e8f0; border-radius:8px; font-family:inherit; font-size:0.85rem;">
                        <option value="per_site" ${billingModel === 'per_site' ? 'selected' : ''}>Per Site — $200 / site / month</option>
                        <option value="per_seat" ${billingModel === 'per_seat' ? 'selected' : ''}>Per Seat — $15 / user / month</option>
                    </select>
                </div>
            </div>

            <div style="display:flex; gap:0.6rem; flex-wrap:wrap;">
                <button class="btn btn-primary btn-sm" onclick="window.mmsSubscription.saveChanges()">💾 Save Changes</button>
                <button class="btn btn-outline btn-sm" onclick="window.mmsSubscription.showEvents()">📋 Billing History</button>
            </div>
        </div>
    ` : '';

    widget.innerHTML = `
        <div class="card-header">
            <div>
                <div class="card-title">Subscription & Billing</div>
                <div class="card-subtitle">${escapeHtml(_manager.orgId.replace(/_/g, ' '))}</div>
            </div>
            <div style="display:flex; gap:0.5rem; align-items:center;">
                <span style="font-size:0.7rem; font-weight:700; padding:0.25rem 0.6rem; background:${planKey === 'pilot' ? '#eff6ff' : planKey === 'standard' ? '#ecfdf5' : '#f5f3ff'}; color:${planKey === 'pilot' ? '#1e40af' : planKey === 'standard' ? '#065f46' : '#7c3aed'}; border-radius:8px; text-transform:uppercase;">${escapeHtml(planLabel)}</span>
                ${planKey === 'pilot' && trialDaysLeft > 0 ? `<span style="font-size:0.7rem; color:#92400e;">${trialDaysLeft} days left in pilot</span>` : ''}
            </div>
        </div>

        <div style="display:grid; grid-template-columns:repeat(auto-fit,minmax(180px,1fr)); gap:0.75rem; margin-bottom:1.25rem;">
            <div style="padding:0.9rem 1rem; background:var(--gray-50); border:1px solid var(--gray-200); border-radius:12px;">
                <div style="font-size:1.15rem; font-weight:800; color:var(--gray-900); line-height:1;">${escapeHtml(costLabel)}</div>
                <div style="font-size:0.68rem; color:#64748b; text-transform:uppercase; letter-spacing:0.4px; margin-top:0.35rem; font-weight:700;">Current Plan Cost</div>
                ${planKey === 'standard' ? `<div style="font-size:0.72rem; color:#94a3b8; margin-top:0.2rem;">${billableUnits} × ${fmtUsd(pricePerUnit)}</div>` : ''}
            </div>
            <div style="padding:0.9rem 1rem; background:var(--gray-50); border:1px solid var(--gray-200); border-radius:12px;">
                <div style="font-size:1.15rem; font-weight:800; color:${overSeatLimit ? '#991b1b' : 'var(--gray-900)'}; line-height:1;">${seats}</div>
                <div style="font-size:0.68rem; color:#64748b; text-transform:uppercase; letter-spacing:0.4px; margin-top:0.35rem; font-weight:700;">Seats (Users)</div>
                ${bar(seats, seatLimit, '#3b82f6')}
            </div>
            <div style="padding:0.9rem 1rem; background:var(--gray-50); border:1px solid var(--gray-200); border-radius:12px;">
                <div style="font-size:1.15rem; font-weight:800; color:${overSiteLimit ? '#991b1b' : 'var(--gray-900)'}; line-height:1;">${sites}</div>
                <div style="font-size:0.68rem; color:#64748b; text-transform:uppercase; letter-spacing:0.4px; margin-top:0.35rem; font-weight:700;">Sites</div>
                ${bar(sites, siteLimit, '#10b981')}
            </div>
            <div style="padding:0.9rem 1rem; background:var(--gray-50); border:1px solid var(--gray-200); border-radius:12px;">
                <div style="font-size:1.15rem; font-weight:800; color:var(--gray-900); line-height:1;">${escapeHtml(billingLabel)}</div>
                <div style="font-size:0.68rem; color:#64748b; text-transform:uppercase; letter-spacing:0.4px; margin-top:0.35rem; font-weight:700;">Billing Model</div>
                <div style="font-size:0.72rem; color:#94a3b8; margin-top:0.2rem;">${escapeHtml(RATES[billingModel]?.hint || '')}</div>
            </div>
        </div>

        ${(overSeatLimit || overSiteLimit) ? `
            <div style="padding:0.85rem 1rem; background:#fef2f2; border-left:3px solid #dc2626; border-radius:8px; margin-bottom:1.25rem; font-size:0.85rem; color:#991b1b;">
                <strong>⚠️ Over pilot limits.</strong> You have exceeded the free tier. Upgrade to Standard to keep using the system without interruption.
            </div>
        ` : ''}

        <div style="margin-bottom:1.25rem;">
            <div style="font-size:0.72rem; text-transform:uppercase; letter-spacing:0.5px; color:#64748b; font-weight:700; margin-bottom:0.5rem;">What's Included</div>
            <ul style="margin:0; padding-left:1.25rem; font-size:0.85rem; color:#334155; line-height:1.65;">
                ${plan.features.map((f) => `<li>${escapeHtml(f)}</li>`).join('')}
            </ul>
        </div>

        ${adminControls}
    `;
}

function renderEventsModal(events) {
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed; inset:0; background:rgba(15,23,42,0.55); backdrop-filter:blur(4px); z-index:9999; display:flex; align-items:center; justify-content:center; padding:1rem;';
    overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };

    const rows = events.length === 0
        ? '<div style="padding:2rem; text-align:center; color:#64748b; font-size:0.85rem;">No billing events yet.</div>'
        : events.map((e) => `
            <div style="padding:0.75rem 1rem; border-bottom:1px solid var(--gray-100); font-size:0.82rem;">
                <div style="font-weight:600; color:var(--gray-900);">${escapeHtml(e.reason || 'update')}</div>
                <div style="color:#64748b; margin-top:0.15rem;">${escapeHtml(JSON.stringify(e.patch || {}))}</div>
                <div style="color:#94a3b8; margin-top:0.15rem; font-size:0.72rem;">${escapeHtml(e.actor_email || '—')} · ${escapeHtml(toDate(e.created_at_iso)?.toLocaleString() || '')}</div>
            </div>
        `).join('');

    overlay.innerHTML = `
        <div style="background:white; border-radius:16px; max-width:640px; width:100%; max-height:80vh; overflow:auto; padding:1.5rem;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem;">
                <div style="font-size:1.1rem; font-weight:700;">Billing History</div>
                <button onclick="this.closest('div[style*=fixed]').remove()" style="border:none; background:transparent; font-size:1.35rem; cursor:pointer; color:#94a3b8;">×</button>
            </div>
            ${rows}
        </div>
    `;
    document.body.appendChild(overlay);
}

// ═══════════════════════════════════════════════════════════════
// PUBLIC API
// ═══════════════════════════════════════════════════════════════

async function refresh() {
    _subscription = await _manager.load();
    _usage = await _manager.computeUsage(_subscription);
    renderWidget();
    console.log('[subscription] Refreshed:', {
        org: _manager.orgId,
        plan: _subscription.plan,
        model: _subscription.billing_model,
        seats: _usage.seats,
        sites: _usage.sites
    });
}

window.mmsSubscription = {
    refresh: () => refresh(),
    getSubscription: () => _subscription,
    getUsage: () => _usage,

    saveChanges: async () => {
        if (!isAdmin()) { alert('Admin access required.'); return; }
        const plan = document.getElementById('sub-plan-select')?.value;
        const model = document.getElementById('sub-model-select')?.value;
        if (!plan || !model) return;
        try {
            await _manager.update({ plan, billing_model: model }, 'admin changed plan/model');
            await refresh();
            alert('Subscription updated.');
        } catch (err) {
            alert('Update failed: ' + (err.code || err.message));
        }
    },

    showEvents: async () => {
        if (!isAdmin()) { alert('Admin access required.'); return; }
        const events = await _manager.listEvents(25);
        renderEventsModal(events);
    }
};

// ═══════════════════════════════════════════════════════════════
// BOOTSTRAP
// ═══════════════════════════════════════════════════════════════

function bootstrap() {
    _manager = new SubscriptionManager();

    if (!isSignedIn()) {
        let tries = 0;
        const check = setInterval(async () => {
            tries++;
            if (isSignedIn() || tries > 40) {
                clearInterval(check);
                if (isSignedIn()) await refresh();
            }
        }, 500);
        return;
    }
    refresh();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrap);
} else {
    bootstrap();
}

console.log('[subscription-manager] Ready');