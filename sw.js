// Real-time Service Worker with App Badging & Notification support
const VERSION = "v6";

self.addEventListener("install", (e) => {
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    Promise.all([
      self.clients.claim(),
      caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
    ])
  );
});

// App Badge & System Notification messaging from app
self.addEventListener("message", (event) => {
  if (!event.data) return;

  if (event.data.type === "SET_BADGE") {
    const count = event.data.count || 0;
    if ("setAppBadge" in navigator) {
      if (count > 0) {
        navigator.setAppBadge(count).catch(() => {});
      } else {
        navigator.clearAppBadge().catch(() => {});
      }
    }
  }

  if (event.data.type === "SHOW_NOTIF") {
    const title = event.data.title || "Just Us 💕";
    const body = event.data.body || "New chat message";
    self.registration.showNotification(title, {
      body: body,
      icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><rect width='100' height='100' rx='22' fill='%230d0d1a'/><text x='50%' y='60%' text-anchor='middle' font-size='60'>💕</text></svg>",
      badge: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>💕</text></svg>",
      tag: "just-us-chat",
      renotify: true,
      vibrate: [100, 50, 100]
    });
  }
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ("focus" in client) {
          client.postMessage({ type: "OPEN_CHAT" });
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow("./?openChat=1");
      }
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
