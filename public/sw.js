/* S-360 SW v63 — HTML/CSS/JS asla kalici onbellekte tutulmaz */
const CACHE = "s360-v63";
const PRECACHE = [
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/manifest.json",
];

let chatOpenFocused = false;

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
      const c = await caches.open(CACHE);
      await c.addAll(PRECACHE).catch(() => {});
      await self.skipWaiting();
    })()
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
      const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of clients) {
        client.postMessage({ type: "SW_ACTIVATED", cache: CACHE });
      }
    })()
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
  if (event.data?.type === "CHAT_STATE") {
    chatOpenFocused = Boolean(event.data.open);
  }
  if (event.data?.type === "CLEAR_CACHES") {
    event.waitUntil(caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k)))));
  }
});

function isAsset(pathname) {
  return /\.(?:css|js|html|json|map)$/i.test(pathname) || pathname === "/sw.js";
}

function isNav(request, url) {
  return (
    request.mode === "navigate" ||
    url.pathname === "/" ||
    url.pathname === "/app" ||
    url.pathname === "/admin" ||
    url.pathname.endsWith(".html")
  );
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.pathname.startsWith("/api/")) return;

  // Navigasyon + JS/CSS: her zaman agdan; offline olursa eski shell
  if (isNav(request, url) || isAsset(url.pathname)) {
    event.respondWith(
      fetch(request, { cache: "no-store" }).catch(() =>
        caches.match(request).then((r) => r || caches.match("/app") || caches.match("/"))
      )
    );
    return;
  }

  // Ikon vb.: network-first, kisa onbellek
  event.respondWith(
    fetch(request)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(request, copy)).catch(() => {});
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
