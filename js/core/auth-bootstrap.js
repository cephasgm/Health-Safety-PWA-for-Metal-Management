/* ═══════════════════════════════════════════════════════════════
   auth-bootstrap.js — v9.22.0 compatible
   ═══════════════════════════════════════════════════════════════
   Matches the Firebase SDK version used in firebase-config.js
   ═══════════════════════════════════════════════════════════════ */

// ─── Reveal body FIRST so any error is visible ───
document.body.classList.remove('auth-pending');
console.log('[auth-bootstrap] Starting…');

// ─── Firebase imports (v9.22.0 — matches firebase-config.js) ───
import { auth, db } from '../core/firebase-config.js';
import {
    onAuthStateChanged,
    signOut
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";
import {
    doc,
    onSnapshot,
    getDoc
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";

console.log('[auth-bootstrap] Firebase loaded OK. auth?', !!auth, 'db?', !!db);

// ─── Guard: if auth or db are undefined, show a visible error ───
if (!auth || !db) {
    console.error('[auth-bootstrap] firebase-config.js did not provide auth/db.');
    showFatal('Firebase auth/db not initialized. Check js/core/firebase-config.js.');
    throw new Error('[auth-bootstrap] Missing Firebase exports');
}

// ─── State ───
let currentUser = null;
let currentProfile = null;
let profileUnsubscribe = null;

// ═══════════════════════════════════════════════════════════════
// AUTH GUARD
// ═══════════════════════════════════════════════════════════════
onAuthStateChanged(auth, function (user) {
    console.log('[auth-bootstrap] Auth state changed. User:', user ? user.email : '(none)');

    if (!user) {
        detachProfileListener();
        var next = encodeURIComponent(window.location.pathname + window.location.search);
        console.log('[auth-bootstrap] Not signed in. Redirecting to signin.html');
        window.location.replace('./signin.html?next=' + next);
        return;
    }

    currentUser = user;
    setUserEmail(user.email || user.displayName || '');
    setUserRole('Loading…');
    attachProfileListener(user.uid);
});

// ═══════════════════════════════════════════════════════════════
// PROFILE LISTENER
// ═══════════════════════════════════════════════════════════════
function attachProfileListener(uid) {
    detachProfileListener();
    var userDocRef = doc(db, 'users', uid);

    profileUnsubscribe = onSnapshot(
        userDocRef,
        function (snap) {
            if (snap.exists()) {
                currentProfile = snap.data();
                applyProfile(currentProfile);
            } else {
                console.warn('[auth-bootstrap] No users/' + uid + ' document found.');
                currentProfile = null;
                setUserRole('Unassigned');
                hideAdminElements();
                window.mmsCurrentUser = buildMMSUser(null);
            }
        },
        function (error) {
            console.warn('[auth-bootstrap] Profile listener error:', error.code, error.message);
            setUserRole('Unavailable');
            hideAdminElements();
            getDoc(userDocRef).then(function (snap) {
                if (snap.exists()) {
                    currentProfile = snap.data();
                    applyProfile(currentProfile);
                }
            }).catch(function () { /* silent */ });
        }
    );
}

function detachProfileListener() {
    if (profileUnsubscribe) {
        try { profileUnsubscribe(); } catch (e) { /* ignore */ }
        profileUnsubscribe = null;
    }
}

// ═══════════════════════════════════════════════════════════════
// APPLY PROFILE
// ═══════════════════════════════════════════════════════════════
function applyProfile(profile) {
    var role = profile.role || 'user';

    var roleLabels = {
        'admin':         'Administrator',
        'user':          'User',
        'pending_pilot': 'Pilot — Pending Approval',
        'pending':       'Pending Approval',
        'disabled':      'Account Disabled'
    };
    setUserRole(roleLabels[role] || role);

    if (role === 'admin') showAdminElements();
    else hideAdminElements();

    window.mmsCurrentUser = buildMMSUser(profile);
    console.log('[auth-bootstrap] User ready:', window.mmsCurrentUser);
}

function buildMMSUser(profile) {
    return {
        uid: currentUser ? currentUser.uid : null,
        email: currentUser ? currentUser.email : null,
        displayName: (currentUser && currentUser.displayName) ||
                     (profile ? ((profile.firstName || '') + ' ' + (profile.lastName || '')).trim() : ''),
        role: (profile && profile.role) || 'user',
        company: (profile && profile.company) || null,
        country: (profile && profile.country) || null,
        isAdmin: !!(profile && profile.role === 'admin'),
        profile: profile || null
    };
}

// ═══════════════════════════════════════════════════════════════
// HEADER HELPERS
// ═══════════════════════════════════════════════════════════════
function setUserEmail(email) {
    var el = document.getElementById('currentUserEmail');
    if (el) el.textContent = email || '';
}
function setUserRole(roleText) {
    var el = document.getElementById('currentUserRole');
    if (el) el.textContent = roleText || '';
}
function showAdminElements() {
    document.querySelectorAll('[data-permission="admin"]').forEach(function (el) {
        el.style.display = '';
    });
}
function hideAdminElements() {
    document.querySelectorAll('[data-permission="admin"]').forEach(function (el) {
        el.style.display = 'none';
    });
}

// ═══════════════════════════════════════════════════════════════
// FATAL ERROR DISPLAY
// ═══════════════════════════════════════════════════════════════
function showFatal(message) {
    document.body.classList.remove('auth-pending');
    var banner = document.createElement('div');
    banner.style.cssText =
        'position:fixed; top:0; left:0; right:0; z-index:99999; background:#fee2e2; ' +
        'color:#991b1b; padding:1rem 2rem; text-align:center; font-family:system-ui; ' +
        'font-size:0.95rem; border-bottom:2px solid #dc2626;';
    banner.innerHTML =
        '<strong>⚠️ Dashboard cannot load</strong> — ' + message +
        ' <button onclick="location.reload()" style="margin-left:1rem; padding:0.35rem 0.85rem; border:none; border-radius:6px; background:#991b1b; color:white; cursor:pointer; font-weight:600;">Reload</button>';
    document.body.prepend(banner);
}

// ═══════════════════════════════════════════════════════════════
// LOGOUT
// ═══════════════════════════════════════════════════════════════
window.handleMMSLogout = function () {
    detachProfileListener();
    signOut(auth).then(function () {
        window.location.href = './index.html';
    }).catch(function (err) {
        console.error('[logout] Firebase error:', err.code, err.message);
        alert('Logout failed: ' + (err.message || 'unknown error'));
    });
};

// ═══════════════════════════════════════════════════════════════
// SYNC STATUS BADGE
// ═══════════════════════════════════════════════════════════════
function updateSyncStatus() {
    var indicator = document.getElementById('syncStatusIndicator');
    var text = document.getElementById('syncStatusText');
    if (!indicator || !text) return;
    indicator.classList.remove('status-online', 'status-offline', 'status-pending');
    if (navigator.onLine) {
        indicator.classList.add('status-online');
        text.textContent = 'Online';
        indicator.title = 'Connected to the network';
    } else {
        indicator.classList.add('status-offline');
        text.textContent = 'Offline';
        indicator.title = 'No connection — changes saved locally, synced later';
    }
}
window.addEventListener('online', updateSyncStatus);
window.addEventListener('offline', updateSyncStatus);
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', updateSyncStatus);
} else {
    updateSyncStatus();
}

console.log('[auth-bootstrap] Ready.');