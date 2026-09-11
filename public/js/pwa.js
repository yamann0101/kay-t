if ("serviceWorker" in navigator) {
  window.addEventListener("load", async () => {
    try {
      const reg = await navigator.serviceWorker.register("/sw.js?v=62");
      reg.update().catch(() => {});
      setInterval(() => reg.update().catch(() => {}), 30_000);
      reg.addEventListener("updatefound", () => {
        const sw = reg.installing;
        if (!sw) return;
        sw.addEventListener("statechange", () => {
          if (sw.state === "installed" && navigator.serviceWorker.controller) {
            sw.postMessage({ type: "SKIP_WAITING" });
          }
        });
      });
      // Eski SW varsa hemen guncelle
      if (reg.waiting) reg.waiting.postMessage({ type: "SKIP_WAITING" });
    } catch {
      /* ignore */
    }
  });

  let reloading = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (reloading) return;
    reloading = true;
    try {
      sessionStorage.setItem("s360_sw_reloaded", String(Date.now()));
    } catch {
      /* ignore */
    }
    location.reload();
  });
}

function ptrEl() {
  return document.getElementById("ptrBar");
}

function setPtrProgress(p, refreshing = false) {
  const el = ptrEl();
  if (!el) return;
  const clamped = Math.max(0, Math.min(1, p));
  el.classList.toggle("visible", clamped > 0.05 || refreshing);
  el.classList.toggle("ready", clamped >= 1 && !refreshing);
  el.classList.toggle("refreshing", refreshing);
  el.style.setProperty("--ptr", String(clamped));
  el.setAttribute("aria-hidden", clamped < 0.05 && !refreshing ? "true" : "false");
}

window.showPtrRefreshing = function showPtrRefreshing() {
  setPtrProgress(1, true);
};

window.hidePtr = function hidePtr() {
  setPtrProgress(0, false);
};

(function bindPullRefresh() {
  let startY = 0;
  let pulling = false;
  let armed = false;
  const threshold = () => Math.max(320, Math.round(window.innerHeight * 0.55));
  const getScroll = () =>
    document.querySelector(".app-scroll") || document.scrollingElement || document.documentElement;

  const atTop = () => {
    const sc = getScroll();
    return (sc.scrollTop || 0) <= 2 || window.scrollY <= 2;
  };

  const triggerReload = () => {
    setPtrProgress(1, true);
    if (typeof doAppReload === "function") {
      doAppReload();
    } else {
      location.reload();
    }
  };

  document.addEventListener(
    "touchstart",
    (e) => {
      if (!atTop()) {
        pulling = false;
        armed = false;
        return;
      }
      startY = e.touches[0].clientY;
      pulling = true;
      armed = false;
    },
    { passive: true }
  );

  document.addEventListener(
    "touchmove",
    (e) => {
      if (!pulling) return;
      const dy = e.touches[0].clientY - startY;
      if (dy < 40) {
        setPtrProgress(0, false);
        armed = false;
        return;
      }
      const t = threshold();
      const p = Math.min(1.15, dy / t);
      armed = p >= 1;
      setPtrProgress(p, false);
      document.documentElement.classList.toggle("pulling", dy > 48);
    },
    { passive: true }
  );

  document.addEventListener(
    "touchend",
    () => {
      document.documentElement.classList.remove("pulling");
      if (!pulling) return;
      pulling = false;
      if (armed && atTop()) {
        triggerReload();
      } else {
        setPtrProgress(0, false);
      }
      armed = false;
    },
    { passive: true }
  );

  window.triggerAppReload = triggerReload;
})();
