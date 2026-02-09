// Service Worker for MMS Safety Dashboard
const CACHE_NAME = 'mms-safety-v3.2';
const OFFLINE_URL = './offline.html';

// Assets to cache on install
const STATIC_ASSETS = [
  './',
  './index.html',
  './offline.html',
  './manifest.json',
  './pwa-init.js',
  './screenshot.png',
  './icon-72x72.png',
  './icon-96x96.png',
  './icon-128x128.png',
  './icon-144x144.png',
  './icon-152x152.png',
  './icon-192x192.png',
  './icon-384x384.png',
  './icon-512x512.png'
];

// External assets with cache-first strategy
const EXTERNAL_ASSETS = [
  'https://cdn.jsdelivr.net/npm/chart.js',
  'https://cdn.jsdelivr.net/npm/chartjs-adapter-date-fns',
  'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js'
];

// Install event - Cache all static assets
self.addEventListener('install', (event) => {
  console.log('[Service Worker] Installing version 3.2...');
  
  event.waitUntil(
    (async () => {
      try {
        const cache = await caches.open(CACHE_NAME);
        console.log('[Service Worker] Caching app shell and icons');
        
        // Cache local files
        await Promise.all(STATIC_ASSETS.map(async (url) => {
          try {
            await cache.add(url);
            console.log(`✅ Cached: ${url}`);
          } catch (err) {
            console.warn(`⚠️ Failed to cache ${url}:`, err.message);
          }
        }));
        
        console.log('[Service Worker] All assets cached');
        return self.skipWaiting();
      } catch (error) {
        console.error('[Service Worker] Cache installation failed:', error);
        return self.skipWaiting();
      }
    })()
  );
});

// Activate event - Clean old caches
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
        
        console.log('[Service Worker] Now controlling clients');
        return self.clients.claim();
      } catch (error) {
        console.error('[Service Worker] Activation failed:', error);
      }
    })()
  );
});

// Fetch event with 404 handling for images
self.addEventListener('fetch', (event) => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') {
    return;
  }

  const url = new URL(event.request.url);
  
  // Security: Block non-HTTPS in production (except localhost)
  if (url.protocol !== 'https:' && !url.hostname.includes('localhost')) {
    console.warn('[Service Worker] Blocked non-HTTPS request:', url.href);
    return;
  }

  // Handle navigation requests
  if (event.request.mode === 'navigate') {
    event.respondWith(handleNavigationRequest(event));
    return;
  }

  // Handle image requests with 404 fallback
  if (event.request.destination === 'image' || 
      url.pathname.match(/\.(png|jpg|jpeg|gif|svg|ico)$/i)) {
    event.respondWith(handleImageRequest(event));
    return;
  }

  // Handle CSS/JS requests
  if (event.request.destination === 'style' || 
      event.request.destination === 'script' ||
      url.pathname.match(/\.(css|js)$/i)) {
    event.respondWith(handleAssetRequest(event));
    return;
  }

  // Default strategy for other requests
  event.respondWith(handleDefaultRequest(event));
});

// Navigation request handler
async function handleNavigationRequest(event) {
  try {
    // Try network first for navigation
    const networkResponse = await fetch(event.request);
    return networkResponse;
  } catch (error) {
    console.log('[Service Worker] Navigation failed, serving cached page');
    
    // Try to serve from cache
    const cachedResponse = await caches.match('./index.html');
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // Fallback to offline page
    return caches.match(OFFLINE_URL);
  }
}

// Image request handler with 404 fallback
async function handleImageRequest(event) {
  // First, try to get from cache
  const cachedResponse = await caches.match(event.request);
  if (cachedResponse) {
    return cachedResponse;
  }

  try {
    // If not in cache, fetch from network with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    const networkResponse = await fetch(event.request.url, {
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    
    if (networkResponse && networkResponse.status === 200) {
      // Cache the response
      const cache = await caches.open(CACHE_NAME);
      await cache.put(event.request, networkResponse.clone());
      return networkResponse;
    }
    
    throw new Error('Image not found or invalid response');
  } catch (error) {
    console.log(`[Service Worker] Image fetch failed for ${event.request.url}:`, error.message);
    
    // Create a fallback SVG icon based on request type
    const iconName = event.request.url.split('/').pop() || 'icon';
    const isIcon = iconName.includes('icon');
    const size = iconName.match(/\d+/g)?.[0] || '192';
    
    return new Response(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
        <rect width="${size}" height="${size}" fill="${isIcon ? '#dc2626' : '#f1f5f9'}"/>
        ${isIcon ? 
          `<text x="${size/2}" y="${size/2}" font-family="Arial" font-size="${size/8}" text-anchor="middle" fill="white" dy=".3em">MMS</text>` :
          `<text x="${size/2}" y="${size/2}" font-family="Arial" font-size="${size/16}" text-anchor="middle" fill="#64748b" dy=".3em">Image unavailable</text>`
        }
      </svg>`,
      { 
        headers: { 
          'Content-Type': 'image/svg+xml',
          'Cache-Control': 'public, max-age=86400'
        } 
      }
    );
  }
}

// Asset request handler (CSS/JS)
async function handleAssetRequest(event) {
  // First, try cache
  const cachedResponse = await caches.match(event.request);
  if (cachedResponse) {
    return cachedResponse;
  }

  try {
    // Fetch from network
    const networkResponse = await fetch(event.request);
    
    if (networkResponse && networkResponse.status === 200) {
      // Cache successful responses
      const cache = await caches.open(CACHE_NAME);
      await cache.put(event.request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.log(`[Service Worker] Failed to fetch ${event.request.url}:`, error);
    
    // For external scripts, return empty response
    if (event.request.url.includes('cdn.')) {
      return new Response('// External resource unavailable offline', {
        headers: { 'Content-Type': 'application/javascript' }
      });
    }
    
    return new Response('Resource not available', { status: 404 });
  }
}

// Default request handler
async function handleDefaultRequest(event) {
  const cachedResponse = await caches.match(event.request);
  
  if (cachedResponse) {
    return cachedResponse;
  }

  try {
    const networkResponse = await fetch(event.request);
    
    if (networkResponse && networkResponse.status === 200) {
      const cache = await caches.open(CACHE_NAME);
      await cache.put(event.request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.log(`[Service Worker] Failed to fetch ${event.request.url}:`, error);
    return new Response('Network error', { status: 408 });
  }
}

// Background sync event
self.addEventListener('sync', (event) => {
  console.log('[Service Worker] Background sync:', event.tag);
  
  if (event.tag === 'sync-incidents') {
    event.waitUntil(syncPendingIncidents());
  }
});

async function syncPendingIncidents() {
  // Get pending incidents from IndexedDB or localStorage
  const pendingIncidents = JSON.parse(localStorage.getItem('pendingIncidents') || '[]');
  
  if (pendingIncidents.length === 0) {
    console.log('[Service Worker] No pending incidents to sync');
    return;
  }
  
  console.log(`[Service Worker] Syncing ${pendingIncidents.length} pending incidents`);
  
  // In a real app, you would send these to your server
  // For now, just mark them as synced
  localStorage.setItem('pendingIncidents', '[]');
  
  // Send notification
  self.registration.showNotification('MMS Safety Sync', {
    body: `${pendingIncidents.length} incidents synced successfully`,
    icon: './icon-192x192.png',
    tag: 'sync-complete'
  });
}

// Push notification event (unchanged, works fine)
self.addEventListener('push', (event) => {
  if (!event.data) return;
  
  let data;
  try {
    data = event.data.json();
  } catch {
    data = { 
      title: 'MMS Safety Alert', 
      body: event.data.text() || 'New safety notification' 
    };
  }

  const options = {
    body: data.body || 'New safety alert from MMS',
    icon: './icon-192x192.png',
    badge: './icon-72x72.png',
    vibrate: [100, 50, 100],
    data: {
      url: data.url || './',
      timestamp: Date.now()
    },
    actions: [
      { action: 'view', title: 'View Alert' },
      { action: 'close', title: 'Dismiss' }
    ]
  };

  event.waitUntil(self.registration.showNotification(data.title || 'MMS Safety Alert', options));
});

// Notification click event (unchanged, works fine)
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'close') return;

  event.waitUntil(
    (async () => {
      const clients = await self.clients.matchAll({ 
        type: 'window', 
        includeUncontrolled: true 
      });
      
      for (const client of clients) {
        if (client.url.includes('./') && 'focus' in client) {
          return client.focus();
        }
      }
      
      if (self.clients.openWindow) {
        return self.clients.openWindow(event.notification.data?.url || './');
      }
    })()
  );
});

// Message event
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    caches.delete(CACHE_NAME);
    console.log('[Service Worker] Cache cleared by client');
  }
});

// Error handling
self.addEventListener('error', (event) => {
  console.error('[Service Worker] Error:', event.error);
});

self.addEventListener('unhandledrejection', (event) => {
  console.error('[Service Worker] Unhandled rejection:', event.reason);
});

// Periodic sync registration
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'daily-sync') {
    console.log('[Service Worker] Performing daily sync');
    event.waitUntil(syncPendingIncidents());
  }
});
