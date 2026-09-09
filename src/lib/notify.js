import webpush from "web-push";
import { query } from "../db/pool.js";
import { foldSearch, namesMatch, nextNotifyAt, parseNotifyTime } from "./text.js";
import { parseShift, hhmmNow, todayKey } from "./appSettings.js";

export async function sendPushAll({ title, body, type = "info", tag } = {}) {
  const t = String(title || "S-360").trim();
  const b = String(body || "").trim();
  if (!t || !b) return 0;
  await query(`INSERT INTO notifications (title, body, type) VALUES ($1,$2,$3)`, [t, b, type]);
  const { rows } = await query(`SELECT endpoint, p256dh, auth FROM push_subscriptions`);
  const payload = JSON.stringify({
    title: t.startsWith("S-360") ? t : `S-360 · ${t}`,
    body: b,
    tag: tag || type,
    type,
  });
  await Promise.allSettled(
    rows.map((s) =>
      webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        payload
      )
    )
  );
  return rows.length;
}

export async function processDueKeyNotifs() {
  const { rows } = await query(
    `SELECT k.*, u.full_name AS holder_name
     FROM keys k
     LEFT JOIN users u ON u.id = k.holder_id
     WHERE k.status = 'taken' AND k.notify_at IS NOT NULL AND k.notify_at <= NOW()`
  );
  for (const k of rows) {
    const time = parseNotifyTime(k.notify_time);
    const who = k.holder_name || "görevli";
    await sendPushAll({
      title: "Anahtar hatırlatma",
      body: `${k.code} · ${k.name} hâlâ teslimde (${who}). Hatırlatma saati ${time}.`,
      type: "key",
      tag: `key-${k.id}`,
    });
    await query(`UPDATE keys SET notify_at = $2 WHERE id = $1`, [k.id, nextNotifyAt(time).toISOString()]);
  }
}

export async function matchVisitorAlerts(visit) {
  const { rows } = await query(`SELECT * FROM visitor_alerts WHERE active = TRUE`);
  const name = foldSearch(`${visit.first_name || ""} ${visit.last_name || ""} ${visit.full_name || ""}`);
  const company = foldSearch(visit.company);
  const hits = [];
  for (const a of rows) {
    if (!namesMatch(name, a.name_key)) continue;
    if (a.company_key && company && !namesMatch(company, a.company_key)) continue;
    hits.push(a);
  }
  return hits;
}

export async function notifyVisitorAlerts(visit, extras = []) {
  const people = [visit, ...extras].filter(Boolean);
  const seen = new Set();
  const fired = [];
  for (const person of people) {
    const hits = await matchVisitorAlerts(person);
    for (const a of hits) {
      if (seen.has(a.id)) continue;
      seen.add(a.id);
      const when = [a.visit_date, a.visit_time].filter(Boolean).join(" ");
      const bits = [person.full_name || a.full_name, person.company || a.company, when].filter(Boolean);
      const note = a.notes ? ` · ${a.notes}` : "";
      await sendPushAll({
        title: "Beklenen ziyaretçi geldi",
        body: `${bits.join(" · ")}${note}`,
        type: "alert",
        tag: `alert-${a.id}`,
      });
      await query(
        `UPDATE visitor_alerts SET matched_at = NOW(), matched_visitor_id = $2 WHERE id = $1`,
        [a.id, person.id || null]
      );
      fired.push(a);
    }
  }
  return fired;
}

export async function processShiftReminders() {
  const { rows } = await query(`SELECT key, value FROM settings WHERE key IN ('shift_reminders', 'shift_sent')`);
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  const shift = parseShift(map.shift_reminders);
  if (!shift.enabled) return;
  const now = hhmmNow();
  const day = todayKey();
  let sent = {};
  try {
    sent = map.shift_sent ? JSON.parse(map.shift_sent) : {};
  } catch {
    sent = {};
  }
  if (sent.day !== day) sent = { day };
  const slots = [
    ["morning", shift.morning, "İş başı", shift.morning_text],
    ["lunch", shift.lunch, "Öğle molası", shift.lunch_text],
    ["evening", shift.evening, "Mesai bitişi", shift.evening_text],
  ];
  let changed = false;
  for (const [key, time, title, body] of slots) {
    if (!time || sent[key] === day) continue;
    if (now !== String(time).slice(0, 5)) continue;
    await sendPushAll({
      title,
      body: body || title,
      type: "shift",
      tag: `shift-${key}-${day}`,
    });
    sent[key] = day;
    sent.day = day;
    changed = true;
  }
  if (changed) {
    await query(
      `INSERT INTO settings (key, value) VALUES ('shift_sent', $1)
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
      [JSON.stringify(sent)]
    );
  }
}

export function startNotifier() {
  const tick = () => {
    processDueKeyNotifs().catch(() => {});
    processShiftReminders().catch(() => {});
  };
  tick();
  return setInterval(tick, 20_000);
}
