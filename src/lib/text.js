export function toUpperTr(value) {
  return String(value || "").toLocaleUpperCase("tr-TR");
}

export function foldSearch(value) {
  return String(value || "")
    .replace(/İ/g, "I")
    .replace(/ı/g, "I")
    .replace(/i/g, "I")
    .replace(/I/g, "I")
    .replace(/[Şş]/g, "S")
    .replace(/[Ğğ]/g, "G")
    .replace(/[Üü]/g, "U")
    .replace(/[Öö]/g, "O")
    .replace(/[Çç]/g, "C")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function searchBlob(...parts) {
  return foldSearch(parts.filter(Boolean).join(" "));
}

export function namesMatch(left, right) {
  const a = foldSearch(left);
  const b = foldSearch(right);
  if (!a || !b) return false;
  if (a === b) return true;
  if (a.includes(b) || b.includes(a)) return Math.min(a.length, b.length) >= 3;
  const aw = a.split(" ").filter(Boolean);
  const bw = b.split(" ").filter(Boolean);
  if (!aw.length || !bw.length) return false;
  const has = (words, word) => words.some((w) => w === word || w.includes(word) || word.includes(w));
  return bw.every((w) => w.length < 2 || has(aw, w)) || aw.every((w) => w.length < 2 || has(bw, w));
}

export function parseNotifyTime(raw) {
  const s = String(raw || "").trim();
  const m = s.match(/^(\d{1,2})[:.](\d{2})$/);
  if (!m) return "06:00";
  const h = Math.min(23, Math.max(0, Number(m[1])));
  const min = Math.min(59, Math.max(0, Number(m[2])));
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

export function nextNotifyAt(hhmm, from = new Date()) {
  const t = parseNotifyTime(hhmm);
  const [h, m] = t.split(":").map(Number);
  const d = new Date(from.getTime());
  d.setSeconds(0, 0);
  d.setHours(h, m, 0, 0);
  if (d.getTime() <= from.getTime() + 15000) d.setDate(d.getDate() + 1);
  return d;
}
