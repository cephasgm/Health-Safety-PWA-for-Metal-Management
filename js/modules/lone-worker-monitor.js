// ============================================================
// lone-worker-monitor.js
// Phase 5 - Lone worker safety with real GPS tracking
// ============================================================
//
// Features:
//   - Start/end a lone-work session
//   - Live GPS tracking (watchPosition, throttled to 1 write / 30s)
//   - Movement stall detection (15 min stationary -> alert)
//   - Periodic check-in timer (default 30 min, configurable)
//   - Manual SOS button -> immediate critical alert
//   - Resume session after page reload
//   - In-app alert list + browser push notifications
//   - Real Firestore persistence, zero mocks
//
// Firestore collections:
//   - lone_worker_sessions
//   - lone_worker_alerts
//
// Exposes: window.mmsLoneWorker.{start, checkIn, sos, end, getState}
// ============================================================

import { db } from '../core/firebase-config.js';
import {
    collection,
    doc,
    setDoc,
    getDoc,
    getDocs,
    query,
    where,
    orderBy,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";

// ============================================================
// CONSTANTS
// ============================================================

const TRACK_INTERVAL_MS      = 30000;
const MOVEMENT_THRESHOLD_M   = 20;
const STALL_ALERT_MS         = 15 * 60 * 1000;
const DEFAULT_CHECKIN_MIN    = 30;
const DEFAULT_DURATION_MIN   = 120;
const POSITION_HISTORY_CAP   = 200;
const HEARTBEAT_INTERVAL_MS  = 60000;
const ORPHAN_TIMEOUT_MS      = 5 * 60 * 1000;

const SESSION_STATUS = {
    ACTIVE:    'active',
    COMPLETED: 'completed',
    TIMED_OUT: 'timed_out',
    SOS:       'sos',
    CANCELLED: 'cancelled',
    ORPHANED:  'orphaned'
};

const ALERT_TYPE = {
    NO_MOVEMENT:    'no_movement',
    MISSED_CHECKIN: 'missed_checkin',
    SOS:            'sos',
    EXTENDED:       'extended',
    MANUAL:         'manual'
};

// Emoji/icon codes (used as unicode escapes so file encoding can't break them)
const ICO = {
    satellite:  '\u{1F6F0}\uFE0F',
    check:      '\u2713',
    sos:        '\u{1F6A8}',
    warning:    '\u26A0\uFE0F',
    live:       '\u25CF'
};

// ============================================================
// HELPERS
// ============================================================

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

function isAdmin() {
    return !!(window.mmsCurrentUser && window.mmsCurrentUser.isAdmin);
}

function haversineMeters(lat1, lon1, lat2, lon2) {
    const R = 6371000;
    const toRad = (d) => (d * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) ** 2 +
              Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(a));
}

function toDate(v) {
    if (!v) return null;
    if (v instanceof Date) return v;
    if (typeof v === 'object' && 'seconds' in v) return new Date(v.seconds * 1000);
    if (typeof v === 'number') return new Date(v);
    const d = new Date(v);
    return isNaN(d.getTime()) ? null : d;
}

function timeAgo(date) {
    const d = toDate(date);
    if (!d) return '-';
    const s = Math.floor((Date.now() - d.getTime()) / 1000);
    if (s < 60) return s + 's ago';
    if (s < 3600) return Math.floor(s / 60) + 'm ago';
    if (s < 86400) return Math.floor(s / 3600) + 'h ago';
    return Math.floor(s / 86400) + 'd ago';
}

function fmtDuration(ms) {
    if (!ms || ms < 0) return '0m';
    const s = Math.floor(ms / 1000);
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    if (h > 0) return h + 'h ' + m + 'm';
    return m + 'm';
}

function uid8() {
    return Math.random().toString(36).slice(2, 10);
}

// ============================================================
// GEOLOCATION TRACKER
// ============================================================

class GeoTracker {
    constructor() {
        this.watchId = null;
        this.lastWrite = 0;
        this.lastPosition = null;
        this.lastMovementAt = null;
        this.onPosition = null;
        this.onError = null;
        this.isRunning = false;
    }

    isSupported() {
        return 'geolocation' in navigator;
    }

    start(onPosition, onError) {
        if (this.isRunning) return true;
        if (!this.isSupported()) {
            onError?.(new Error('Geolocation not supported by this browser.'));
            return false;
        }

        this.onPosition = onPosition;
        this.onError = onError;
        this.lastMovementAt = new Date();

        this.watchId = navigator.geolocation.watchPosition(
            (pos) => this.handlePosition(pos),
            (err) => this.handleError(err),
            {
                enableHighAccuracy: true,
                maximumAge: 15000,
                timeout: 20000
            }
        );
        this.isRunning = true;
        return true;
    }

    stop() {
        if (this.watchId != null) {
            navigator.geolocation.clearWatch(this.watchId);
            this.watchId = null;
        }
        this.isRunning = false;
    }

    handlePosition(pos) {
        const now = Date.now();
        const { latitude: lat, longitude: lng, accuracy: acc } = pos.coords;

        if (this.lastPosition) {
            const dist = haversineMeters(this.lastPosition.lat, this.lastPosition.lng, lat, lng);
            if (dist >= MOVEMENT_THRESHOLD_M) {
                this.lastMovementAt = new Date(now);
            }
        } else {
            this.lastMovementAt = new Date(now);
        }

        const sample = { lat, lng, acc, ts: now, at: new Date(now).toISOString() };
        this.lastPosition = sample;

        if (now - this.lastWrite >= TRACK_INTERVAL_MS) {
            this.lastWrite = now;
            this.onPosition?.(sample);
        }
    }

    handleError(err) {
        const msgs = {
            1: 'Location permission denied. Enable in browser settings to resume tracking.',
            2: 'Location unavailable. Check GPS signal.',
            3: 'Location request timed out.'
        };
        this.onError?.(new Error(msgs[err.code] || err.message || 'Location error'));
    }

    getSnapshot() {
        return {
            lastPosition: this.lastPosition,
            lastMovementAt: this.lastMovementAt,
            running: this.isRunning
        };
    }
}

// ============================================================
// SESSION MANAGER
// ============================================================

class SessionManager {
    constructor() {
        this.COLLECTION = 'lone_worker_sessions';
    }

    async getActiveForCurrentUser() {
        if (!isSignedIn()) return null;
        const uid = window.mmsCurrentUser.uid;

        try {
            const q = query(
                collection(db, this.COLLECTION),
                where('worker_uid', '==', uid),
                where('status', '==', SESSION_STATUS.ACTIVE)
            );
            const snap = await getDocs(q);
            if (snap.empty) return null;

            const items = [];
            snap.forEach((d) => items.push({ id: d.id, ...d.data() }));
            items.sort((a, b) => {
                const da = toDate(a.started_at_iso || a.started_at);
                const db_ = toDate(b.started_at_iso || b.started_at);
                return (db_?.getTime() || 0) - (da?.getTime() || 0);
            });
            return items[0];
        } catch (err) {
            console.warn('[lone-worker] Failed to load active session:', err.code || err.message);
            return null;
        }
    }

    async startSession(config) {
        if (!isSignedIn()) throw new Error('Sign in required.');

        const uid = window.mmsCurrentUser.uid;
        const email = window.mmsCurrentUser.email || '';
        const displayName = window.mmsCurrentUser.displayName || email;
        const now = new Date();

        const checkinInterval = Math.max(
            5,
            Number(config.checkin_interval_min) || DEFAULT_CHECKIN_MIN
        );
        const durationMin = Math.max(
            15,
            Number(config.expected_duration_min) || DEFAULT_DURATION_MIN
        );

        const id = 'LWS-' + Date.now() + '-' + uid8();

        const record = {
            id,
            worker_uid: uid,
            worker_email: email,
            worker_name: displayName,
            site: config.site || '',
            task: config.task || '',
            zone: config.zone || '',
            emergency_contact_name: config.emergency_contact_name || '',
            emergency_contact_phone: config.emergency_contact_phone || '',
            notes: config.notes || '',
            checkin_interval_min: checkinInterval,
            expected_duration_min: durationMin,
            status: SESSION_STATUS.ACTIVE,
            started_at: serverTimestamp(),
            started_at_iso: now.toISOString(),
            ended_at: null,
            ended_at_iso: null,
            end_reason: '',
            last_checkin_at: serverTimestamp(),
            last_checkin_at_iso: now.toISOString(),
            next_checkin_due_at_iso: new Date(now.getTime() + checkinInterval * 60000).toISOString(),
            last_heartbeat_at_iso: now.toISOString(),
            last_position: null,
            last_movement_at_iso: now.toISOString(),
            position_history: [],
            alert_count: 0
        };

        await setDoc(doc(db, this.COLLECTION, id), record);
        console.log('[lone-worker] Session started:', id);
        return record;
    }

    async updatePosition(sessionId, position) {
        try {
            const ref = doc(db, this.COLLECTION, sessionId);
            const snap = await getDoc(ref);
            if (!snap.exists()) return;
            const data = snap.data() || {};

            let history = Array.isArray(data.position_history) ? data.position_history.slice() : [];
            history.push({
                lat: position.lat,
                lng: position.lng,
                acc: Math.round(position.acc || 0),
                at: new Date(position.ts).toISOString()
            });
            if (history.length > POSITION_HISTORY_CAP) {
                history = history.slice(history.length - POSITION_HISTORY_CAP);
            }

            await setDoc(ref, {
                last_position: {
                    lat: position.lat,
                    lng: position.lng,
                    acc: Math.round(position.acc || 0),
                    at: new Date(position.ts).toISOString()
                },
                last_movement_at_iso: new Date(position.ts).toISOString(),
                position_history: history,
                last_heartbeat_at_iso: new Date().toISOString()
            }, { merge: true });
        } catch (err) {
            console.warn('[lone-worker] Position update failed:', err.code || err.message);
        }
    }

    async recordHeartbeat(sessionId) {
        try {
            await setDoc(doc(db, this.COLLECTION, sessionId), {
                last_heartbeat_at_iso: new Date().toISOString()
            }, { merge: true });
        } catch (err) {
            // silent - heartbeat is best-effort
        }
    }

    async checkIn(sessionId) {
        const now = new Date();
        try {
            const ref = doc(db, this.COLLECTION, sessionId);
            const snap = await getDoc(ref);
            if (!snap.exists()) return;
            const data = snap.data() || {};
            const interval = Number(data.checkin_interval_min) || DEFAULT_CHECKIN_MIN;

            await setDoc(ref, {
                last_checkin_at: serverTimestamp(),
                last_checkin_at_iso: now.toISOString(),
                next_checkin_due_at_iso: new Date(now.getTime() + interval * 60000).toISOString()
            }, { merge: true });
            console.log('[lone-worker] Checked in');
        } catch (err) {
            console.warn('[lone-worker] Check-in failed:', err.code || err.message);
            throw err;
        }
    }

    async endSession(sessionId, reason) {
        const now = new Date();
        try {
            const ref = doc(db, this.COLLECTION, sessionId);
            await setDoc(ref, {
                status: SESSION_STATUS.COMPLETED,
                ended_at: serverTimestamp(),
                ended_at_iso: now.toISOString(),
                end_reason: reason || 'manual'
            }, { merge: true });
            console.log('[lone-worker] Session ended:', sessionId);
        } catch (err) {
            console.warn('[lone-worker] End failed:', err.code || err.message);
            throw err;
        }
    }

    async markSos(sessionId) {
        try {
            await setDoc(doc(db, this.COLLECTION, sessionId), {
                status: SESSION_STATUS.SOS,
                sos_at_iso: new Date().toISOString()
            }, { merge: true });
        } catch (err) {
            console.warn('[lone-worker] SOS mark failed:', err.code || err.message);
        }
    }

    async incrementAlertCount(sessionId) {
        try {
            const ref = doc(db, this.COLLECTION, sessionId);
            const snap = await getDoc(ref);
            if (!snap.exists()) return;
            const n = (snap.data().alert_count || 0) + 1;
            await setDoc(ref, { alert_count: n }, { merge: true });
        } catch (err) { /* best-effort */ }
    }
}

// ============================================================
// ALERT MANAGER
// ============================================================

class AlertManager {
    constructor() {
        this.COLLECTION = 'lone_worker_alerts';
    }

    async create(session, type, severity, message, position) {
        const id = 'LWA-' + Date.now() + '-' + uid8();
        const record = {
            id,
            session_id: session.id,
            worker_uid: session.worker_uid,
            worker_email: session.worker_email,
            worker_name: session.worker_name,
            site: session.site || '',
            type,
            severity,
            message,
            status: 'open',
            position: position ? {
                lat: position.lat,
                lng: position.lng,
                acc: Math.round(position.acc || 0),
                at: new Date(position.ts).toISOString()
            } : null,
            created_at: serverTimestamp(),
            created_at_iso: new Date().toISOString(),
            acknowledged_at_iso: null,
            acknowledged_by: '',
            resolved_at_iso: null,
            resolved_by: ''
        };

        try {
            await setDoc(doc(db, this.COLLECTION, id), record);
            this.sendPushNotification(record);
            console.log('[lone-worker] Alert created:', type, severity);
            return record;
        } catch (err) {
            console.warn('[lone-worker] Alert persist failed:', err.code || err.message);
            return null;
        }
    }

    async listOpen() {
        try {
            const q = query(
                collection(db, this.COLLECTION),
                orderBy('created_at_iso', 'desc')
            );
            const snap = await getDocs(q);
            const out = [];
            snap.forEach((d) => {
                const data = d.data() || {};
                if (data.status === 'open') out.push(data);
            });
            return out.slice(0, 30);
        } catch (err) {
            console.warn('[lone-worker] List alerts failed:', err.code || err.message);
            return [];
        }
    }

    async acknowledge(id) {
        try {
            await setDoc(doc(db, this.COLLECTION, id), {
                status: 'acknowledged',
                acknowledged_at_iso: new Date().toISOString(),
                acknowledged_by: window.mmsCurrentUser?.email || 'unknown'
            }, { merge: true });
        } catch (err) {
            console.warn('[lone-worker] Ack failed:', err.code || err.message);
        }
    }

    async resolve(id) {
        try {
            await setDoc(doc(db, this.COLLECTION, id), {
                status: 'resolved',
                resolved_at_iso: new Date().toISOString(),
                resolved_by: window.mmsCurrentUser?.email || 'unknown'
            }, { merge: true });
        } catch (err) {
            console.warn('[lone-worker] Resolve failed:', err.code || err.message);
        }
    }

    sendPushNotification(alert) {
        const title = ICO.warning + ' Lone Worker ' + alert.severity.toUpperCase();

        if (window.mmsPush && typeof window.mmsPush.send === 'function') {
            try {
                window.mmsPush.send({ title, body: alert.message, tag: alert.id });
                return;
            } catch (err) {
                console.warn('[lone-worker] mmsPush.send failed:', err.message);
            }
        }

        if (!('Notification' in window)) return;
        if (Notification.permission !== 'granted') return;
        try {
            new Notification(title, {
                body: alert.message,
                tag: alert.id,
                requireInteraction: alert.severity === 'critical',
                icon: './icons/icon-128x128.png'
            });
        } catch (err) {
            console.warn('[lone-worker] Notification failed:', err.message);
        }
    }
}

// ============================================================
// CONTROLLER
// ============================================================

class LoneWorkerController {
    constructor() {
        this.tracker = new GeoTracker();
        this.sessions = new SessionManager();
        this.alerts = new AlertManager();

        this.currentSession = null;
        this.stallAlertFired = false;
        this.missedCheckinAlertFired = false;

        this.timers = {
            heartbeat: null,
            checkin: null,
            stall: null,
            uiRefresh: null
        };

        this.lastError = null;
    }

    async bootstrap() {
        if (!isSignedIn()) {
            let tries = 0;
            const check = setInterval(async () => {
                tries++;
                if (isSignedIn() || tries > 40) {
                    clearInterval(check);
                    if (isSignedIn()) await this.resumeOrIdle();
                }
            }, 500);
            return;
        }
        await this.resumeOrIdle();
    }

    async resumeOrIdle() {
        const existing = await this.sessions.getActiveForCurrentUser();
        if (existing) {
            const lastBeat = toDate(existing.last_heartbeat_at_iso);
            const stale = lastBeat && (Date.now() - lastBeat.getTime() > ORPHAN_TIMEOUT_MS);
            console.log('[lone-worker] Resuming session:', existing.id, stale ? '(stale)' : '');
            this.currentSession = existing;
            this.startTracking();
            this.startTimers();
        } else {
            console.log('[lone-worker] No active session - idle');
        }
        renderWidget(this);
    }

    async start(config) {
        if (this.currentSession) {
            alert('You already have an active lone-work session.');
            return;
        }

        if ('Notification' in window && Notification.permission === 'default') {
            try {
                await Notification.requestPermission();
            } catch (err) { /* user may deny */ }
        }

        try {
            const session = await this.sessions.startSession(config);
            this.currentSession = session;
            this.stallAlertFired = false;
            this.missedCheckinAlertFired = false;
            this.startTracking();
            this.startTimers();
            renderWidget(this);
        } catch (err) {
            alert('Could not start session: ' + (err.code || err.message));
        }
    }

    async checkIn() {
        if (!this.currentSession) return;
        try {
            await this.sessions.checkIn(this.currentSession.id);
            this.missedCheckinAlertFired = false;
            const refreshed = await this.sessions.getActiveForCurrentUser();
            if (refreshed) this.currentSession = refreshed;
            renderWidget(this);
        } catch (err) {
            alert('Check-in failed: ' + (err.code || err.message));
        }
    }

    async sos() {
        if (!this.currentSession) return;
        if (!confirm('Send SOS alert now? This will notify your supervisor immediately.')) return;

        const pos = this.tracker.getSnapshot().lastPosition;
        await this.alerts.create(
            this.currentSession,
            ALERT_TYPE.SOS,
            'critical',
            'SOS triggered by ' + this.currentSession.worker_name + ' at ' + (this.currentSession.site || 'unknown site'),
            pos
        );
        await this.sessions.markSos(this.currentSession.id);
        await this.sessions.incrementAlertCount(this.currentSession.id);

        const refreshed = await this.sessions.getActiveForCurrentUser();
        if (refreshed) this.currentSession = refreshed;
        renderWidget(this);
    }

    async end(reason) {
        if (!this.currentSession) return;
        if (!confirm('End this lone-work session?')) return;

        try {
            await this.sessions.endSession(this.currentSession.id, reason || 'manual');
            this.stopTracking();
            this.stopTimers();
            this.currentSession = null;
            renderWidget(this);
        } catch (err) {
            alert('End failed: ' + (err.code || err.message));
        }
    }

    startTracking() {
        const started = this.tracker.start(
            (position) => {
                if (!this.currentSession) return;
                this.sessions.updatePosition(this.currentSession.id, position);
            },
            (err) => {
                this.lastError = err.message;
                console.warn('[lone-worker] GPS error:', err.message);
                renderWidget(this);
            }
        );

        if (!started) {
            this.lastError = 'Geolocation not available in this browser.';
        }
    }

    stopTracking() {
        this.tracker.stop();
    }

    startTimers() {
        this.stopTimers();

        this.timers.heartbeat = setInterval(() => {
            if (this.currentSession) {
                this.sessions.recordHeartbeat(this.currentSession.id);
            }
        }, HEARTBEAT_INTERVAL_MS);

        this.timers.checkin = setInterval(() => {
            this.evaluateCheckin();
        }, 10000);

        this.timers.stall = setInterval(() => {
            this.evaluateStall();
        }, 30000);

        this.timers.uiRefresh = setInterval(() => {
            renderWidget(this);
        }, 15000);
    }

    stopTimers() {
        Object.values(this.timers).forEach((t) => { if (t) clearInterval(t); });
        this.timers = { heartbeat: null, checkin: null, stall: null, uiRefresh: null };
    }

    async evaluateCheckin() {
        if (!this.currentSession) return;
        const due = toDate(this.currentSession.next_checkin_due_at_iso);
        if (!due) return;
        if (Date.now() < due.getTime()) return;
        if (this.missedCheckinAlertFired) return;

        this.missedCheckinAlertFired = true;
        const pos = this.tracker.getSnapshot().lastPosition;
        await this.alerts.create(
            this.currentSession,
            ALERT_TYPE.MISSED_CHECKIN,
            'high',
            'Check-in overdue for ' + this.currentSession.worker_name + ' at ' + (this.currentSession.site || 'unknown site'),
            pos
        );
        await this.sessions.incrementAlertCount(this.currentSession.id);
    }

    async evaluateStall() {
        if (!this.currentSession) return;
        const snap = this.tracker.getSnapshot();
        if (!snap.lastMovementAt) return;

        const stalled = Date.now() - snap.lastMovementAt.getTime();
        if (stalled < STALL_ALERT_MS) return;
        if (this.stallAlertFired) return;

        this.stallAlertFired = true;
        const pos = snap.lastPosition;
        await this.alerts.create(
            this.currentSession,
            ALERT_TYPE.NO_MOVEMENT,
            'high',
            'No movement detected for ' + Math.round(stalled / 60000) + ' min - ' + this.currentSession.worker_name,
            pos
        );
        await this.sessions.incrementAlertCount(this.currentSession.id);
    }

    getState() {
        return {
            session: this.currentSession,
            tracker: this.tracker.getSnapshot(),
            lastError: this.lastError
        };
    }
}

// ============================================================
// UI RENDERERS
// ============================================================

let _controller = null;

function ensureWidget() {
    const mount = document.getElementById('loneWorkerWidgetMount');
    if (!mount) {
        console.warn('[lone-worker] #loneWorkerWidgetMount not found in DOM');
        return null;
    }
    let widget = document.getElementById('loneWorkerWidgetCard');
    if (!widget) {
        widget = document.createElement('div');
        widget.id = 'loneWorkerWidgetCard';
        widget.className = 'card';
        widget.style.marginBottom = '1.5rem';
        mount.appendChild(widget);
    }
    return widget;
}

async function renderWidget(controller) {
    if (!controller) controller = _controller;
    if (!controller) return;

    const widget = ensureWidget();
    if (!widget) return;

    const { session, tracker, lastError } = controller.getState();

    if (!session) {
        widget.innerHTML = renderIdle();
        return;
    }

    const alerts = await controller.alerts.listOpen();
    widget.innerHTML = renderActive(session, tracker, lastError, alerts);
}

function renderIdle() {
    return `
        <div class="card-header">
            <div>
                <div class="card-title">Lone Worker Monitor</div>
                <div class="card-subtitle">GPS tracking + check-in + SOS for solo field work</div>
            </div>
        </div>
        <div style="text-align:center; padding:1.75rem 1rem;">
            <div style="font-size:2.5rem; margin-bottom:0.5rem;">${ICO.satellite}</div>
            <div style="font-weight:600; color:#0f172a; margin-bottom:0.35rem;">No active session</div>
            <div style="font-size:0.85rem; color:#64748b; max-width:480px; margin:0 auto 1.25rem;">
                Start a session when working alone or in a remote area. Your location is tracked every 30 seconds,
                and alerts fire if you stop moving, miss a check-in, or trigger SOS.
            </div>
            <button class="btn btn-primary" onclick="window.mmsLoneWorker.openStartDialog()">${ICO.satellite} Start Lone Work</button>
        </div>
    `;
}

function renderActive(session, tracker, lastError, alerts) {
    const started = toDate(session.started_at_iso);
    const elapsedMs = started ? (Date.now() - started.getTime()) : 0;
    const dueCheckin = toDate(session.next_checkin_due_at_iso);
    const dueInMs = dueCheckin ? (dueCheckin.getTime() - Date.now()) : 0;

    let checkinLabel, checkinColor;
    if (dueInMs <= 0) {
        checkinLabel = 'OVERDUE';
        checkinColor = '#dc2626';
    } else {
        checkinLabel = 'due in ' + fmtDuration(dueInMs);
        checkinColor = dueInMs < 5 * 60000 ? '#92400e' : '#065f46';
    }

    const gps = tracker.lastPosition;
    const gpsLabel = gps
        ? (gps.lat.toFixed(5) + ', ' + gps.lng.toFixed(5) + ' +-' + Math.round(gps.acc || 0) + 'm')
        : (tracker.running ? 'Waiting for GPS fix...' : 'Not tracking');

    const movementAgo = tracker.lastMovementAt ? timeAgo(tracker.lastMovementAt) : '-';

    const alertsHtml = alerts.length === 0
        ? '<div style="padding:0.75rem 0.9rem; background:#ecfdf5; border-left:3px solid #10b981; border-radius:8px; font-size:0.82rem; color:#065f46;">' + ICO.check + ' No open alerts for your sessions</div>'
        : alerts.map((a) => `
            <div style="padding:0.75rem 0.9rem; background:${a.severity === 'critical' ? '#fef2f2' : '#fffbeb'}; border-left:3px solid ${a.severity === 'critical' ? '#dc2626' : '#f59e0b'}; border-radius:8px; margin-bottom:0.5rem;">
                <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:0.75rem; flex-wrap:wrap;">
                    <div style="flex:1; min-width:0;">
                        <div style="font-size:0.72rem; font-weight:700; color:${a.severity === 'critical' ? '#991b1b' : '#92400e'}; text-transform:uppercase; letter-spacing:0.4px;">${escapeHtml(String(a.type || '').replace('_', ' '))}</div>
                        <div style="font-size:0.83rem; color:#334155; margin-top:0.15rem;">${escapeHtml(a.message)}</div>
                        <div style="font-size:0.72rem; color:#94a3b8; margin-top:0.25rem;">${timeAgo(a.created_at_iso)}</div>
                    </div>
                    <button class="btn btn-outline btn-sm" onclick="window.mmsLoneWorker.resolveAlert('${escapeHtml(a.id)}')">Resolve</button>
                </div>
            </div>
        `).join('');

    return `
        <div class="card-header">
            <div>
                <div class="card-title">Lone Worker Monitor</div>
                <div class="card-subtitle">Active session - started ${started ? started.toLocaleTimeString() : '-'}</div>
            </div>
            <div style="display:flex; gap:0.5rem; align-items:center;">
                <span style="font-size:0.7rem; font-weight:700; padding:0.2rem 0.55rem; background:#ecfdf5; color:#065f46; border-radius:8px; text-transform:uppercase;">${ICO.live} Live</span>
                <button class="btn btn-outline btn-sm" onclick="window.mmsLoneWorker.end()">End Session</button>
            </div>
        </div>

        <div style="display:grid; grid-template-columns:repeat(auto-fit,minmax(160px,1fr)); gap:0.75rem; margin-bottom:1.25rem;">
            <div style="padding:0.9rem 1rem; background:var(--gray-50); border:1px solid var(--gray-200); border-radius:12px;">
                <div style="font-size:1.4rem; font-weight:800; color:var(--gray-900); line-height:1;">${fmtDuration(elapsedMs)}</div>
                <div style="font-size:0.68rem; color:#64748b; text-transform:uppercase; letter-spacing:0.4px; margin-top:0.35rem; font-weight:700;">Elapsed</div>
            </div>
            <div style="padding:0.9rem 1rem; background:var(--gray-50); border:1px solid var(--gray-200); border-radius:12px;">
                <div style="font-size:1.4rem; font-weight:800; color:${checkinColor}; line-height:1;">${checkinLabel}</div>
                <div style="font-size:0.68rem; color:#64748b; text-transform:uppercase; letter-spacing:0.4px; margin-top:0.35rem; font-weight:700;">Next Check-in</div>
            </div>
            <div style="padding:0.9rem 1rem; background:var(--gray-50); border:1px solid var(--gray-200); border-radius:12px;">
                <div style="font-size:0.9rem; font-weight:700; color:var(--gray-900); line-height:1.2;">${escapeHtml(session.site || '-')}</div>
                <div style="font-size:0.68rem; color:#64748b; text-transform:uppercase; letter-spacing:0.4px; margin-top:0.35rem; font-weight:700;">Site</div>
            </div>
            <div style="padding:0.9rem 1rem; background:var(--gray-50); border:1px solid var(--gray-200); border-radius:12px;">
                <div style="font-size:0.85rem; font-weight:700; color:var(--gray-900); line-height:1.2;">${movementAgo}</div>
                <div style="font-size:0.68rem; color:#64748b; text-transform:uppercase; letter-spacing:0.4px; margin-top:0.35rem; font-weight:700;">Last Movement</div>
            </div>
        </div>

        <div style="padding:0.85rem 1rem; background:#eff6ff; border:1px solid #bfdbfe; border-radius:10px; margin-bottom:1.25rem; font-size:0.82rem; color:#1e40af;">
            <strong>GPS:</strong> ${escapeHtml(gpsLabel)}
            ${lastError ? `<div style="margin-top:0.35rem; color:#991b1b;">${ICO.warning} ${escapeHtml(lastError)}</div>` : ''}
        </div>

        <div style="display:flex; gap:0.6rem; margin-bottom:1.25rem; flex-wrap:wrap;">
            <button class="btn btn-success" onclick="window.mmsLoneWorker.checkIn()" style="flex:1; min-width:140px;">${ICO.check} Check In Now</button>
            <button class="btn btn-danger" onclick="window.mmsLoneWorker.sos()" style="flex:1; min-width:140px;">${ICO.sos} SOS</button>
        </div>

        <div style="font-size:0.72rem; text-transform:uppercase; letter-spacing:0.5px; color:#64748b; font-weight:700; margin-bottom:0.5rem;">Open Alerts (${alerts.length})</div>
        ${alertsHtml}
    `;
}

// ============================================================
// START DIALOG
// ============================================================

function openStartDialog() {
    if (!_controller) return;
    if (_controller.currentSession) {
        alert('You already have an active session.');
        return;
    }

    const site = prompt('Site / Location (e.g., Cape Town HQ):', '');
    if (site === null) return;
    const task = prompt('Task / Activity (e.g., Roof inspection):', '');
    if (task === null) return;
    const zone = prompt('Zone / Area (optional):', '') || '';
    const ecName = prompt('Emergency contact name (optional):', '') || '';
    const ecPhone = prompt('Emergency contact phone (optional):', '') || '';
    const interval = prompt('Check-in interval in minutes (5-240):', String(DEFAULT_CHECKIN_MIN));
    const duration = prompt('Expected duration in minutes (15-720):', String(DEFAULT_DURATION_MIN));

    _controller.start({
        site,
        task,
        zone,
        emergency_contact_name: ecName,
        emergency_contact_phone: ecPhone,
        checkin_interval_min: Number(interval) || DEFAULT_CHECKIN_MIN,
        expected_duration_min: Number(duration) || DEFAULT_DURATION_MIN
    });
}

// ============================================================
// PUBLIC API
// ============================================================

_controller = new LoneWorkerController();

window.mmsLoneWorker = {
    start:            (config) => _controller.start(config),
    openStartDialog:  () => openStartDialog(),
    checkIn:          () => _controller.checkIn(),
    sos:              () => _controller.sos(),
    end:              () => _controller.end('manual'),
    getState:         () => _controller.getState(),
    resolveAlert:     async (id) => {
        await _controller.alerts.resolve(id);
        renderWidget(_controller);
    },
    acknowledgeAlert: async (id) => {
        await _controller.alerts.acknowledge(id);
        renderWidget(_controller);
    }
};

// ============================================================
// BOOTSTRAP
// ============================================================

function bootstrap() {
    _controller.bootstrap();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrap);
} else {
    bootstrap();
}

console.log('[lone-worker-monitor] Ready');