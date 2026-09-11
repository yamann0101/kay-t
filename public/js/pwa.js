const APP_BUILD = "63";

if ("serviceWorker" in navigator) {
  // Eski build kaldiysa tum cache + SW sil, bir kez yenile
  (async () => {
    try {
      const prev = localStorage.getItem("s360_build");
      if (prev !== APP_BUILD) {
        localStorage.setItem("s360_build", APP_BUILD);
        if ("caches" in window) {
          const keys = await caches.keys();
          await Promise.all(keys.map((k) => caches.delete(k)));
        }
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((r) => r.unregister()));
        if (!sessionStorage.getItem("s360_build_boot")) {
          sessionStorage.setItem("s360_build_boot", APP_BUILD);
          location.reload();
          return;
        }
      }
    } catch {
      /* ignore */
    }
  })();

  window.addEventListener("load", async () => {
    try {
      const reg = await navigator.serviceWorker.register(`/sw.js?v=${APP_BUILD}`, { updateViaCache: "none" });
      reg.update().catch(() => {});
      setInterval(() => reg.update().catch(() => {}), 20_000);
      if (reg.waiting) reg.waiting.postMessage({ type: "SKIP_WAITING" });
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

  let reloading = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (reloading) return;
    reloading = true;
    location.reload();
  });

  navigator.serviceWorker.addEventListener("message", (ev) => {
    if (ev.data?.type === "SW_ACTIVATED" && !sessionStorage.getItem("s360_sw_act")) {
      sessionStorage.setItem("s360_sw_act", String(Date.now()));
    }
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
