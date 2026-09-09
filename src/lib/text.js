export function toUpperTr(value) {
  return String(value || "").toLocaleUpperCase("tr-TR");
}

/** Türkçe harfleri ASCII karşılıklarına indirger: Ş↔S, İ↔I, Ü↔U, Ö↔O, Ç↔C, Ğ↔G */
export function foldSearch(value) {
  const map = {
    Ş: "S",
    ş: "S",
    İ: "I",
    I: "I",
    ı: "I",
    i: "I",
    Ü: "U",
    ü: "U",
    Ö: "O",
    ö: "O",
    Ç: "C",
    ç: "C",
    Ğ: "G",
    ğ: "G",
  };
  let out = "";
  for (const ch of String(value || "")) {
    out += map[ch] || ch;
  }
  return out
    .toLocaleUpperCase("en-US")
    .replace(/[^A-Z0-9\s]/g, " ")
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
  const has = (words, word) => words.some((w) => w === word || (w.length >= 3 && word.length >= 3 && (w.includes(word) || word.includes(w))));
  return bw.every((w) => w.length < 2 || has(aw, w)) || aw.every((w) => w.length < 2 || has(bw, w));
}

function tokenHit(left, right) {
  if (!left || !right) return false;
  if (left === right) return true;
  if (left.length >= 2 && right.length >= 2 && (left.includes(right) || right.includes(left))) return true;
  return false;
}

/** Ad veya soyad veya tam ad eşleşmesi (Türkçe fold ile) */
export function alertPersonMatch(visit, alert) {
  const vFirst = foldSearch(visit.first_name || "");
  const vLast = foldSearch(visit.last_name || "");
  const vFull = foldSearch(visit.full_name || `${visit.first_name || ""} ${visit.last_name || ""}`);

  const aFirst = foldSearch(alert.first_name || "");
  const aLast = foldSearch(alert.last_name || "");
  const aFull = foldSearch(alert.full_name || alert.name_key || "");
  if (!aFull && !aFirst && !aLast) return false;

  const aParts = aFull.split(" ").filter(Boolean);
  const af = aFirst || aParts[0] || "";
  const al = aLast || (aParts.length > 1 ? aParts[aParts.length - 1] : "");

  if (af && (tokenHit(vFirst, af) || tokenHit(vLast, af) || tokenHit(vFull, af))) return true;
  if (al && (tokenHit(vLast, al) || tokenHit(vFirst, al) || tokenHit(vFull, al))) return true;
  if (aFull && (namesMatch(vFull, aFull) || tokenHit(vFirst, aFull) || tokenHit(vLast, aFull))) return true;
  return false;
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
