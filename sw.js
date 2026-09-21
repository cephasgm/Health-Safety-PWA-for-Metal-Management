/* ═══════════════════════════════════════════════════════════════
   MMS Safety — Service Worker
   ═══════════════════════════════════════════════════════════════

   Strategy:
     - Precache app shell on install
     - Network-first for HTML navigations (fresh content, offline fallback)
     - Stale-while-revalidate for same-origin JS/CSS
     - Cache-first for CDN libraries and images
     - Skip Firebase / Google Analytics — those handle their own offline

   Cache versioning: bump VERSION to invalidate all caches on deploy.
   ═══════════════════════════════════════════════════════════════ */

const VERSION = 'v3.0.2';
const STATIC_CACHE  = 'mms-static-' + VERSION;
const RUNTIME_CACHE = 'mms-runtime-' + VERSION;

// ─── App shell — precached on install ───
const PRECACHE_URLS = [
    './',
    './index.html',
    './signin.html',
    './signup.html',
    './dashboard.html',
    './offline.html',
    './manifest.json',
    './pwa-init.js',
    './js/core/firebase-config.js',
    './js/core/auth-bootstrap.js',
    './js/core/app.js',
    './js/core/auth-system.js',
    './js/core/database-service.js',
    './js/core/session-manager.js',
    './js/modules/hazard-identification.js',
    './js/modules/stakeholder-register.js',
    './js/modules/compliance-manager.js',
    './js/modules/audit-logger.js',
    './icons/icon-128x128.png',
    './icons/icon-144x144.png',
    './icons/icon-192x192.png',
    './icons/icon-512x512.png'
];

// ─── CDN libraries — cached on first request, kept for offline ───
const CDN_HOSTS = [
    'cdn.jsdelivr.net',
    'cdnjs.cloudflare.com'
];

// ─── Hosts we never intercept (they manage their own offline) ───
const SKIP_HOSTS = [
    'firestore.googleapis.com',
    'firebaseio.com',
    'identitytoolkit.googleapis.com',
    'securetoken.googleapis.com',
    'www.googleapis.com',
    'google-analytics.com',
    'googletagmanager.com'
];

// ═══════════════════════════════════════════════════════════════
// INSTALL — precache app shell
// ═══════════════════════════════════════════════════════════════
self.addEventListener('install', (event) => {
    console.log('[sw] Installing', VERSION);
    event.waitUntil(
        caches.open(STATIC_CACHE).then((cache) => {
            // addAll fails hard if any URL 404s — use individual puts so one
            // missing file doesn't break the whole install
            return Promise.all(
                PRECACHE_URLS.map((url) =>
                    cache.add(url).catch((err) => {
                        console.warn('[sw] Precache skipped:', url, err.message || '');
                    })
                )
            );
        })
    );
    self.skipWaiting();
});

// ═══════════════════════════════════════════════════════════════
// ACTIVATE — clean old caches
// ═══════════════════════════════════════════════════════════════
self.addEventListener('activate', (event) => {
    console.log('[sw] Activating', VERSION);
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(
                keys
                    .filter((k) => k !== STATIC_CACHE && k !== RUNTIME_CACHE)
                    .map((k) => {
                        console.log('[sw] Deleting old cache:', k);
                        return caches.delete(k);
                    })
            )
        ).then(() => self.clients.claim())
    );
});

// ═══════════════════════════════════════════════════════════════
// FETCH — routing strategies
// ═══════════════════════════════════════════════════════════════
self.addEventListener('fetch', (event) => {
    const request = event.request;

    // Only GET
    if (request.method !== 'GET') return;

    let url;
    try { url = new URL(request.url); } catch { return; }

    // Skip Firebase / analytics
    if (SKIP_HOSTS.some((host) => url.hostname.includes(host))) return;

    // Skip chrome-extension and other non-http
    if (!url.protocol.startsWith('http')) return;

    // ─── HTML navigations — network first, offline fallback ───
    if (request.mode === 'navigate') {
        event.respondWith(handleNavigate(request));
        return;
    }

    // ─── CDN libraries — cache first ───
    if (CDN_HOSTS.some((host) => url.hostname.includes(host))) {
        event.respondWith(handleCacheFirst(request, RUNTIME_CACHE));
        return;
    }

    // ─── Cross-origin (not CDN, not Firebase) — pass through ───
    if (url.origin !== self.location.origin) {
        event.respondWith(handleCacheFirst(request, RUNTIME_CACHE));
        return;
    }

    // ─── Same-origin assets — stale-while-revalidate ───
    event.respondWith(handleStaleWhileRevalidate(request));
});

// ─── Strategies ───

async function handleNavigate(request) {
    try {
        const response = await fetch(request);
        // Cache successful HTML responses for offline
        if (response.ok) {
            const cache = await caches.open(RUNTIME_CACHE);
            cache.put(request, response.clone());
        }
        return response;
    } catch (err) {
        // Offline — try runtime cache
        const cached = await caches.match(request);
        if (cached) return cached;
        // Try static cache
        const staticCached = await caches.match(request, { cacheName: STATIC_CACHE });
        if (staticCached) return staticCached;
        // Last resort — offline page
        const offline = await caches.match('./offline.html', { cacheName: STATIC_CACHE });
        if (offline) return offline;
        return new Response(
            '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Offline</title></head>' +
            '<body style="font-family:system-ui; padding:3rem; text-align:center; color:#64748b;">' +
            '<h1 style="color:#dc2626;">Offline</h1>' +
            '<p>This page is not available offline. Please reconnect.</p>' +
            '</body></html>',
            { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
        );
    }
}

async function handleCacheFirst(request, cacheName) {
    const cached = await caches.match(request);
    if (cached) return cached;
    try {
        const response = await fetch(request);
        if (response && response.ok) {
            const cache = await caches.open(cacheName);
            cache.put(request, response.clone());
        }
        return response;
    } catch (err) {
        return new Response('Offline — resource not cached', {
            status: 503,
            headers: { 'Content-Type': 'text/plain' }
        });
    }
}

async function handleStaleWhileRevalidate(request) {
    const cache = await caches.open(RUNTIME_CACHE);
    const cached = await cache.match(request);

    const networkPromise = fetch(request)
        .then((response) => {
            if (response && response.ok) {
                cache.put(request, response.clone());
            }
            return response;
        })
        .catch(() => null);

    if (cached) {
        // Return cached immediately, refresh in background
        networkPromise.catch(() => {});
        return cached;
    }

    const response = await networkPromise;
    if (response) return response;

    // Nothing cached, no network
    return new Response('Offline — resource not cached', {
        status: 503,
        headers: { 'Content-Type': 'text/plain' }
    });
}

// ═══════════════════════════════════════════════════════════════
// BACKGROUND SYNC — notify clients when sync triggers
// ═══════════════════════════════════════════════════════════════
self.addEventListener('sync', (event) => {
    console.log('[sw] Sync event:', event.tag);
    if (event.tag === 'mms-sync' || event.tag === 'mms-data-sync') {
        event.waitUntil(notifyClientsOfSync());
    }
});

async function notifyClientsOfSync() {
    const clients = await self.clients.matchAll({ type: 'window' });
    clients.forEach((client) => {
        client.postMessage({ type: 'SYNC_TRIGGERED', timestamp: Date.now() });
    });
}

// ═══════════════════════════════════════════════════════════════
// MESSAGE — commands from the app
// ═══════════════════════════════════════════════════════════════
self.addEventListener('message', (event) => {
    const data = event.data || {};

    if (data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }

    if (data.type === 'CLEAR_CACHES') {
        event.waitUntil(
            caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
        );
    }

    if (data.type === 'VERSION') {
        // Respond with current version
        if (event.ports && event.ports[0]) {
            event.ports[0].postMessage({ version: VERSION });
        }
    }
});

console.log('[sw] Loaded', VERSION);