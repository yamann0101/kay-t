async function api(path, opts = {}) {
  let res;
  try {
    res = await fetch(path, {
      credentials: "include",
      headers: { "Content-Type": "application/json", ...(opts.headers || {}) },
      ...opts,
      body: opts.body ? JSON.stringify(opts.body) : opts.rawBody,
    });
  } catch (err) {
    const e = new Error(err?.message || "Ağ hatası");
    e.network = true;
    e.status = 0;
    throw e;
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const e = new Error(data.error || "İstek başarısız");
    e.status = res.status;
    e.data = data;
    throw e;
  }
  return data;
}

function toast(msg) {
  const el = document.getElementById("toast");
  if (!el) return;
  el.textContent = msg;
  el.classList.add("show");
  setTimeout(() => el.classList.remove("show"), 2400);
}

const TR_TZ = "Europe/Istanbul";

function fmtTime(iso) {
  const d = new Date(iso);
  return d.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit", timeZone: TR_TZ });
}

function fmtDateTime(iso) {
  return new Date(iso).toLocaleString("tr-TR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: TR_TZ,
  });
}

const months = [
  "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
  "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık",
];
const days = ["Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"];

function trParts(d = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: TR_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    weekday: "short",
    hour12: false,
  }).formatToParts(d);
  const get = (t) => parts.find((p) => p.type === t)?.value || "";
  const y = Number(get("year"));
  const m = Number(get("month"));
  const day = Number(get("day"));
  const hour = get("hour").padStart(2, "0");
  const minute = get("minute").padStart(2, "0");
  const wdMap = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 0 };
  const weekday = wdMap[get("weekday")] ?? new Date(`${y}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}T12:00:00+03:00`).getDay();
  return { y, m, day, hour, minute, weekday };
}

function nowParts() {
  const p = trParts();
  return {
    date: `${p.day} ${months[p.m - 1]} ${p.y}`,
    time: `${days[p.weekday]} ${p.hour}:${p.minute}`,
  };
}

function trTodayStamp() {
  const p = trParts();
  return `${String(p.day).padStart(2, "0")}.${String(p.m).padStart(2, "0")}.${p.y}`;
}

function trIsoDate() {
  const p = trParts();
  return `${p.y}-${String(p.m).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

function trHm() {
  const p = trParts();
  return `${p.hour}:${p.minute}`;
}

function haptic(kind = "tap") {
  try {
    if (window.haptic) return window.haptic(kind);
    if (typeof navigator === "undefined" || typeof navigator.vibrate !== "function") return;
    navigator.vibrate(kind === "heavy" ? [16, 10, 24] : 12);
  } catch {
    /* cihaz desteklemiyorsa sessiz geç */
  }
}

function playNotifyBeep() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "sine";
    o.frequency.value = 880;
    g.gain.value = 0.0001;
    o.connect(g);
    g.connect(ctx.destination);
    const now = ctx.currentTime;
    g.gain.exponentialRampToValueAtTime(0.12, now + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.28);
    o.start(now);
    o.stop(now + 0.3);
    setTimeout(() => ctx.close().catch(() => {}), 400);
  } catch {
    /* ignore */
  }
}

function cacheSession(user) {
  try {
    if (!user) return localStorage.removeItem("s360_session");
    localStorage.setItem(
      "s360_session",
      JSON.stringify({ user, at: Date.now() })
    );
  } catch {
    /* ignore */
  }
}

function readCachedSession() {
  try {
    const raw = JSON.parse(localStorage.getItem("s360_session") || "null");
    if (!raw?.user) return null;
    if (Date.now() - Number(raw.at || 0) > 40 * 24 * 60 * 60 * 1000) return null;
    return raw.user;
  } catch {
    return null;
  }
}

function saveLocalLogin(username, password) {
  try {
    const payload = btoa(unescape(encodeURIComponent(JSON.stringify({ u: username, p: password }))));
    localStorage.setItem("s360_saved_login", payload);
  } catch {
    /* ignore */
  }
}

function readSavedLogin() {
  try {
    const raw = localStorage.getItem("s360_saved_login");
    if (!raw) return null;
    const obj = JSON.parse(decodeURIComponent(escape(atob(raw))));
    if (!obj?.u || !obj?.p) return null;
    return obj;
  } catch {
    return null;
  }
}

function clearLocalLogin() {
  try {
    localStorage.removeItem("s360_saved_login");
  } catch {
    /* ignore */
  }
}
