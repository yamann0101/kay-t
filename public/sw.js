const CACHE = "s360-v58";
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
  "/js/webauthn-client.js",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/manifest.json",
];

let chatOpenFocused = false;

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
  if (event.data?.type === "CHAT_STATE") {
    chatOpenFocused = Boolean(event.data.open);
  }
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.pathname.startsWith("/api/")) return;

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
        .catch(() =>
          caches
            .match(request)
            .then((r) => r || caches.match("/app") || caches.match("/app.html") || caches.match("/"))
        )
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
    (async () => {
      const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const focused = clients.some((c) => c.focused);
      // Sohbet açıkken sadece sohbet push'unu bastır; diğerleri her zaman üstte görünsün
      if (data.type === "chat" && (chatOpenFocused || focused)) {
        for (const c of clients) {
          c.postMessage({ type: "PUSH_EVENT", ...data, silent: true });
        }
        return;
      }
      for (const c of clients) {
        c.postMessage({
          type: "PUSH_EVENT",
          title: data.title,
          body: data.body,
          tag: data.tag,
          notifType: data.type,
          chatId: data.chatId || null,
          url: data.url || "/app",
        });
      }
      await self.registration.showNotification(data.title || "S-360", {
        body: data.body || "",
        icon: "/icons/icon-192.png",
        badge: "/icons/icon-192.png",
        vibrate: [280, 80, 280, 80, 400],
        silent: false,
        renotify: true,
        requireInteraction: data.type === "alert" || data.type === "emergency" || data.type === "admin",
        tag: data.tag || `s360-${Date.now()}`,
        timestamp: Date.now(),
        data: {
          url: data.url || "/app",
          chatId: data.chatId || null,
          replyTo: data.replyTo || null,
          type: data.type || "info",
        },
      });
    })()
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const meta = event.notification.data || {};
  const target = meta.chatId ? `/app#chat-${meta.chatId}` : meta.url || "/app";
  event.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const c of all) {
        if (c.url.includes("/app") && "focus" in c) {
          await c.focus();
          c.postMessage({ type: "OPEN_CHAT", chatId: meta.chatId || null });
          return;
        }
      }
      await self.clients.openWindow(target);
    })()
  );
});
