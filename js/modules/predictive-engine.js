/* ═══════════════════════════════════════════════════════════════
   predictive-engine.js
   ═══════════════════════════════════════════════════════════════

   Real pattern detection on incident data. No mocks.

   Reads from:
     - Firestore `incidents` collection (live)
     - localStorage `mmsIncidents` (offline / legacy)

   Analyses:
     - Day-of-week distribution
     - Hour-of-day distribution
     - Location clustering (hotspots)
     - Type distribution
     - Severity distribution
     - Trend comparison (last 14d vs prior 14d)

   Persists generated alerts to Firestore `predictive_alerts`.

   Exposes: window.mmsPredictive.{refresh, getLastResult, dismissAlert}
   ═══════════════════════════════════════════════════════════════ */

import { db } from '../core/firebase-config.js';
import {
    collection,
    doc,
    setDoc,
    getDocs,
    query,
    orderBy,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";

// ═══════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════

const REFRESH_INTERVAL_MS = 15 * 60 * 1000;   // auto-refresh every 15 min
const WINDOW_SHORT_DAYS    = 7;
const WINDOW_MEDIUM_DAYS   = 30;
const TREND_WINDOW_DAYS    = 14;
const TREND_THRESHOLD_PCT  = 30;              // % change to flag as up/down
const ALERT_DEDUP_HOURS    = 24;

const SEVERITY_WEIGHTS = {
    Minor: 1,
    Moderate: 2,
    Serious: 3,
    Critical: 4
};

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const HOUR_LABELS = ['00','01','02','03','04','05','06','07','08','09','10','11','12','13','14','15','16','17','18','19','20','21','22','23'];

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

function isSignedIn() {
    return !!window.mmsCurrentUser;
}

/**
 * Firestore timestamps come back as {seconds, nanoseconds}. Local ones are
 * ISO strings. localStorage ones are ISO strings. Handle all three.
 */
function toDate(v) {
    if (!v) return null;
    if (v instanceof Date) return v;
    if (typeof v === 'object' && 'seconds' in v) {
        return new Date(v.seconds * 1000);
    }
    if (typeof v === 'number') return new Date(v);
    const d = new Date(v);
    return isNaN(d.getTime()) ? null : d;
}

function daysBetween(a, b) {
    return (a.getTime() - b.getTime()) / (1000 * 60 * 60 * 24);
}

function startOfDay(d) {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x;
}

function fingerprint(parts) {
    // Simple stable hash for dedup
    const s = parts.join('|').toLowerCase();
    let h = 0;
    for (let i = 0; i < s.length; i++) {
        h = ((h << 5) - h) + s.charCodeAt(i);
        h |= 0;
    }
    return String(h);
}

// ═══════════════════════════════════════════════════════════════
// DATA LOADER — merges Firestore + localStorage
// ═══════════════════════════════════════════════════════════════

async function loadAllIncidents() {
    const byId = new Map();

    // 1. Firestore — may fail if offline or rules deny
    try {
        const q = query(collection(db, 'incidents'), orderBy('created_at', 'desc'));
        const snap = await getDocs(q);
        snap.forEach((d) => {
            const data = d.data() || {};
            byId.set(d.id, {
                id: d.id,
                type: data.type || 'Unknown',
                severity: data.severity || 'Minor',
                location: data.location || '',
                date: toDate(data.date || data.created_at || data.createdAt),
                status: data.status || 'Reported'
            });
        });
    } catch (err) {
        console.warn('[predictive] Firestore read failed, using local cache only:', err.code || err.message);
    }

    // 2. localStorage — fills in anything not in Firestore
    try {
        const raw = localStorage.getItem('mmsIncidents');
        if (raw) {
            const arr = JSON.parse(raw);
            if (Array.isArray(arr)) {
                arr.forEach((inc) => {
                    const key = inc.id || ('local-' + fingerprint([inc.date, inc.location, inc.description]));
                    if (!byId.has(key)) {
                        byId.set(key, {
                            id: key,
                            type: inc.type || 'Unknown',
                            severity: inc.severity || 'Minor',
                            location: inc.location || '',
                            date: toDate(inc.date || inc.createdAt),
                            status: inc.status || 'Reported'
                        });
                    }
                });
            }
        }
    } catch (err) {
        console.warn('[predictive] localStorage read failed:', err.message);
    }

    // Filter out records without a valid date
    const list = Array.from(byId.values()).filter((i) => i.date instanceof Date && !isNaN(i.date.getTime()));

    // Sort newest first
    list.sort((a, b) => b.date - a.date);
    return list;
}

// ═══════════════════════════════════════════════════════════════
// PATTERN DETECTOR
// ═══════════════════════════════════════════════════════════════

class PatternDetector {
    constructor(incidents) {
        this.incidents = incidents || [];
    }

    within(days) {
        const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
        return this.incidents.filter((i) => i.date >= cutoff);
    }

    byDayOfWeek() {
        const buckets = DAY_NAMES.map((name) => ({ name, count: 0 }));
        this.incidents.forEach((i) => {
            buckets[i.date.getDay()].count++;
        });
        return buckets;
    }

    byHourOfDay() {
        const buckets = HOUR_LABELS.map((h) => ({ hour: h, count: 0 }));
        this.incidents.forEach((i) => {
            buckets[i.date.getHours()].count++;
        });
        return buckets;
    }

    byLocation() {
        const map = new Map();
        this.incidents.forEach((i) => {
            const key = i.location || 'Unspecified';
            map.set(key, (map.get(key) || 0) + 1);
        });
        return Array.from(map.entries())
            .map(([location, count]) => ({ location, count }))
            .sort((a, b) => b.count - a.count);
    }

    byType() {
        const map = new Map();
        this.incidents.forEach((i) => {
            map.set(i.type, (map.get(i.type) || 0) + 1);
        });
        return Array.from(map.entries())
            .map(([type, count]) => ({ type, count }))
            .sort((a, b) => b.count - a.count);
    }

    bySeverity() {
        const map = new Map();
        this.incidents.forEach((i) => {
            map.set(i.severity, (map.get(i.severity) || 0) + 1);
        });
        return Array.from(map.entries())
            .map(([severity, count]) => ({ severity, count }))
            .sort((a, b) => (SEVERITY_WEIGHTS[b.severity] || 0) - (SEVERITY_WEIGHTS[a.severity] || 0));
    }

    /** Locations with 3+ incidents in the last 7 days */
    hotspotsLast7Days() {
        const recent = this.within(WINDOW_SHORT_DAYS);
        const map = new Map();
        recent.forEach((i) => {
            const key = i.location || 'Unspecified';
            if (!map.has(key)) map.set(key, []);
            map.get(key).push(i);
        });
        return Array.from(map.entries())
            .filter(([, items]) => items.length >= 3)
            .map(([location, items]) => ({
                location,
                count: items.length,
                incidents: items,
                severities: items.reduce((acc, it) => {
                    acc[it.severity] = (acc[it.severity] || 0) + 1;
                    return acc;
                }, {})
            }))
            .sort((a, b) => b.count - a.count);
    }

    /** Hour-of-day buckets with 4+ incidents in last 30 days */
    timeClusters() {
        const recent = this.within(WINDOW_MEDIUM_DAYS);
        const buckets = HOUR_LABELS.map((h, idx) => ({ hour: h, idx, items: [] }));
        recent.forEach((i) => {
            buckets[i.date.getHours()].items.push(i);
        });
        return buckets
            .filter((b) => b.items.length >= 4)
            .map((b) => ({
                hour: b.hour,
                count: b.items.length,
                incidents: b.items
            }))
            .sort((a, b) => b.count - a.count);
    }

    /** Any Critical severity in the last 48 hours */
    criticalRecent() {
        const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000);
        return this.incidents.filter(
            (i) => i.severity === 'Critical' && i.date >= cutoff
        );
    }

    /** Per-site trend: last 14 days vs prior 14 days */
    trendBySite() {
        const now = Date.now();
        const split = now - TREND_WINDOW_DAYS * 24 * 60 * 60 * 1000;
        const startPrior = now - 2 * TREND_WINDOW_DAYS * 24 * 60 * 60 * 1000;

        const map = new Map();
        this.incidents.forEach((i) => {
            const t = i.date.getTime();
            if (t < startPrior) return;
            const key = i.location || 'Unspecified';
            if (!map.has(key)) map.set(key, { recent: 0, prior: 0 });
            const entry = map.get(key);
            if (t >= split) entry.recent++;
            else entry.prior++;
        });

        return Array.from(map.entries()).map(([location, { recent, prior }]) => {
            let direction = 'stable';
            let pct = 0;
            if (prior === 0 && recent > 0) {
                direction = 'up';
                pct = 100;
            } else if (prior > 0) {
                pct = Math.round(((recent - prior) / prior) * 100);
                if (pct >= TREND_THRESHOLD_PCT) direction = 'up';
                else if (pct <= -TREND_THRESHOLD_PCT) direction = 'down';
            }
            return { location, recent, prior, direction, change_pct: pct };
        }).sort((a, b) => b.recent - a.recent);
    }
}

// ═══════════════════════════════════════════════════════════════
// RISK SCORER
// ═══════════════════════════════════════════════════════════════

class RiskScorer {
    constructor(incidents) {
        this.incidents = incidents || [];
    }

    /**
     * Score 0-100 for a site.
     * Formula:
     *   weighted_30d    = sum(severity_weight) over last 30 days
     *   weighted_7d     = sum(severity_weight) over last 7 days
     *   raw             = weighted_30d + (weighted_7d * 2)   // recency boost
     *   score           = min(100, round(raw / 40 * 100))     // 40 weighted points = 100%
     */
    scoreForSite(site) {
        const now = Date.now();
        const cutoff30 = now - 30 * 24 * 60 * 60 * 1000;
        const cutoff7  = now - 7  * 24 * 60 * 60 * 1000;

        let weighted30 = 0;
        let weighted7  = 0;
        let count30 = 0;
        let critical30 = 0;

        this.incidents.forEach((i) => {
            if ((i.location || 'Unspecified') !== site) return;
            const t = i.date.getTime();
            if (t < cutoff30) return;
            const w = SEVERITY_WEIGHTS[i.severity] || 1;
            weighted30 += w;
            count30++;
            if (i.severity === 'Critical') critical30++;
            if (t >= cutoff7) weighted7 += w;
        });

        const raw = weighted30 + weighted7 * 2;
        const score = Math.min(100, Math.round((raw / 40) * 100));

        let level = 'Low';
        if (score >= 70) level = 'Critical';
        else if (score >= 50) level = 'High';
        else if (score >= 25) level = 'Medium';

        return { site, score, level, count30, critical30, weighted30, weighted7 };
    }

    allSites() {
        const sites = new Set();
        this.incidents.forEach((i) => sites.add(i.location || 'Unspecified'));
        return Array.from(sites)
            .map((s) => this.scoreForSite(s))
            .filter((s) => s.count30 > 0)
            .sort((a, b) => b.score - a.score);
    }
}

// ═══════════════════════════════════════════════════════════════
// ALERT ENGINE
// ═══════════════════════════════════════════════════════════════

class AlertEngine {
    constructor(incidents, patterns, risk) {
        this.incidents = incidents;
        this.patterns = patterns;
        this.risk = risk;
    }

    evaluate() {
        const alerts = [];

        // 1. Hotspot alerts
        this.patterns.hotspotsLast7Days().forEach((h) => {
            alerts.push({
                type: 'hotspot',
                severity: h.count >= 5 ? 'high' : 'medium',
                title: `Hotspot: ${h.location}`,
                description: `${h.count} incidents in the last 7 days at ${h.location}.`,
                location: h.location,
                metric: h.count,
                incident_ids: h.incidents.map((i) => i.id).slice(0, 10)
            });
        });

        // 2. Time cluster alerts
        this.patterns.timeClusters().forEach((c) => {
            alerts.push({
                type: 'time_cluster',
                severity: c.count >= 6 ? 'high' : 'medium',
                title: `Recurring incidents around ${c.hour}:00`,
                description: `${c.count} incidents have occurred around ${c.hour}:00 in the last 30 days.`,
                location: '',
                metric: c.count,
                incident_ids: c.incidents.map((i) => i.id).slice(0, 10)
            });
        });

        // 3. Critical incident alerts
        const critical = this.patterns.criticalRecent();
        if (critical.length > 0) {
            const locs = Array.from(new Set(critical.map((i) => i.location).filter(Boolean))).join(', ');
            alerts.push({
                type: 'critical',
                severity: 'high',
                title: `${critical.length} Critical incident${critical.length > 1 ? 's' : ''} in last 48h`,
                description: locs
                    ? `Critical events recorded at: ${locs}. Immediate review required.`
                    : 'Critical event(s) recorded in the last 48 hours.',
                location: locs,
                metric: critical.length,
                incident_ids: critical.map((i) => i.id).slice(0, 10)
            });
        }

        // 4. Trend increase alerts
        this.patterns.trendBySite().forEach((t) => {
            if (t.direction === 'up' && t.recent >= 3) {
                alerts.push({
                    type: 'trend_increase',
                    severity: t.recent >= 5 ? 'high' : 'medium',
                    title: `Rising trend: ${t.location}`,
                    description: `${t.recent} incidents in the last 14 days vs ${t.prior} in the prior 14 days (+${t.change_pct}%).`,
                    location: t.location,
                    metric: t.recent,
                    incident_ids: []
                });
            }
        });

        // Attach fingerprints
        alerts.forEach((a) => {
            a.fingerprint = fingerprint([a.type, a.location || '', a.title]);
        });

        return alerts;
    }

    /** Save to Firestore, skipping alerts already opened in the last 24h */
    async persist(alerts, existing) {
        const recentCutoff = new Date(Date.now() - ALERT_DEDUP_HOURS * 60 * 60 * 1000);
        const existingFingerprints = new Set(
            (existing || [])
                .filter((e) => {
                    const d = toDate(e.created_at_iso || e.created_at);
                    return d && d >= recentCutoff;
                })
                .map((e) => e.fingerprint)
                .filter(Boolean)
        );

        let created = 0;
        for (const a of alerts) {
            if (existingFingerprints.has(a.fingerprint)) continue;

            const id = 'ALERT-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6);
            try {
                await setDoc(doc(db, 'predictive_alerts', id), {
                    id,
                    fingerprint: a.fingerprint,
                    type: a.type,
                    severity: a.severity,
                    title: a.title,
                    description: a.description,
                    location: a.location || '',
                    metric: a.metric || 0,
                    incident_ids: a.incident_ids || [],
                    status: 'open',
                    created_at: serverTimestamp(),
                    created_at_iso: new Date().toISOString(),
                    created_by: window.mmsCurrentUser?.email || 'system'
                });
                created++;
            } catch (err) {
                console.warn('[predictive] Failed to persist alert:', err.code || err.message);
            }
        }
        return created;
    }

    async loadOpenAlerts() {
        try {
            const q = query(collection(db, 'predictive_alerts'), orderBy('created_at_iso', 'desc'));
            const snap = await getDocs(q);
            const out = [];
            snap.forEach((d) => {
                const data = d.data() || {};
                if (data.status === 'open') out.push(data);
            });
            return out.slice(0, 30);
        } catch (err) {
            console.warn('[predictive] Failed to load alerts:', err.code || err.message);
            return [];
        }
    }

    async dismiss(id, reason = '') {
        try {
            await setDoc(doc(db, 'predictive_alerts', id), {
                status: 'dismissed',
                dismissed_at: serverTimestamp(),
                dismissed_at_iso: new Date().toISOString(),
                dismissed_by: window.mmsCurrentUser?.email || '',
                dismissed_reason: reason
            }, { merge: true });
            return true;
        } catch (err) {
            console.warn('[predictive] Dismiss failed:', err.code || err.message);
            return false;
        }
    }
}

// ═══════════════════════════════════════════════════════════════
// PREDICTIVE ENGINE (facade)
// ═══════════════════════════════════════════════════════════════

class PredictiveEngine {
    constructor() {
        this.lastResult = null;
        this.refreshing = false;
        this.timerHandle = null;
    }

    async refresh(reason = 'manual') {
        if (this.refreshing) {
            console.log('[predictive] Refresh already in progress, skipping');
            return this.lastResult;
        }
        this.refreshing = true;
        console.log('[predictive] Running analysis (reason:', reason + ')');

        try {
            const incidents = await loadAllIncidents();
            const detector = new PatternDetector(incidents);
            const scorer = new RiskScorer(incidents);
            const alerter = new AlertEngine(incidents, detector, scorer);

            const evaluated = alerter.evaluate();
            const existing = await alerter.loadOpenAlerts();
            const createdCount = await alerter.persist(evaluated, existing);
            const open = await alerter.loadOpenAlerts();

            this.lastResult = {
                analyzedAt: new Date().toISOString(),
                incidentCount: incidents.length,
                patterns: {
                    dayOfWeek: detector.byDayOfWeek(),
                    hourOfDay: detector.byHourOfDay(),
                    byType: detector.byType(),
                    bySeverity: detector.bySeverity(),
                    hotspots: detector.hotspotsLast7Days(),
                    trendBySite: detector.trendBySite(),
                    within7d: detector.within(7).length,
                    within30d: detector.within(30).length
                },
                risk: scorer.allSites(),
                alerts: open,
                newAlerts: createdCount
            };

            renderWidget(this.lastResult);
            return this.lastResult;
        } catch (err) {
            console.error('[predictive] Analysis failed:', err);
            renderError(err);
            return null;
        } finally {
            this.refreshing = false;
        }
    }

    getLastResult() {
        return this.lastResult;
    }

    startAutoRefresh() {
        if (this.timerHandle) clearInterval(this.timerHandle);
        this.timerHandle = setInterval(() => {
            if (document.visibilityState === 'visible') {
                this.refresh('auto');
            }
        }, REFRESH_INTERVAL_MS);
        console.log('[predictive] Auto-refresh started (every 15 min)');
    }

    async dismissAlert(id) {
        if (!window.confirm('Dismiss this alert? It will not reappear for 24 hours.')) return;
        const ok = await window.__predictive.alerter?.dismiss?.(id, 'dismissed by user');
        // Rebuild fresh — simpler than surgical update
        await this.refresh('dismiss');
    }
}

// Keep a reference to the last alerter for dismiss
let _lastAlerter = null;

// ═══════════════════════════════════════════════════════════════
// UI RENDERERS
// ═══════════════════════════════════════════════════════════════

function ensureWidget() {
    const mount = document.getElementById('predictiveWidgetMount');
    if (!mount) {
        console.warn('[predictive] #predictiveWidgetMount not found in DOM');
        return null;
    }
    let widget = document.getElementById('predictiveWidgetCard');
    if (!widget) {
        widget = document.createElement('div');
        widget.id = 'predictiveWidgetCard';
        widget.className = 'card';
        widget.style.marginBottom = '1.5rem';
        mount.appendChild(widget);
    }
    return widget;
}

function renderLoading() {
    const widget = ensureWidget();
    if (!widget) return;
    widget.innerHTML = `
        <div class="card-header">
            <div>
                <div class="card-title">Predictive Analytics</div>
                <div class="card-subtitle">Pattern detection on incident data</div>
            </div>
        </div>
        <div style="padding:2rem; text-align:center; color:#64748b;">Running analysis…</div>
    `;
}

function renderError(err) {
    const widget = ensureWidget();
    if (!widget) return;
    widget.innerHTML = `
        <div class="card-header">
            <div>
                <div class="card-title">Predictive Analytics</div>
                <div class="card-subtitle">Analysis unavailable</div>
            </div>
        </div>
        <div style="padding:2rem; text-align:center; color:#991b1b;">
            <div style="font-size:2rem; margin-bottom:0.5rem;">⚠️</div>
            <div style="font-weight:600;">Could not run analysis</div>
            <div style="font-size:0.85rem; margin-top:0.35rem;">${escapeHtml(err.code || err.message || 'Unknown error')}</div>
            <button class="btn btn-outline btn-sm" style="margin-top:1rem;" onclick="window.mmsPredictive.refresh()">Retry</button>
        </div>
    `;
}

function renderWidget(result) {
    const widget = ensureWidget();
    if (!widget) return;

    const { incidentCount, patterns, alerts, risk, newAlerts, analyzedAt } = result;

    // Empty state
    if (incidentCount === 0) {
        widget.innerHTML = `
            <div class="card-header">
                <div>
                    <div class="card-title">Predictive Analytics</div>
                    <div class="card-subtitle">Pattern detection on incident data</div>
                </div>
                <button class="btn btn-outline btn-sm" onclick="window.mmsPredictive.refresh()">🔄 Re-analyze</button>
            </div>
            <div style="text-align:center; padding:2.5rem 1rem; color:#64748b;">
                <div style="font-size:3rem; margin-bottom:0.75rem;">📈</div>
                <div style="font-weight:600; color:#0f172a; margin-bottom:0.35rem;">No incident data to analyze yet</div>
                <div style="font-size:0.9rem; max-width:440px; margin:0 auto;">As incidents are logged, this widget will surface hotspots, time-of-day patterns, and rising trends across your sites.</div>
            </div>
        `;
        return;
    }

    widget.innerHTML = `
        <div class="card-header">
            <div>
                <div class="card-title">Predictive Analytics</div>
                <div class="card-subtitle">${incidentCount} incidents analyzed · last run ${new Date(analyzedAt).toLocaleTimeString()}</div>
            </div>
            <div style="display:flex; gap:0.5rem; align-items:center;">
                ${newAlerts > 0 ? `<span style="font-size:0.72rem; font-weight:700; padding:0.2rem 0.55rem; background:#fee2e2; color:#991b1b; border-radius:8px;">${newAlerts} new alert${newAlerts > 1 ? 's' : ''}</span>` : ''}
                <button class="btn btn-outline btn-sm" onclick="window.mmsPredictive.refresh()">🔄 Re-analyze</button>
            </div>
        </div>

        ${renderSummaryRow(result)}
        ${renderAlerts(alerts)}
        ${renderRiskSites(risk)}
        ${renderHotspots(patterns.hotspots)}
        ${renderTimeChart(patterns.hourOfDay)}
        ${renderDayChart(patterns.dayOfWeek)}
    `;
}

function renderSummaryRow(result) {
    const { patterns } = result;
    const worst = result.risk[0];

    return `
        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(160px,1fr)); gap:0.75rem; margin-bottom:1.25rem;">
            ${summaryTile('Last 7 days', patterns.within7d, 'var(--primary)')}
            ${summaryTile('Last 30 days', patterns.within30d, 'var(--gray-900)')}
            ${worst
                ? summaryTile('Highest risk site', `${worst.score}/100`, worst.level === 'Critical' ? '#991b1b' : worst.level === 'High' ? '#9a3412' : worst.level === 'Medium' ? '#92400e' : '#065f46', worst.site)
                : summaryTile('Highest risk site', '—', 'var(--gray-500)', 'No data')}
            ${summaryTile('Open alerts', result.alerts.length, result.alerts.length > 0 ? 'var(--primary)' : 'var(--gray-900)')}
        </div>
    `;
}

function summaryTile(label, value, color, sub) {
    return `
        <div style="padding:0.9rem 1rem; background:var(--gray-50); border:1px solid var(--gray-200); border-radius:12px;">
            <div style="font-size:1.4rem; font-weight:800; color:${color}; line-height:1;">${escapeHtml(String(value))}</div>
            <div style="font-size:0.68rem; color:#64748b; text-transform:uppercase; letter-spacing:0.4px; margin-top:0.35rem; font-weight:700;">${escapeHtml(label)}</div>
            ${sub ? `<div style="font-size:0.72rem; color:#94a3b8; margin-top:0.15rem;">${escapeHtml(sub)}</div>` : ''}
        </div>
    `;
}

function renderAlerts(alerts) {
    if (!alerts || alerts.length === 0) {
        return `
            <div style="margin-bottom:1.25rem;">
                <div style="font-size:0.72rem; text-transform:uppercase; letter-spacing:0.5px; color:#64748b; font-weight:700; margin-bottom:0.5rem;">Active Alerts</div>
                <div style="padding:1rem 1.15rem; background:#ecfdf5; border-left:3px solid #10b981; border-radius:8px; font-size:0.85rem; color:#065f46;">
                    ✓ No active alerts. Incident patterns are within normal ranges.
                </div>
            </div>
        `;
    }

    const rows = alerts.map((a) => {
        const sev = a.severity === 'high' ? { bg: '#fef2f2', fg: '#991b1b', border: '#fecaca' }
                  : a.severity === 'medium' ? { bg: '#fffbeb', fg: '#92400e', border: '#fde68a' }
                  : { bg: '#eff6ff', fg: '#1e40af', border: '#bfdbfe' };
        return `
            <div style="padding:0.85rem 1rem; background:${sev.bg}; border:1px solid ${sev.border}; border-radius:10px; margin-bottom:0.6rem;">
                <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:0.75rem; flex-wrap:wrap;">
                    <div style="flex:1; min-width:0;">
                        <div style="font-weight:700; color:${sev.fg}; font-size:0.87rem;">${escapeHtml(a.title)}</div>
                        <div style="font-size:0.82rem; color:#475569; margin-top:0.2rem; line-height:1.5;">${escapeHtml(a.description)}</div>
                    </div>
                    <button class="btn btn-outline btn-sm" onclick="window.mmsPredictive.dismissAlert('${escapeHtml(a.id)}')">Dismiss</button>
                </div>
            </div>
        `;
    }).join('');

    return `
        <div style="margin-bottom:1.25rem;">
            <div style="font-size:0.72rem; text-transform:uppercase; letter-spacing:0.5px; color:#64748b; font-weight:700; margin-bottom:0.5rem;">Active Alerts (${alerts.length})</div>
            ${rows}
        </div>
    `;
}

function renderRiskSites(risk) {
    if (!risk || risk.length === 0) return '';

    const top = risk.slice(0, 5);
    const rows = top.map((s) => {
        const cls = s.level === 'Critical' ? { bg: '#fef2f2', fg: '#991b1b' }
                  : s.level === 'High' ? { bg: '#fff7ed', fg: '#9a3412' }
                  : s.level === 'Medium' ? { bg: '#fffbeb', fg: '#92400e' }
                  : { bg: '#ecfdf5', fg: '#065f46' };
        return `
            <div style="display:grid; grid-template-columns:1fr 60px 100px 80px; gap:0.75rem; align-items:center; padding:0.65rem 0.85rem; border-bottom:1px solid var(--gray-100);">
                <div style="font-weight:600; font-size:0.85rem; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${escapeHtml(s.site)}</div>
                <div style="font-weight:800; color:${cls.fg}; font-size:0.95rem; text-align:right;">${s.score}</div>
                <div style="text-align:right;">
                    <span style="font-size:0.68rem; font-weight:700; padding:0.15rem 0.5rem; background:${cls.bg}; color:${cls.fg}; border-radius:6px; text-transform:uppercase;">${escapeHtml(s.level)}</span>
                </div>
                <div style="font-size:0.75rem; color:#64748b; text-align:right;">${s.count30} inc / 30d</div>
            </div>
        `;
    }).join('');

    return `
        <div style="margin-bottom:1.25rem;">
            <div style="font-size:0.72rem; text-transform:uppercase; letter-spacing:0.5px; color:#64748b; font-weight:700; margin-bottom:0.5rem;">Site Risk Scores</div>
            <div style="background:white; border:1px solid var(--gray-200); border-radius:10px; overflow:hidden;">
                <div style="display:grid; grid-template-columns:1fr 60px 100px 80px; gap:0.75rem; padding:0.55rem 0.85rem; background:var(--gray-50); border-bottom:1px solid var(--gray-200); font-size:0.68rem; text-transform:uppercase; letter-spacing:0.4px; color:#64748b; font-weight:700;">
                    <div>Site</div><div style="text-align:right;">Score</div><div style="text-align:right;">Level</div><div style="text-align:right;">Volume</div>
                </div>
                ${rows}
            </div>
        </div>
    `;
}

function renderHotspots(hotspots) {
    if (!hotspots || hotspots.length === 0) return '';
    const rows = hotspots.slice(0, 5).map((h) => {
        const sev = Object.entries(h.severities).map(([k, v]) => `${v} ${k}`).join(' · ');
        return `
            <div style="padding:0.7rem 0.9rem; background:#fef2f2; border-left:3px solid #dc2626; border-radius:8px; margin-bottom:0.5rem;">
                <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:0.75rem; flex-wrap:wrap;">
                    <div style="font-weight:700; font-size:0.87rem; color:#991b1b;">${escapeHtml(h.location)}</div>
                    <div style="font-weight:800; color:#dc2626; font-size:0.95rem;">${h.count} incidents / 7d</div>
                </div>
                <div style="font-size:0.78rem; color:#7f1d1d; margin-top:0.25rem;">${escapeHtml(sev)}</div>
            </div>
        `;
    }).join('');

    return `
        <div style="margin-bottom:1.25rem;">
            <div style="font-size:0.72rem; text-transform:uppercase; letter-spacing:0.5px; color:#64748b; font-weight:700; margin-bottom:0.5rem;">Hotspots — 3+ incidents in 7 days (${hotspots.length})</div>
            ${rows}
        </div>
    `;
}

function renderTimeChart(buckets) {
    const max = Math.max(...buckets.map((b) => b.count), 1);
    const bars = buckets.map((b) => {
        const pct = (b.count / max) * 100;
        return `
            <div style="flex:1; min-width:0; display:flex; flex-direction:column; align-items:center; gap:2px;">
                <div style="width:100%; height:50px; display:flex; align-items:flex-end;">
                    <div style="width:100%; height:${pct}%; background:linear-gradient(180deg, var(--primary), var(--primary-light)); border-radius:2px 2px 0 0; min-height:${b.count > 0 ? '3px' : '0'};" title="${b.hour}:00 — ${b.count} incidents"></div>
                </div>
                <div style="font-size:0.55rem; color:#94a3b8;">${b.hour}</div>
            </div>
        `;
    }).join('');

    return `
        <div style="margin-bottom:1.25rem;">
            <div style="font-size:0.72rem; text-transform:uppercase; letter-spacing:0.5px; color:#64748b; font-weight:700; margin-bottom:0.5rem;">Hour-of-Day Distribution</div>
            <div style="display:flex; gap:2px; align-items:flex-end; background:var(--gray-50); padding:0.75rem; border-radius:8px;">${bars}</div>
        </div>
    `;
}

function renderDayChart(buckets) {
    const max = Math.max(...buckets.map((b) => b.count), 1);
    const bars = buckets.map((b) => {
        const pct = (b.count / max) * 100;
        return `
            <div style="flex:1; display:flex; flex-direction:column; align-items:center; gap:2px;">
                <div style="width:100%; height:60px; display:flex; align-items:flex-end;">
                    <div style="width:100%; height:${pct}%; background:linear-gradient(180deg, #1e40af, #3b82f6); border-radius:2px 2px 0 0; min-height:${b.count > 0 ? '3px' : '0'};" title="${b.name} — ${b.count} incidents"></div>
                </div>
                <div style="font-size:0.6rem; color:#94a3b8;">${b.name.slice(0, 3)}</div>
            </div>
        `;
    }).join('');

    return `
        <div>
            <div style="font-size:0.72rem; text-transform:uppercase; letter-spacing:0.5px; color:#64748b; font-weight:700; margin-bottom:0.5rem;">Day-of-Week Distribution</div>
            <div style="display:flex; gap:4px; align-items:flex-end; background:var(--gray-50); padding:0.75rem; border-radius:8px;">${bars}</div>
        </div>
    `;
}

// ═══════════════════════════════════════════════════════════════
// PUBLIC API
// ═══════════════════════════════════════════════════════════════

const engine = new PredictiveEngine();

window.mmsPredictive = {
    refresh: (reason) => engine.refresh(reason),
    getLastResult: () => engine.getLastResult(),
    startAutoRefresh: () => engine.startAutoRefresh(),
    dismissAlert: async (id) => {
        if (!confirm('Dismiss this alert? It will not reappear for 24 hours.')) return;
        try {
            // Load alerter, dismiss, then refresh
            const incidents = await loadAllIncidents();
            const detector = new PatternDetector(incidents);
            const scorer = new RiskScorer(incidents);
            const alerter = new AlertEngine(incidents, detector, scorer);
            await alerter.dismiss(id, 'dismissed by user');
        } catch (err) {
            console.warn('[predictive] Dismiss failed:', err);
        }
        engine.refresh('dismiss');
    }
};

// ═══════════════════════════════════════════════════════════════
// BOOTSTRAP
// ═══════════════════════════════════════════════════════════════

function bootstrap() {
    if (!isSignedIn()) {
        console.log('[predictive] Not signed in yet — waiting for auth');
        // Try again when user becomes available
        let tries = 0;
        const check = setInterval(() => {
            tries++;
            if (isSignedIn() || tries > 30) {
                clearInterval(check);
                if (isSignedIn()) start();
            }
        }, 500);
        return;
    }
    start();
}

function start() {
    renderLoading();
    setTimeout(() => {
        engine.refresh('initial');
        engine.startAutoRefresh();
    }, 300);
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrap);
} else {
    bootstrap();
}

// Re-run when a new incident is submitted
window.addEventListener('mms-incident-created', () => {
    console.log('[predictive] Incident created — refreshing analysis');
    engine.refresh('incident-created');
});

console.log('[predictive-engine] Ready');