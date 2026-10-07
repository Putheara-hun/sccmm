const CACHE_NAME = "us-cache-v3";
const ASSETS = [
  "./",
  "./index.html",
  "./manifest.json",
  "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css",
  "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js",
  "https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js",
  "https://www.gstatic.com/firebasejs/10.12.2/firebase-database-compat.js"
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS).catch(() => {});
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((k) => {
          if (k !== CACHE_NAME) return caches.delete(k);
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener("fetch", (e) => {
  // Let Firebase realtime websocket/database and external APIs pass through to network
  if (
    e.request.url.includes("firebaseio.com") ||
    e.request.url.includes("googleapis.com") ||
    e.request.url.includes("ipapi.co") ||
    e.request.url.includes("ip-api.com") ||
    e.request.url.includes("freeipapi.com") ||
    e.request.url.includes("nominatim.openstreetmap.org")
  ) {
    return;
  }

  // Network-first for HTML pages so user gets immediate updates on refresh / reopening
  if (e.request.mode === "navigate" || e.request.url.endsWith(".html") || e.request.url.endsWith("/")) {
    e.respondWith(
      fetch(e.request)
        .then((networkRes) => {
          const resClone = networkRes.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(e.request, resClone));
          return networkRes;
        })
        .catch(() => caches.match(e.request).then((res) => res || caches.match("./index.html")))
    );
    return;
  }

  // Cache-first for other static assets
  e.respondWith(
    caches.match(e.request).then((res) => {
      return res || fetch(e.request).then((networkRes) => {
        return caches.open(CACHE_NAME).then((cache) => {
          cache.put(e.request, networkRes.clone());
          return networkRes;
        });
      });
    })
  );
});
