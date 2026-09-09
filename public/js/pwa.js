if ("serviceWorker" in navigator) {
  window.addEventListener("load", async () => {
    try {
      const reg = await navigator.serviceWorker.register("/sw.js");
      // Yeni sürüm gelince hemen al
      reg.update().catch(() => {});
      setInterval(() => reg.update().catch(() => {}), 60_000);
      reg.addEventListener("updatefound", () => {
        const sw = reg.installing;
        if (!sw) return;
        sw.addEventListener("statechange", () => {
          if (sw.state === "installed" && navigator.serviceWorker.controller) {
            sw.postMessage({ type: "SKIP_WAITING" });
          }
        });
      });
    } catch {
      /* ignore */
    }
  });

  let refreshing = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (refreshing) return;
    refreshing = true;
    location.reload();
  });
}

// Pull-to-refresh: yukarı çekince sayfayı yenile
(function bindPullRefresh() {
  let startY = 0;
  let pulling = false;
  const threshold = 72;
  const getScroll = () =>
    document.querySelector(".app-scroll") || document.scrollingElement || document.documentElement;

  document.addEventListener(
    "touchstart",
    (e) => {
      const sc = getScroll();
      if ((sc.scrollTop || 0) > 2) {
        pulling = false;
        return;
      }
      startY = e.touches[0].clientY;
      pulling = true;
    },
    { passive: true }
  );

  document.addEventListener(
    "touchend",
    (e) => {
      if (!pulling) return;
      pulling = false;
      const dy = e.changedTouches[0].clientY - startY;
      if (dy > threshold) {
        location.reload();
      }
    },
    { passive: true }
  );
})();
