// Service Worker for MMS Safety Dashboard
const CACHE_NAME = 'mms-safety-v4.0';
const OFFLINE_URL = './offline.html';

// Assets to cache on install
const STATIC_ASSETS = [
  './',
  './index.html',
  './offline.html',
  './manifest.json',
  './pwa-init.js',
  './icon-72x72.png',
  './icon-96x96.png',
  './icon-128x128.png',
  './icon-152x152.png',
  './icon-192x192.png',
  './icon-512x512.png'
];

// Install event
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// Activate event
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then(cacheNames => Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      ))
      .then(() => self.clients.claim())
  );
});

// Fetch event - SIMPLIFIED
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  // Skip chrome-extension requests silently
  if (url.protocol === 'chrome-extension:') return;
  
  // Skip non-GET requests
  if (event.request.method !== 'GET') return;

  // Handle navigation requests
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .catch(() => caches.match('./index.html'))
        .catch(() => caches.match(OFFLINE_URL))
    );
    return;
  }

  // Cache-first strategy for everything else
  event.respondWith(
    caches.match(event.request)
      .then(cached => {
        if (cached) return cached;
        
        return fetch(event.request)
          .then(networkResponse => {
            // Don't cache non-successful responses
            if (!networkResponse || networkResponse.status !== 200) {
              return networkResponse;
            }
            
            // Cache successful responses
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME)
              .then(cache => cache.put(event.request, responseToCache));
            
            return networkResponse;
          })
          .catch(error => {
            console.log('Fetch failed:', error);
            // Return nothing for failed requests
            return new Response('', { status: 408 });
          });
      })
  );
});

// Background sync (optional - kept for future use)
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-incidents') {
    console.log('Background sync triggered');
  }
});

// Push notifications (optional - kept for future use)
self.addEventListener('push', (event) => {
  if (!event.data) return;
  
  const options = {
    body: 'New safety notification',
    icon: './icon-192x192.png',
    badge: './icon-72x72.png'
  };
  
  event.waitUntil(
    self.registration.showNotification('MMS Safety', options)
  );
});
