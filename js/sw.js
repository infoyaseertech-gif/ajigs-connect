/* =============================================
   AJIGS CONNECT — sw.js
   Service Worker — Network First Strategy
   All devices always get the latest version
   ============================================= */

'use strict';

const CACHE_NAME    = 'ajigs-v1';
const OFFLINE_URL   = '/index.html';

// Files to pre-cache on install
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/about.html',
  '/services.html',
  '/contact.html',
  '/login.html',
  '/css/style.css',
  '/css/erp.css',
  '/js/main.js',
  '/js/pwa.js',
  '/manifest.json',
  '/assets/icon-192.png',
  '/assets/icon-512.png',
];

// ---- INSTALL: pre-cache shell ----
self.addEventListener('install', event => {
  console.log('[SW] Installing…');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[SW] Pre-caching app shell');
        // Use addAll but ignore failures for missing optional files
        return Promise.allSettled(
          PRECACHE_URLS.map(url => cache.add(url).catch(() => null))
        );
      })
      .then(() => self.skipWaiting())
  );
});

// ---- ACTIVATE: clean up old caches ----
self.addEventListener('activate', event => {
  console.log('[SW] Activating…');
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => {
            console.log('[SW] Deleting old cache:', key);
            return caches.delete(key);
          })
      )
    ).then(() => self.clients.claim())
  );
});

// ---- FETCH: Network First ----
// Always try the network first so users always get fresh data.
// Fall back to cache only if offline.
self.addEventListener('fetch', event => {
  const { request } = event;

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // Skip Supabase API calls — always go to network
  if (request.url.includes('supabase.co') ||
      request.url.includes('supabase.io') ||
      request.url.includes('/rest/v1/') ||
      request.url.includes('/auth/v1/')) {
    return; // Let browser handle directly
  }

  // Skip external CDN requests (fonts, etc.)
  if (request.url.includes('fonts.googleapis.com') ||
      request.url.includes('fonts.gstatic.com')) {
    event.respondWith(
      caches.match(request).then(cached => cached || fetch(request))
    );
    return;
  }

  // Network First for everything else
  event.respondWith(
    fetch(request)
      .then(response => {
        // Only cache successful responses for same-origin requests
        if (response.ok && response.type === 'basic') {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(request, responseClone);
          });
        }
        return response;
      })
      .catch(() => {
        // Network failed — try cache
        return caches.match(request).then(cached => {
          if (cached) return cached;
          // For navigation requests, return offline page
          if (request.destination === 'document') {
            return caches.match(OFFLINE_URL);
          }
          // Return empty response for other assets
          return new Response('', { status: 408, statusText: 'Offline' });
        });
      })
  );
});

// ---- BACKGROUND SYNC (future use) ----
self.addEventListener('sync', event => {
  if (event.tag === 'ajigs-sync') {
    console.log('[SW] Background sync triggered');
    // Future: sync offline actions when back online
  }
});

// ---- PUSH NOTIFICATIONS (future use) ----
self.addEventListener('push', event => {
  if (!event.data) return;
  const data = event.data.json();
  self.registration.showNotification(data.title || 'AJIGS CONNECT', {
    body: data.body || 'You have a new notification',
    icon: '/assets/icon-192.png',
    badge: '/assets/icon-192.png',
  });
});
