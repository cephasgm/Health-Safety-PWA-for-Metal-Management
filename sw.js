// sw.js - Service Worker for MMS Safety Dashboard
const CACHE_NAME = 'mms-safety-v2.0.0';
const STATIC_CACHE_NAME = 'mms-safety-static-v2.0.0';

// Assets to cache
const STATIC_ASSETS = [
    '/Health-Safety-PWA-for-Metal-Management/',
    '/Health-Safety-PWA-for-Metal-Management/index.html',
    '/Health-Safety-PWA-for-Metal-Management/manifest.json',
    '/Health-Safety-PWA-for-Metal-Management/pwa-init.js'
];

// Dynamic assets to cache (API responses, etc.)
const DYNAMIC_ASSETS = [
    // Add API endpoints if needed
];

// Install event - cache static assets
self.addEventListener('install', event => {
    console.log('Service Worker installing...');
    
    event.waitUntil(
        caches.open(STATIC_CACHE_NAME)
            .then(cache => {
                console.log('Caching static assets');
                return cache.addAll(STATIC_ASSETS);
            })
            .then(() => {
                console.log('Service Worker installed');
                return self.skipWaiting();
            })
            .catch(error => {
                console.error('Cache installation failed:', error);
            })
    );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
    console.log('Service Worker activating...');
    
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== CACHE_NAME && cacheName !== STATIC_CACHE_NAME) {
                        console.log('Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => {
            console.log('Service Worker activated');
            return self.clients.claim();
        })
    );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', event => {
    // Skip non-GET requests
    if (event.request.method !== 'GET') return;
    
    // Skip cross-origin requests
    if (!event.request.url.startsWith(self.location.origin)) return;
    
    // Handle navigation requests
    if (event.request.mode === 'navigate') {
        event.respondWith(
            caches.match('/Health-Safety-PWA-for-Metal-Management/index.html')
                .then(response => response || fetch(event.request))
                .catch(() => caches.match('/Health-Safety-PWA-for-Metal-Management/index.html'))
        );
        return;
    }
    
    // For other requests, try cache first, then network
    event.respondWith(
        caches.match(event.request)
            .then(response => {
                if (response) {
                    return response;
                }
                
                // Clone the request because it can only be used once
                const fetchRequest = event.request.clone();
                
                return fetch(fetchRequest)
                    .then(response => {
                        // Check if we received a valid response
                        if (!response || response.status !== 200 || response.type !== 'basic') {
                            return response;
                        }
                        
                        // Clone the response because it can only be used once
                        const responseToCache = response.clone();
                        
                        // Cache the response
                        caches.open(CACHE_NAME)
                            .then(cache => {
                                cache.put(event.request, responseToCache);
                            });
                        
                        return response;
                    })
                    .catch(error => {
                        console.error('Fetch failed:', error);
                        // Return offline page or fallback
                        if (event.request.headers.get('accept').includes('text/html')) {
                            return caches.match('/Health-Safety-PWA-for-Metal-Management/index.html');
                        }
                    });
            })
    );
});

// Message event - handle messages from client
self.addEventListener('message', event => {
    if (event.data && event.data.action === 'SKIP_WAITING') {
        self.skipWaiting();
        
        // Notify clients about update
        self.clients.matchAll().then(clients => {
            clients.forEach(client => {
                client.postMessage({ action: 'UPDATE_AVAILABLE' });
            });
        });
    }
});

// Background sync (if needed)
self.addEventListener('sync', event => {
    if (event.tag === 'sync-data') {
        console.log('Background sync triggered');
        // Handle background sync here
    }
});

// Push notifications (if needed)
self.addEventListener('push', event => {
    if (!event.data) return;
    
    const data = event.data.json();
    const title = data.title || 'MMS Safety Update';
    const options = {
        body: data.body || 'New safety alert',
        icon: '/Health-Safety-PWA-for-Metal-Management/icon-192.png',
        badge: '/Health-Safety-PWA-for-Metal-Management/icon-192.png',
        tag: data.tag || 'mms-safety',
        data: data.url || '/Health-Safety-PWA-for-Metal-Management/'
    };
    
    event.waitUntil(
        self.registration.showNotification(title, options)
    );
});

// Notification click handler
self.addEventListener('notificationclick', event => {
    event.notification.close();
    
    event.waitUntil(
        clients.matchAll({ type: 'window' })
            .then(clientList => {
                for (const client of clientList) {
                    if (client.url === event.notification.data && 'focus' in client) {
                        return client.focus();
                    }
                }
                if (clients.openWindow) {
                    return clients.openWindow(event.notification.data);
                }
            })
    );
});
