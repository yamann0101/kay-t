(function () {
  const TAP = 14;
  const KEY = 9;
  function haptic(kind) {
    try {
      if (!navigator.vibrate) return;
      if (kind === "key") navigator.vibrate(KEY);
      else if (kind === "ok" || kind === "save") navigator.vibrate([12, 28, 16]);
      else if (kind === "warn" || kind === "heavy") navigator.vibrate([16, 10, 24]);
      else navigator.vibrate(TAP);
    } catch {
      /* ignore */
    }
  }
  window.haptic = haptic;
  document.addEventListener(
    "pointerdown",
    (e) => {
      const el = e.target.closest(
        "button, a, .tab, .vis-pill, .vis-act, .vis-stat, .vis-more, .vis-copy-mini, .key-btn, .key-star, .qcard, .pick, .fab, .suggest-item, [data-view], select, label.vis-chip, .companion-add, .companion-del, .clr, .dir-tile, .dir-cat, .move-btn, .reg-tab, .stat, [role='button']"
      );
      if (!el) return;
      if (el.disabled || el.getAttribute("aria-disabled") === "true") return;
      haptic("tap");
    },
    { passive: true }
  );
  document.addEventListener(
    "input",
    (e) => {
      const t = e.target;
      if (!t) return;
      if (t.matches("input, textarea")) haptic("key");
    },
    { passive: true }
  );
})();
