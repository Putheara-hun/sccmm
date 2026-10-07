// Real-time Service Worker
const VERSION = "v5";

self.addEventListener("install", (e) => {
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(keys.map((k) => caches.delete(k)));
    })
  );
});

self.addEventListener("fetch", (e) => {
  const url = e.request.url;
  // Let Firebase realtime database and external APIs pass straight to network
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

  // Always fetch HTML navigation directly from network without caching
  if (e.request.mode === "navigate" || url.endsWith(".html") || url.endsWith("/")) {
    e.respondWith(
      fetch(e.request, { cache: "no-store" }).catch(() => caches.match(e.request))
    );
    return;
  }

  // CDN libraries (Leaflet)
  e.respondWith(
    fetch(e.request).catch(() => caches.match(e.request))
  );
});
