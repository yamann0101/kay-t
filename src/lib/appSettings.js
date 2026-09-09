export const DEFAULT_SHIFT = {
  enabled: true,
  morning: "08:00",
  lunch: "12:00",
  evening: "18:00",
  morning_text: "İş başı — hayırlı sabahlar, vardiya başladı.",
  lunch_text: "Öğle molası — yemek saati.",
  evening_text: "Mesai bitişi — hayırlı akşamlar.",
};

export const DEFAULT_COPY = {
  sevkiyat: "SEVKİYAT YAPMAK İÇİN GİRİŞ YAPTI KONTROLLER YAPILDI İLGİLİ KİŞİLER BİLGİLENDİRİLDİ VE GİRİŞ YAPTI",
  gorusme: "GÖRÜŞME YAPMAK İÇİN GİRİŞ YAPTI KONTROLLER YAPILDI İLGİLİ KİŞİLER BİLGİLENDİRİLDİ VE GİRİŞ YAPTI",
  calisma: "ÇALIŞMA YAPMAK İÇİN GİRİŞ YAPTI KONTROLLER YAPILDI İLGİLİ KİŞİLER BİLGİLENDİRİLDİ VE GİRİŞ YAPTI",
};

function parseJson(raw, fallback) {
  try {
    const v = typeof raw === "string" ? JSON.parse(raw) : raw;
    return v && typeof v === "object" ? { ...fallback, ...v } : { ...fallback };
  } catch {
    return { ...fallback };
  }
}

export function parseShift(raw) {
  return parseJson(raw, DEFAULT_SHIFT);
}

export function parseCopy(raw) {
  return parseJson(raw, DEFAULT_COPY);
}

export function hhmmNow(d = new Date()) {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function todayKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
