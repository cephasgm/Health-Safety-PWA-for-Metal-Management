// Service Worker for MMS Safety PWA
'use strict';

const CACHE_VERSION = 'v1.0.3';
const CACHE_NAME = `mms-safety-cache-${CACHE_VERSION}`;
const OFFLINE_URL = './offline.html';

// Precache these critical assets
const PRECACHE_ASSETS = [
    './',
    './index.html',
    './offline.html',
    './manifest.json',
    './pwa-init.js',
    './icon-72x72.png',
    './icon-96x96.png',
    './icon-128x128.png',
    './icon-144x144.png',
    './icon-152x152.png',
    './icon-192.png',
    './icon-192x192.png',
    './icon-384x384.png',
    './icon-512.png',
    './icon-512x512.png'
];

// Runtime caching strategies
const RUNTIME_CACHE = {
    'chart-js': [
        'https://cdn.jsdelivr.net/npm/chart.js',
        'https://cdn.jsdelivr.net/npm/chartjs-adapter-date-fns'
    ],
    'libs': [
        'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js',
        'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
        'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js'
    ],
    'images': [
        'https://raw.githubusercontent.com/yourusername/Health-Safety-PWA-for-Metal-Management/main/mining-background.jpg'
    ]
};

// ==================== INSTALL EVENT ====================
self.addEventListener('install', event => {
    console.log(`[Service Worker ${CACHE_VERSION}] Installing...`);
    
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('[Service Worker] Caching app shell');
                return Promise.all([
                    cache.addAll(PRECACHE_ASSETS).catch(error => {
                        console.error('[Service Worker] Cache addAll failed:', error);
                        // Cache individual files if batch fails
                        return Promise.all(PRECACHE_ASSETS.map(url => 
                            cache.add(url).catch(e => 
                                console.warn(`[Service Worker] Failed to cache ${url}:`, e)
                            )
                        ));
                    }),
                    // Cache runtime assets
                    ...Object.values(RUNTIME_CACHE).flat().map(url => 
                        cache.add(url).catch(e => 
                            console.warn(`[Service Worker] Failed to cache runtime asset ${url}:`, e)
                        )
                    )
                ]);
            })
            .then(() => {
                console.log('[Service Worker] Installation complete');
                return self.skipWaiting();
            })
            .catch(error => {
                console.error('[Service Worker] Installation failed:', error);
            })
    );
});

// ==================== ACTIVATE EVENT ====================
self.addEventListener('activate', event => {
    console.log(`[Service Worker ${CACHE_VERSION}] Activating...`);
    
    // Clean up old caches
    event.waitUntil(
        caches.keys()
            .then(cacheNames => {
                return Promise.all(
                    cacheNames.map(cacheName => {
                        if (cacheName !== CACHE_NAME) {
                            console.log('[Service Worker] Deleting old cache:', cacheName);
                            return caches.delete(cacheName);
                        }
                    })
                );
            })
            .then(() => {
                console.log('[Service Worker] Activation complete');
                return self.clients.claim();
            })
    );
});

// ==================== FETCH EVENT ====================
self.addEventListener('fetch', event => {
    // Skip non-GET requests
    if (event.request.method !== 'GET') {
        return;
    }
    
    // Skip Chrome extensions
    if (event.request.url.startsWith('chrome-extension://')) {
        return;
    }
    
    // Skip non-http(s) requests
    if (!event.request.url.startsWith('http')) {
        return;
    }
    
    event.respondWith(
        caches.match(event.request)
            .then(cachedResponse => {
                // Return cached response if found
                if (cachedResponse) {
                    console.log('[Service Worker] Serving from cache:', event.request.url);
                    return cachedResponse;
                }
                
                // Otherwise, fetch from network
                return fetch(event.request)
                    .then(response => {
                        // Don't cache invalid responses
                        if (!response || response.status !== 200 || response.type === 'opaque') {
                            return response;
                        }
                        
                        // Clone response for caching
                        const responseToCache = response.clone();
                        
                        // Cache the new response
                        caches.open(CACHE_NAME)
                            .then(cache => {
                                cache.put(event.request, responseToCache);
                                console.log('[Service Worker] Cached new resource:', event.request.url);
                            })
                            .catch(error => {
                                console.error('[Service Worker] Cache put failed:', error);
                            });
                        
                        return response;
                    })
                    .catch(async error => {
                        console.log('[Service Worker] Network request failed:', error);
                        
                        // For navigation requests, return offline page
                        if (event.request.mode === 'navigate') {
                            const offlinePage = await caches.match(OFFLINE_URL);
                            if (offlinePage) {
                                return offlinePage;
                            }
                            
                            // If offline page not in cache, create a simple response
                            return new Response(
                                '<h1>Offline</h1><p>You are offline. Please check your connection.</p>',
                                {
                                    headers: { 'Content-Type': 'text/html' }
                                }
                            );
                        }
                        
                        // For other requests, check if it's an image
                        if (event.request.destination === 'image') {
                            // Return a placeholder image
                            return new Response(
                                '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"><rect width="200" height="200" fill="#f1f5f9"/><text x="100" y="100" text-anchor="middle" dy=".3em" fill="#64748b" font-family="sans-serif">Image</text></svg>',
                                {
                                    headers: { 'Content-Type': 'image/svg+xml' }
                                }
                            );
                        }
                        
                        // Return error for other requests
                        return new Response(
                            'Network error. You appear to be offline.',
                            {
                                status: 503,
                                statusText: 'Service Unavailable',
                                headers: { 'Content-Type': 'text/plain' }
                            }
                        );
                    });
            })
    );
});

// ==================== BACKGROUND SYNC ====================
self.addEventListener('sync', event => {
    console.log('[Service Worker] Background sync:', event.tag);
    
    if (event.tag === 'sync-data') {
        event.waitUntil(syncPendingData());
    }
});

async function syncPendingData() {
    console.log('[Service Worker] Syncing pending data...');
    
    // Get pending data from IndexedDB or localStorage
    try {
        const pendingData = await getPendingData();
        
        if (pendingData && pendingData.length > 0) {
            console.log(`[Service Worker] Found ${pendingData.length} items to sync`);
            
            // In a real app, you would send this to your server
            // For now, just log it and clear pending data
            await clearPendingData();
            console.log('[Service Worker] Sync complete');
            
            // Show notification
            self.registration.showNotification('Data Sync Complete', {
                body: `${pendingData.length} items synchronized`,
                icon: './icon-72x72.png',
                tag: 'sync-complete'
            });
        }
    } catch (error) {
        console.error('[Service Worker] Sync error:', error);
    }
}

// Helper function to get pending data (placeholder)
function getPendingData() {
    return new Promise(resolve => {
        // In a real app, get data from IndexedDB
        resolve([]);
    });
}

// Helper function to clear pending data (placeholder)
function clearPendingData() {
    return new Promise(resolve => {
        // In a real app, clear data from IndexedDB
        resolve();
    });
}

// ==================== PUSH NOTIFICATIONS ====================
self.addEventListener('push', event => {
    console.log('[Service Worker] Push received');
    
    let data = {};
    try {
        data = event.data ? event.data.json() : {};
    } catch (e) {
        data = {
            title: 'MMS Safety Alert',
            body: event.data ? event.data.text() : 'New notification'
        };
    }
    
    const title = data.title || 'MMS Safety';
    const options = {
        body: data.body || 'New safety notification',
        icon: './icon-192.png',
        badge: './icon-72x72.png',
        tag: 'mms-safety',
        data: {
            url: data.url || './index.html',
            timestamp: Date.now()
        },
        actions: data.actions || [
            {
                action: 'view',
                title: 'View'
            },
            {
                action: 'dismiss',
                title: 'Dismiss'
            }
        ]
    };
    
    event.waitUntil(
        self.registration.showNotification(title, options)
    );
});

// ==================== NOTIFICATION CLICK ====================
self.addEventListener('notificationclick', event => {
    console.log('[Service Worker] Notification clicked');
    
    event.notification.close();
    
    const urlToOpen = event.notification.data.url || './index.html';
    
    if (event.action === 'view') {
        // Open the app
        event.waitUntil(
            clients.matchAll({
                type: 'window',
                includeUncontrolled: true
            }).then(clientList => {
                // Check if app is already open
                for (const client of clientList) {
                    if (client.url.includes(urlToOpen) && 'focus' in client) {
                        return client.focus();
                    }
                }
                // Open new window
                if (clients.openWindow) {
                    return clients.openWindow(urlToOpen);
                }
            })
        );
    } else if (event.action === 'dismiss') {
        // Do nothing
    } else {
        // Default action (click on notification body)
        event.waitUntil(
            clients.openWindow(urlToOpen)
        );
    }
});

// ==================== MESSAGE HANDLING ====================
self.addEventListener('message', event => {
    console.log('[Service Worker] Message received:', event.data);
    
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
    
    if (event.data && event.data.type === 'CLEAR_CACHE') {
        caches.delete(CACHE_NAME);
    }
});

// ==================== PERIODIC SYNC (EXPERIMENTAL) ====================
if ('periodicSync' in self.registration) {
    self.addEventListener('periodicsync', event => {
        if (event.tag === 'update-content') {
            console.log('[Service Worker] Periodic sync');
            event.waitUntil(updateContent());
        }
    });
}

async function updateContent() {
    console.log('[Service Worker] Updating content...');
    // Update cached content here
}

// ==================== ERROR HANDLING ====================
self.addEventListener('error', event => {
    console.error('[Service Worker] Error:', event.error);
});

self.addEventListener('unhandledrejection', event => {
    console.error('[Service Worker] Unhandled rejection:', event.reason);
});
