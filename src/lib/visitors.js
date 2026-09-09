import { query } from "../db/pool.js";
import {
  normalizeFields,
  splitVisitorPayload,
  enabledFields,
  visitorValue,
  parseExtra,
  DEFAULT_VISITOR_FIELDS,
  BUILTIN_KEYS,
} from "./visitorFields.js";
import { foldSearch, searchBlob, toUpperTr } from "./text.js";

export async function getVisitorFields() {
  const { rows } = await query(`SELECT value FROM settings WHERE key='visitor_fields'`);
  return normalizeFields(rows[0]?.value);
}

export async function saveVisitorFields(fields) {
  const normalized = normalizeFields(fields);
  await query(
    `INSERT INTO settings (key, value) VALUES ('visitor_fields', $1)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
    [JSON.stringify(normalized)]
  );
  return normalized;
}

export async function nextRecordNo() {
  const { rows } = await query(`SELECT COUNT(*)::int AS n FROM visitors`);
  return `ZK-${String((rows[0]?.n || 0) + 1).padStart(4, "0")}`;
}

export function flattenVisitor(row, fields) {
  const extra = parseExtra(row);
  const out = { ...row, extra };
  for (const f of normalizeFields(fields)) {
    out[f.key] = visitorValue({ ...row, extra }, f.key);
  }
  return out;
}

export function mapRowByHeaders(rowObj, fields) {
  const list = enabledFields(fields);
  const fold = (s) => String(s || "").trim().toLocaleLowerCase("tr-TR");
  const byLabel = new Map(list.map((f) => [fold(f.label), f.key]));
  const byKey = new Map(list.map((f) => [fold(f.key), f.key]));
  const body = {};
  for (const [header, val] of Object.entries(rowObj || {})) {
    const h = fold(header);
    const key = byLabel.get(h) || byKey.get(h);
    if (key) body[key] = val;
  }
  return body;
}

export function visitorSheet(rows, fields) {
  const cols = enabledFields(fields);
  const headers = [...cols.map((f) => f.label), "Kayıt Eden"];
  const data = rows.map((row) => [
    ...cols.map((f) => visitorValue(row, f.key)),
    row.created_by_name || "",
  ]);
  return { headers, rows: data, fields: cols };
}

export async function insertVisitor(userId, body, fields, opts = {}) {
  const schema = normalizeFields(fields || DEFAULT_VISITOR_FIELDS);
  const { cols, extra } = splitVisitorPayload(body || {}, schema);
  const first = toUpperTr(cols.first_name || body?.first_name || "").trim();
  const last = toUpperTr(cols.last_name || body?.last_name || "").trim();
  cols.company = toUpperTr(cols.company || body?.company || "").trim();
  cols.host = toUpperTr(cols.host || body?.host || "").trim();
  cols.phone = toUpperTr(cols.phone || body?.phone || "").trim();
  cols.plate = toUpperTr(cols.plate || body?.plate || "").trim();
  if (Array.isArray(extra.companions)) {
    extra.companions = extra.companions.map((c) => ({
      first_name: toUpperTr(c?.first_name).trim(),
      last_name: toUpperTr(c?.last_name).trim(),
    }));
  }

  if (opts.fillDefaults) {
    const d = new Date();
    if (!String(cols.visit_date || "").trim()) {
      cols.visit_date = `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`;
    }
    if (!String(cols.entry_time || "").trim()) {
      cols.entry_time = d.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
    }
  }

  if (!opts.skipRequired) {
    if (!first || !last) {
      throw new Error("İsim ve soyisim zorunlu");
    }
    for (const f of enabledFields(schema)) {
      if (!f.required || f.readonly || f.key === "visit_type" || f.key === "entry_type") continue;
      const val = BUILTIN_KEYS.has(f.key) ? cols[f.key] : extra[f.key];
      if (!String(val || "").trim() && f.key !== "record_no") {
        throw new Error(`${f.label} zorunlu`);
      }
    }
  }

  const name = toUpperTr(body?.full_name || `${first} ${last}`.trim()).trim();
  if (!name) throw new Error("İsim ve soyisim zorunlu");

  const type = ["sevkiyat", "gorusme", "calisma", "kargo", "yemek"].includes(cols.visit_type || body?.visit_type)
    ? cols.visit_type || body.visit_type
    : "sevkiyat";
  const labels = {
    sevkiyat: "Sevkiyat",
    gorusme: "Görüşme",
    calisma: "Çalışma",
    kargo: "Kargo",
    yemek: "Yemek Siparişi",
  };
  const cat = body?.category || labels[type];
  const recordNo = String(cols.record_no || body?.record_no || "").trim() || (await nextRecordNo());
  const plateVal = String(cols.plate || body?.plate || "").trim();
  const entryType = resolveEntryType(plateVal);
  const exited = Boolean(body?.exited);

  const { rows } = await query(
    `INSERT INTO visitors (
       full_name, first_name, last_name, company, host, phone, plate, category,
       visit_type, notes, visit_date, entry_time, exit_time, exited, record_no,
       entry_type, vehicle_status, extra, search_key,
       entered_at, exited_at, created_by
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,NOW(),CASE WHEN $14 THEN NOW() ELSE NULL END,$20)
     RETURNING *`,
    [
      name,
      first || null,
      last || null,
      cols.company || null,
      cols.host || null,
      cols.phone || null,
      plateVal || null,
      cat,
      type,
      cols.notes || body?.notes || null,
      cols.visit_date || body?.visit_date || null,
      cols.entry_time || body?.entry_time || null,
      cols.exit_time || body?.exit_time || null,
      exited,
      recordNo,
      entryType,
      entryType,
      JSON.stringify(extra),
      searchBlob(name, first, last, cols.company, cols.phone, plateVal),
      userId || null,
    ]
  );

  const visit = rows[0];
  const person = await attachPersonToVisit(visit, { countVisit: true });
  if (person) {
    await query(`UPDATE visitors SET person_id = $1 WHERE id = $2`, [person.id, visit.id]);
    visit.person_id = person.id;
  }

  if (!opts.skipMovement) {
    await query(
      `INSERT INTO movements (direction, person_name, category, plate, created_by)
       VALUES ('giris', $1, $2, $3, $4)`,
      [name, cat, plateVal || null, userId || null]
    );
    if (exited) {
      await query(
        `INSERT INTO movements (direction, person_name, category, plate, created_by)
         VALUES ('cikis', $1, $2, $3, $4)`,
        [name, cat, plateVal || null, userId || null]
      );
    }
  }
  return visit;
}

export function personNameKey(row) {
  const first = String(row?.first_name || "").trim();
  const last = String(row?.last_name || "").trim();
  const full = String(row?.full_name || `${first} ${last}`).trim();
  return foldSearch(full);
}

export function resolveEntryType(plate) {
  return String(plate || "").trim() ? "ARAÇLI" : "YAYAN";
}

function parseVisitDates(raw) {
  try {
    const v = typeof raw === "string" ? JSON.parse(raw) : raw;
    return Array.isArray(v) ? v.filter(Boolean).map(String) : [];
  } catch {
    return [];
  }
}

export async function attachPersonToVisit(visit, opts = {}) {
  const countVisit = opts.countVisit !== false;
  const nameKey = personNameKey(visit);
  if (!nameKey) return null;
  const visitDate = String(visit.visit_date || "").trim();
  const at = visit.created_at || visit.entered_at || new Date().toISOString();
  const entryType = visit.entry_type || resolveEntryType(visit.plate);

  const found = await query(`SELECT * FROM visitor_people WHERE name_key = $1`, [nameKey]);
  let person = found.rows[0] || null;

  if (!person) {
    const dates = visitDate ? [visitDate] : [];
    const ins = await query(
      `INSERT INTO visitor_people (
         name_key, first_name, last_name, full_name, company, plate, phone,
         visit_count, first_visit_at, last_visit_at, first_visit_date, last_visit_date,
         last_entry_type, last_visit_type, last_visit_id, visit_dates
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$9,$10,$10,$11,$12,$13,$14)
       RETURNING *`,
      [
        nameKey,
        visit.first_name || null,
        visit.last_name || null,
        visit.full_name,
        visit.company || null,
        visit.plate || null,
        visit.phone || null,
        countVisit ? 1 : 0,
        at,
        visitDate || null,
        entryType,
        visit.visit_type || null,
        visit.id,
        JSON.stringify(dates),
      ]
    );
    person = ins.rows[0];
  } else if (countVisit) {
    const dates = parseVisitDates(person.visit_dates);
    if (visitDate && dates[dates.length - 1] !== visitDate) dates.push(visitDate);
    const upd = await query(
      `UPDATE visitor_people SET
         first_name = COALESCE($2, first_name),
         last_name = COALESCE($3, last_name),
         full_name = COALESCE($4, full_name),
         company = COALESCE($5, company),
         plate = $6,
         phone = COALESCE($7, phone),
         visit_count = visit_count + 1,
         last_visit_at = $8,
         last_visit_date = COALESCE($9, last_visit_date),
         last_entry_type = $10,
         last_visit_type = COALESCE($11, last_visit_type),
         last_visit_id = $12,
         visit_dates = $13
       WHERE id = $1 RETURNING *`,
      [
        person.id,
        visit.first_name || null,
        visit.last_name || null,
        visit.full_name || null,
        visit.company || null,
        visit.plate || null,
        visit.phone || null,
        at,
        visitDate || null,
        entryType,
        visit.visit_type || null,
        visit.id,
        JSON.stringify(dates.slice(-40)),
      ]
    );
    person = upd.rows[0];
  } else if (!person.last_visit_id || String(person.last_visit_id) === String(visit.id)) {
    const upd = await query(
      `UPDATE visitor_people SET
         first_name = COALESCE($2, first_name),
         last_name = COALESCE($3, last_name),
         full_name = COALESCE($4, full_name),
         company = COALESCE($5, company),
         plate = $6,
         phone = COALESCE($7, phone),
         last_entry_type = $8,
         last_visit_type = COALESCE($9, last_visit_type),
         last_visit_id = $10
       WHERE id = $1 RETURNING *`,
      [
        person.id,
        visit.first_name || null,
        visit.last_name || null,
        visit.full_name || null,
        visit.company || null,
        visit.plate || null,
        visit.phone || null,
        entryType,
        visit.visit_type || null,
        visit.id,
      ]
    );
    person = upd.rows[0];
  }
  return person;
}

export async function withPersonStats(visit, fields) {
  const flat = flattenVisitor(visit, fields);
  if (!visit?.person_id) return flat;
  const { rows } = await query(
    `SELECT visit_count, first_visit_date, last_visit_date, first_visit_at, last_visit_at
     FROM visitor_people WHERE id = $1`,
    [visit.person_id]
  );
  const p = rows[0];
  if (!p) return flat;
  return { ...flat, ...p, person_id: visit.person_id };
}

export async function backfillVisitorPeople() {
  const { rows: all } = await query(`SELECT id, plate, entry_type, full_name, first_name, last_name, company, phone FROM visitors`);
  for (const row of all) {
    const type = resolveEntryType(row.plate);
    const key = searchBlob(row.full_name, row.first_name, row.last_name, row.company, row.phone, row.plate);
    if (row.entry_type !== type) {
      await query(`UPDATE visitors SET search_key = $2, entry_type = $3, vehicle_status = $3 WHERE id = $1`, [
        row.id,
        key,
        type,
      ]);
    } else {
      await query(`UPDATE visitors SET search_key = $2 WHERE id = $1`, [row.id, key]);
    }
  }
  const { rows: people } = await query(`SELECT * FROM visitor_people`);
  for (const p of people) {
    const key = personNameKey(p);
    if (!key || key === p.name_key) continue;
    const other = await query(`SELECT * FROM visitor_people WHERE name_key = $1 AND id <> $2`, [key, p.id]);
    if (other.rows[0]) {
      await query(`UPDATE visitors SET person_id = $1 WHERE person_id = $2`, [other.rows[0].id, p.id]);
      await query(`UPDATE visitor_people SET visit_count = visit_count + $2 WHERE id = $1`, [
        other.rows[0].id,
        p.visit_count || 0,
      ]);
      await query(`DELETE FROM visitor_people WHERE id = $1`, [p.id]);
    } else {
      try {
        await query(`UPDATE visitor_people SET name_key = $2 WHERE id = $1`, [p.id, key]);
      } catch {
        /* unique collision ignored */
      }
    }
  }
  const { rows } = await query(
    `SELECT * FROM visitors WHERE person_id IS NULL ORDER BY created_at ASC`
  );
  for (const row of rows) {
    const person = await attachPersonToVisit(row, { countVisit: true });
    if (person) {
      await query(`UPDATE visitors SET person_id = $1 WHERE id = $2`, [person.id, row.id]);
    }
  }
}

export function extraCompanions(row) {
  const extra = parseExtra(row);
  const list = Array.isArray(extra.companions) ? extra.companions : [];
  return list
    .map((c) => ({
      first_name: String(c?.first_name || "").trim(),
      last_name: String(c?.last_name || "").trim(),
    }))
    .filter((c) => c.first_name || c.last_name);
}

export function normalizeCompanionList(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((c) => ({
      first_name: toUpperTr(c?.first_name || "").trim(),
      last_name: toUpperTr(c?.last_name || "").trim(),
    }))
    .filter((c) => c.first_name || c.last_name);
}
