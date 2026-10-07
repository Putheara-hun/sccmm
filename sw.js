// Real-time Service Worker (Never caches HTML, always gets latest deployed version)
const VERSION = "realtime-v4-" + Date.now();

self.addEventListener("install", (e) => {
  // Activate immediately without waiting for existing tabs to close
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    // Delete ALL old caches so stale versions can never be served
    caches.keys().then((keys) => {
      return Promise.all(keys.map((k) => caches.delete(k)));
    }).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  // 1. Never intercept Firebase real-time database or external APIs
  const url = e.request.url;
  if (
    url.includes("firebaseio.com") ||
    url.includes("googleapis.com") ||
    url.includes("ipapi.co") ||
    url.includes("ip-api.com") ||
    url.includes("freeipapi.com") ||
    url.includes("nominatim.openstreetmap.org")
  ) {
    return;
  }

  // 2. Navigation / HTML requests: ALWAYS fetch directly from network with no-store
  // This guarantees that any new deploy is immediately visible without clearing browser cache
  if (e.request.mode === "navigate" || url.endsWith(".html") || url.endsWith("/")) {
    e.respondWith(
      fetch(e.request, { cache: "no-store" }).catch(() => {
        // If completely offline and network fails, attempt fallback
        return caches.match(e.request);
      })
    );
    return;
  }

  // 3. Static CDN libraries (Leaflet, Firebase JS) can use network with cache fallback
  e.respondWith(
    fetch(e.request).catch(() => caches.match(e.request))
  );
});

// Inform clients if a new service worker version took over
self.addEventListener("message", (e) => {
  if (e.data === "SKIP_WAITING") {
    self.skipWaiting();
  }
});
