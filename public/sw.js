const CACHE = "s360-v34";
const PRECACHE = [
  "/",
  "/app",
  "/admin",
  "/css/tokens.css",
  "/css/login.css",
  "/css/app.css",
  "/css/admin.css",
  "/js/api.js",
  "/js/login.js",
  "/js/app.js",
  "/js/admin.js",
  "/js/pwa.js",
  "/js/haptic.js",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/manifest.json",
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECACHE).catch(() => {})));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.pathname.startsWith("/api/")) return;

  // HTML / navigasyon: her zaman ağdan (yenileme çalışsın)
  const isNav =
    request.mode === "navigate" ||
    url.pathname === "/" ||
    url.pathname === "/app" ||
    url.pathname === "/admin" ||
    url.pathname.endsWith(".html");

  if (isNav) {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(request, copy));
          return res;
        })
        .catch(() => caches.match(request).then((r) => r || caches.match("/")))
    );
    return;
  }

  event.respondWith(
    fetch(request)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(request, copy));
        return res;
      })
      .catch(() => caches.match(request))
  );
});

self.addEventListener("push", (event) => {
  let data = { title: "S-360", body: "Yeni bildirim" };
  try {
    data = { ...data, ...event.data.json() };
  } catch {
    /* default */
  }
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      vibrate: [280, 80, 280, 80, 400],
      silent: false,
      renotify: true,
      requireInteraction: true,
      tag: data.tag || "s360",
      timestamp: Date.now(),
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(self.clients.openWindow("/app"));
});
