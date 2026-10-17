// Moss & Moon service worker:
// - pages: try the network first, fall back to a saved copy, then the offline page
// - app files & photos: served from the cache once seen
// - push: shows "your order is ready" notifications
const VERSION = "mm-v1";
const OFFLINE = "/offline";

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll([OFFLINE, "/icons/icon-192.png"])).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/") && !url.pathname.startsWith("/api/uploads/")) return; // live data: never cache

  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(VERSION).then((c) => c.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req).then((hit) => hit || caches.match(OFFLINE)))
    );
    return;
  }

  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/_next/image") || url.pathname.startsWith("/icons/") || url.pathname.startsWith("/api/uploads/")) {
    e.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(VERSION).then((c) => c.put(req, copy));
            }
            return res;
          })
      )
    );
  }
});

self.addEventListener("push", (e) => {
  let data = { title: "Moss & Moon", body: "Your order has an update ✿", url: "/orders" };
  try { data = { ...data, ...e.data.json() }; } catch {}
  e.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "/icons/icon-192.png",
      badge: "/icons/badge-96.png",
      data: { url: data.url },
      vibrate: [120, 60, 120],
      tag: data.url,
      renotify: true,
    })
  );
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const target = new URL(e.notification.data?.url || "/", self.location.origin).href;
  e.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((wins) => {
      const same = wins.find((w) => w.url === target);
      if (same) return same.focus();
      return self.clients.openWindow(target);
    })
  );
});
