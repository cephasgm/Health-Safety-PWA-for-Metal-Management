// Service Worker for MMS Safety PWA
const CACHE_NAME = 'mms-safety-v2.0';
const OFFLINE_URL = 'offline.html';

// Assets to cache on install
const STATIC_ASSETS = [
    './',
    './index.html',
    './manifest.json',
    './pwa-init.js',
    // External libraries (cache these for offline use)
    'https://cdn.jsdelivr.net/npm/chart.js',
    'https://cdn.jsdelivr.net/npm/chartjs-adapter-date-fns',
    'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'
];

// Install event - cache static assets
self.addEventListener('install', event => {
    console.log('[Service Worker] Installing...');
    
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('[Service Worker] Caching static assets');
                return cache.addAll(STATIC_ASSETS)
                    .then(() => {
                        console.log('[Service Worker] All assets cached');
                        return self.skipWaiting();
                    })
                    .catch(error => {
                        console.error('[Service Worker] Cache addAll failed:', error);
                        // Cache what we can, continue with installation
                        return self.skipWaiting();
                    });
            })
            .then(() => {
                console.log('[Service Worker] Installation complete');
            })
    );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
    console.log('[Service Worker] Activating...');
    
    event.waitUntil(
        caches.keys().then(cacheNames => {
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
            console.log('[Service Worker] Claiming clients');
            return self.clients.claim();
        })
        .then(() => {
            // Notify all clients about the update
            self.clients.matchAll().then(clients => {
                clients.forEach(client => {
                    client.postMessage({
                        action: 'UPDATE_AVAILABLE',
                        version: CACHE_NAME
                    });
                });
            });
        })
    );
});

// Fetch event - network first, then cache
self.addEventListener('fetch', event => {
    // Skip non-GET requests
    if (event.request.method !== 'GET') return;
    
    // Skip Chrome extensions
    if (event.request.url.startsWith('chrome-extension://')) return;
    
    // For API/data requests, always go to network
    if (event.request.url.includes('/api/') || 
        event.request.url.includes('jsonplaceholder.typicode.com')) {
        event.respondWith(
            fetch(event.request)
                .catch(() => {
                    // Return offline data or empty response for APIs
                    return new Response(JSON.stringify({ offline: true, message: 'You are offline' }), {
                        headers: { 'Content-Type': 'application/json' }
                    });
                })
        );
        return;
    }
    
    // For HTML pages - try network first, then cache, then offline page
    if (event.request.headers.get('accept').includes('text/html')) {
        event.respondWith(
            fetch(event.request)
                .then(response => {
                    // Cache the fresh response
                    const responseClone = response.clone();
                    caches.open(CACHE_NAME).then(cache => {
                        cache.put(event.request, responseClone);
                    });
                    return response;
                })
                .catch(() => {
                    return caches.match(event.request)
                        .then(cachedResponse => {
                            if (cachedResponse) {
                                return cachedResponse;
                            }
                            // Return offline page
                            return caches.match(OFFLINE_URL);
                        });
                })
        );
        return;
    }
    
    // For static assets - cache first, then network
    event.respondWith(
        caches.match(event.request)
            .then(cachedResponse => {
                if (cachedResponse) {
                    // Update cache in background
                    fetch(event.request)
                        .then(response => {
                            const responseClone = response.clone();
                            caches.open(CACHE_NAME).then(cache => {
                                cache.put(event.request, responseClone);
                            });
                        })
                        .catch(() => {
                            // Network failed, we already have cached version
                        });
                    return cachedResponse;
                }
                
                // Not in cache, go to network
                return fetch(event.request)
                    .then(response => {
                        // Don't cache if not a successful response
                        if (!response || response.status !== 200 || response.type !== 'basic') {
                            return response;
                        }
                        
                        // Cache the response
                        const responseToCache = response.clone();
                        caches.open(CACHE_NAME)
                            .then(cache => {
                                cache.put(event.request, responseToCache);
                            });
                        
                        return response;
                    })
                    .catch(error => {
                        console.error('[Service Worker] Fetch failed:', error);
                        // Return appropriate fallback based on request type
                        if (event.request.destination === 'image') {
                            return new Response(
                                '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"><rect width="200" height="200" fill="#f0f0f0"/><text x="100" y="100" text-anchor="middle" fill="#666" font-family="sans-serif" font-size="14">MMS</text></svg>',
                                { headers: { 'Content-Type': 'image/svg+xml' } }
                            );
                        }
                        return new Response('Offline', { status: 408, statusText: 'Network Error' });
                    });
            })
    );
});

// Handle messages from the client
self.addEventListener('message', event => {
    if (event.data && event.data.action === 'SKIP_WAITING') {
        console.log('[Service Worker] Skipping waiting phase');
        self.skipWaiting();
    }
    
    if (event.data && event.data.action === 'CLEAR_CACHE') {
        caches.delete(CACHE_NAME).then(() => {
            event.ports[0].postMessage({ success: true });
        });
    }
});

// Background sync for offline data
self.addEventListener('sync', event => {
    if (event.tag === 'sync-incidents') {
        console.log('[Service Worker] Background sync for incidents');
        event.waitUntil(syncIncidents());
    }
});

async function syncIncidents() {
    try {
        // Get stored offline incidents
        const db = await openDatabase();
        const offlineIncidents = await getAllFromStore(db, 'offlineIncidents');
        
        for (const incident of offlineIncidents) {
            // Try to sync each incident
            await fetch('/api/incidents', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(incident)
            });
            
            // Remove from offline storage if successful
            await deleteFromStore(db, 'offlineIncidents', incident.id);
        }
        
        console.log('[Service Worker] Background sync completed');
    } catch (error) {
        console.error('[Service Worker] Background sync failed:', error);
    }
}

// IndexedDB helper functions
function openDatabase() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('mms-safety-offline', 1);
        
        request.onupgradeneeded = function(event) {
            const db = event.target.result;
            if (!db.objectStoreNames.contains('offlineIncidents')) {
                db.createObjectStore('offlineIncidents', { keyPath: 'id' });
            }
        };
        
        request.onsuccess = function(event) {
            resolve(event.target.result);
        };
        
        request.onerror = function(event) {
            reject(event.target.error);
        };
    });
}

function getAllFromStore(db, storeName) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, 'readonly');
        const store = transaction.objectStore(storeName);
        const request = store.getAll();
        
        request.onsuccess = function(event) {
            resolve(event.target.result);
        };
        
        request.onerror = function(event) {
            reject(event.target.error);
        };
    });
}

function deleteFromStore(db, storeName, key) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.delete(key);
        
        request.onsuccess = function(event) {
            resolve();
        };
        
        request.onerror = function(event) {
            reject(event.target.error);
        };
    });
}

// Periodic sync (if supported)
if ('periodicSync' in self.registration) {
    self.addEventListener('periodicsync', event => {
        if (event.tag === 'update-cache') {
            event.waitUntil(updateCache());
        }
    });
}

async function updateCache() {
    console.log('[Service Worker] Periodic cache update');
    // Update cache with fresh content
    const cache = await caches.open(CACHE_NAME);
    const requests = await cache.keys();
    
    for (const request of requests) {
        try {
            const response = await fetch(request);
            if (response.ok) {
                await cache.put(request, response);
            }
        } catch (error) {
            console.log('[Service Worker] Failed to update:', request.url);
        }
    }
}
