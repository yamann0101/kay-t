if ("serviceWorker" in navigator) {
  window.addEventListener("load", async () => {
    try {
      const reg = await navigator.serviceWorker.register("/sw.js");
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

// Pull-to-refresh: daha uzun çekince yenile (hassas olmasın)
(function bindPullRefresh() {
  let startY = 0;
  let pulling = false;
  const threshold = 140;
  const getScroll = () =>
    document.querySelector(".app-scroll") || document.scrollingElement || document.documentElement;

  const atTop = () => {
    const sc = getScroll();
    return (sc.scrollTop || 0) <= 2 || window.scrollY <= 2;
  };

  const regDirty = () => {
    try {
      if (typeof isRegFormDirty === "function") return isRegFormDirty();
    } catch {
      /* ignore */
    }
    return false;
  };

  document.addEventListener(
    "touchstart",
    (e) => {
      if (!atTop()) {
        pulling = false;
        return;
      }
      startY = e.touches[0].clientY;
      pulling = true;
    },
    { passive: true }
  );

  document.addEventListener(
    "touchmove",
    (e) => {
      if (!pulling) return;
      const dy = e.touches[0].clientY - startY;
      if (dy > 40) document.documentElement.classList.add("pulling");
    },
    { passive: true }
  );

  document.addEventListener(
    "touchend",
    (e) => {
      document.documentElement.classList.remove("pulling");
      if (!pulling) return;
      pulling = false;
      const dy = e.changedTouches[0].clientY - startY;
      if (dy > threshold && atTop()) {
        if (regDirty() && !confirm("Kayıt formu dolu. Yenilerseniz yazdıklarınız silinir. Devam edilsin mi?")) {
          return;
        }
        location.reload();
      }
    },
    { passive: true }
  );
})();
