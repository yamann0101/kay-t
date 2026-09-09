async function api(path, opts = {}) {
  const res = await fetch(path, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(opts.headers || {}) },
    ...opts,
    body: opts.body ? JSON.stringify(opts.body) : opts.rawBody,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "İstek başarısız");
  return data;
}

function toast(msg) {
  const el = document.getElementById("toast");
  if (!el) return;
  el.textContent = msg;
  el.classList.add("show");
  setTimeout(() => el.classList.remove("show"), 2400);
}

function fmtTime(iso) {
  const d = new Date(iso);
  return d.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
}

function fmtDateTime(iso) {
  return new Date(iso).toLocaleString("tr-TR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const months = [
  "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
  "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık",
];
const days = ["Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"];

function nowParts() {
  const d = new Date();
  return {
    date: `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`,
    time: `${days[d.getDay()]} ${d.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}`,
  };
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
