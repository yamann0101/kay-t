import webpush from "web-push";
import { query } from "../db/pool.js";
import { foldSearch, namesMatch, alertPersonMatch, nextNotifyAt, parseNotifyTime } from "./text.js";
import { parseShift, hhmmNow, todayKey } from "./appSettings.js";

export async function sendPushAll({ title, body, type = "info", tag, chatId, replyTo, url } = {}) {
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
    chatId: chatId || null,
    replyTo: replyTo || null,
    url: url || (chatId ? `/app#chat-${chatId}` : "/app"),
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
  const { rows } = await query(`SELECT * FROM visitor_alerts WHERE active = TRUE AND matched_at IS NULL`);
  const company = foldSearch(visit.company);
  const hits = [];
  for (const a of rows) {
    const nameHit = alertPersonMatch(visit, a);
    const companyHit = Boolean(
      a.company_key && company && (company === foldSearch(a.company_key) || namesMatch(company, a.company_key))
    );
    // İsim veya soyisim veya şirket eşleşirse bildirim
    if (nameHit || companyHit) hits.push(a);
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
      const willEnter = !(a.will_enter === false || a.will_enter === "false" || a.will_enter === 0);
      const enterLabel = willEnter ? "İçeri GİRECEK" : "İçeri GİRMEYECEK";
      const bits = [person.full_name || a.full_name, person.company || a.company, enterLabel].filter(Boolean);
      const note = a.notes ? ` · ${a.notes}` : "";
      await sendPushAll({
        title: "Beklenen ziyaretçi geldi",
        body: `${bits.join(" · ")}${note}`,
        type: "alert",
        tag: `alert-${a.id}`,
      });
      if (person.id && a.notes) {
        const enterBit = willEnter ? "İçeri GİRECEK" : "İçeri GİRMEYECEK";
        const addNote = `${a.notes} · ${enterBit}`;
        await query(
          `UPDATE visitors SET notes = CASE
             WHEN COALESCE(TRIM(notes),'') = '' THEN $2
             ELSE notes || E'\n' || $2
           END
           WHERE id = $1`,
          [person.id, addNote]
        );
      }
      await query(
        `UPDATE visitor_alerts SET matched_at = NOW(), matched_visitor_id = $2, active = FALSE WHERE id = $1`,
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
    processCustomReminders().catch(() => {});
  };
  tick();
  return setInterval(tick, 20_000);
}

function minutesOf(hhmm) {
  const m = String(hhmm || "").match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

function inWindow(nowMin, start, end) {
  if (start == null) return false;
  if (end == null) return nowMin === start;
  // geceyi aşan aralık: 20:00 → 06:00
  if (end < start) return nowMin >= start || nowMin <= end;
  return nowMin >= start && nowMin <= end;
}

function dayAllowed(days, weekday) {
  const d = String(days || "everyday").toLowerCase();
  if (!d || d === "everyday" || d === "hergun" || d === "hergün") return true;
  const map = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
  const tr = ["paz", "pzt", "sal", "car", "per", "cum", "cmt"];
  const token = map[weekday];
  const tokenTr = tr[weekday];
  return d.split(/[,\s]+/).some((x) => x === token || x === tokenTr || x === String(weekday));
}

export async function processCustomReminders() {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Istanbul",
    hour: "2-digit",
    minute: "2-digit",
    weekday: "short",
    hour12: false,
  }).formatToParts(now);
  const get = (t) => parts.find((p) => p.type === t)?.value || "";
  const hh = get("hour").padStart(2, "0");
  const mm = get("minute").padStart(2, "0");
  const nowMin = Number(hh) * 60 + Number(mm);
  const wdMap = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const weekday = wdMap[get("weekday")] ?? now.getDay();
  const dayKey = todayKey();
  const { rows } = await query(`SELECT * FROM custom_reminders WHERE active = TRUE`);
  for (const r of rows) {
    if (!dayAllowed(r.days, weekday)) continue;
    const start = minutesOf(r.start_time);
    const end = minutesOf(r.end_time);
    if (!inWindow(nowMin, start, end)) continue;
    const interval = Math.max(15, Number(r.interval_min) || 120);
    // slot: start'tan itibaren interval dakikada bir
    let hit = false;
    if (end == null) {
      hit = nowMin === start;
    } else if (end < start) {
      // gece aşımı
      const elapsed = nowMin >= start ? nowMin - start : nowMin + (24 * 60 - start);
      hit = elapsed % interval === 0;
    } else {
      const elapsed = nowMin - start;
      hit = elapsed >= 0 && elapsed % interval === 0;
    }
    if (!hit) continue;
    const slotKey = `${dayKey}-${hh}${mm}`;
    if (r.last_sent_key === slotKey) continue;
    await sendPushAll({
      title: r.title,
      body: r.body || r.title,
      type: "reminder",
      tag: `rem-${r.id}-${slotKey}`,
    });
    await query(`UPDATE custom_reminders SET last_sent_key=$2 WHERE id=$1`, [r.id, slotKey]);
  }
}
