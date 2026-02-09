// Service Worker for MMS Safety Dashboard
const CACHE_NAME = 'mms-safety-v3.1';
const OFFLINE_URL = './offline.html';

// Assets to cache on install (only local files)
const STATIC_ASSETS = [
  './',
  './index.html',
  './offline.html',
  './manifest.json',
  './pwa-init.js',
  // Don't cache external URLs during install
];

// External assets we want to cache (but handle differently)
const EXTERNAL_ASSETS = [
  'https://cdn.jsdelivr.net/npm/chart.js',
  'https://cdn.jsdelivr.net/npm/chartjs-adapter-date-fns',
  'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js'
];

// Install event
self.addEventListener('install', (event) => {
  console.log('[Service Worker] Installing...');
  
  event.waitUntil(
    (async () => {
      try {
        const cache = await caches.open(CACHE_NAME);
        console.log('[Service Worker] Caching app shell');
        
        // Only cache local files during install
        await cache.addAll(STATIC_ASSETS);
        console.log('[Service Worker] Install completed');
        
        // Skip waiting to activate immediately
        return self.skipWaiting();
      } catch (error) {
        console.error('[Service Worker] Cache installation failed:', error);
        // Don't fail installation if some assets can't be cached
        return self.skipWaiting();
      }
    })()
  );
});

// Activate event
self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activating...');
  
  event.waitUntil(
    (async () => {
      try {
        // Clean up old caches
        const cacheNames = await caches.keys();
        await Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME) {
              console.log('[Service Worker] Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
        
        console.log('[Service Worker] Now ready to handle fetches');
        return self.clients.claim();
      } catch (error) {
        console.error('[Service Worker] Activation failed:', error);
      }
    })()
  );
});

// Fetch event - Improved with better error handling
self.addEventListener('fetch', (event) => {
  // Skip non-GET requests and Chrome extensions
  if (event.request.method !== 'GET' || 
      event.request.url.startsWith('chrome-extension://')) {
    return;
  }

  // Handle navigation requests
  if (event.request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          // Try network first for navigation
          const networkResponse = await fetch(event.request);
          return networkResponse;
        } catch (error) {
          console.log('[Service Worker] Navigation fetch failed, serving from cache');
          
          // Try to serve from cache
          const cachedResponse = await caches.match('./index.html');
          if (cachedResponse) {
            return cachedResponse;
          }
          
          // Fallback to offline page
          return caches.match(OFFLINE_URL);
        }
      })()
    );
    return;
  }

  // For CSS, JS, and images - Cache First, then Network
  if (event.request.destination === 'style' || 
      event.request.destination === 'script' ||
      event.request.destination === 'image' ||
      event.request.url.includes('.css') ||
      event.request.url.includes('.js') ||
      event.request.url.includes('.png') ||
      event.request.url.includes('.jpg')) {
    
    event.respondWith(
      (async () => {
        // First, try to get from cache
        const cachedResponse = await caches.match(event.request);
        if (cachedResponse) {
          return cachedResponse;
        }

        try {
          // If not in cache, fetch from network
          const networkResponse = await fetch(event.request);
          
          // Check if we received a valid response
          if (networkResponse && networkResponse.status === 200) {
            // Clone the response to cache it
            const responseToCache = networkResponse.clone();
            
            // Open cache and store the response
            const cache = await caches.open(CACHE_NAME);
            await cache.put(event.request, responseToCache);
          }
          
          return networkResponse;
        } catch (error) {
          console.log(`[Service Worker] Fetch failed for ${event.request.url}:`, error);
          
          // For images, return a placeholder or nothing
          if (event.request.destination === 'image') {
            return new Response(
              '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="200" viewBox="0 0 400 200"><rect width="400" height="200" fill="#f0f0f0"/><text x="200" y="100" font-family="Arial" font-size="16" text-anchor="middle" fill="#666">Image not available offline</text></svg>',
              { headers: { 'Content-Type': 'image/svg+xml' } }
            );
          }
          
          // For other resources, return an empty response or error
          return new Response('Resource not available offline', {
            status: 404,
            statusText: 'Not Found',
            headers: { 'Content-Type': 'text/plain' }
          });
        }
      })()
    );
    return;
  }

  // For API requests - Network First, then Cache
  if (event.request.url.includes('/api/')) {
    event.respondWith(
      (async () => {
        try {
          return await fetch(event.request);
        } catch (error) {
          console.log('[Service Worker] API request failed, returning offline message');
          return new Response(
            JSON.stringify({ 
              error: 'You are offline. Data will sync when connection is restored.',
              timestamp: new Date().toISOString()
            }), 
            { 
              headers: { 
                'Content-Type': 'application/json',
                'X-Offline': 'true'
              } 
            }
          );
        }
      })()
    );
    return;
  }

  // Default strategy for other requests
  event.respondWith(
    (async () => {
      const cachedResponse = await caches.match(event.request);
      
      if (cachedResponse) {
        return cachedResponse;
      }

      try {
        const networkResponse = await fetch(event.request);
        
        // Don't cache responses with errors
        if (networkResponse && networkResponse.status === 200) {
          const cache = await caches.open(CACHE_NAME);
          await cache.put(event.request, networkResponse.clone());
        }
        
        return networkResponse;
      } catch (error) {
        console.log(`[Service Worker] Failed to fetch ${event.request.url}:`, error);
        return new Response('Network error', { status: 408 });
      }
    })()
  );
});

// Background sync event
self.addEventListener('sync', (event) => {
  console.log('[Service Worker] Background sync:', event.tag);
  
  if (event.tag === 'sync-incidents') {
    event.waitUntil(
      (async () => {
        // You can add background sync logic here
        // For example, sync pending incident reports
        console.log('[Service Worker] Syncing pending incidents...');
      })()
    );
  }
});

// Push notification event
self.addEventListener('push', (event) => {
  console.log('[Service Worker] Push notification received');
  
  if (!event.data) {
    console.log('[Service Worker] Push event has no data');
    return;
  }

  let data;
  try {
    data = event.data.json();
  } catch (error) {
    console.log('[Service Worker] Push data is not JSON, using text');
    data = { 
      title: 'MMS Safety Alert', 
      body: event.data.text() || 'New safety notification' 
    };
  }

  const options = {
    body: data.body || 'New safety alert from MMS',
    icon: './icon-192.png',
    badge: './icon-72x72.png',
    vibrate: [100, 50, 100],
    data: {
      url: data.url || './',
      timestamp: Date.now()
    },
    actions: [
      {
        action: 'view',
        title: 'View Alert'
      },
      {
        action: 'close',
        title: 'Dismiss'
      }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'MMS Safety Alert', options)
  );
});

// Notification click event
self.addEventListener('notificationclick', (event) => {
  console.log('[Service Worker] Notification click:', event.action);
  
  event.notification.close();

  if (event.action === 'close') {
    return;
  }

  event.waitUntil(
    (async () => {
      const clients = await self.clients.matchAll({ 
        type: 'window', 
        includeUncontrolled: true 
      });
      
      // If a window is already open, focus it
      for (const client of clients) {
        if (client.url.includes('./') && 'focus' in client) {
          return client.focus();
        }
      }
      
      // Otherwise, open a new window
      if (self.clients.openWindow) {
        return self.clients.openWindow(event.notification.data?.url || './');
      }
    })()
  );
});

// Message event - handle messages from client
self.addEventListener('message', (event) => {
  console.log('[Service Worker] Message received:', event.data);
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Handle service worker errors
self.addEventListener('error', (event) => {
  console.error('[Service Worker] Error:', event.error);
});

self.addEventListener('unhandledrejection', (event) => {
  console.error('[Service Worker] Unhandled rejection:', event.reason);
});
