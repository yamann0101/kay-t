import { Router } from "express";
import bcrypt from "bcryptjs";
import { query } from "../db/pool.js";
import { parseShift, parseCopy, DEFAULT_SHIFT, DEFAULT_COPY } from "../lib/appSettings.js";
import { adminRequired, writeLog } from "../middleware/auth.js";
import { parseSheet, toCsv, toExcelXml } from "../lib/sheet.js";
import { normalizeFields } from "../lib/visitorFields.js";
import {
  getVisitorFields,
  saveVisitorFields,
  flattenVisitor,
  mapRowByHeaders,
  visitorSheet,
  insertVisitor,
  backfillVisitorPeople,
} from "../lib/visitors.js";

function sendSheet(res, filename, sheetName, headers, rows, format) {
  if (format === "csv") {
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}.csv"`);
    return res.send(toCsv(headers, rows));
  }
  res.setHeader("Content-Type", "application/vnd.ms-excel; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}.xls"`);
  return res.send(toExcelXml(sheetName, headers, rows));
}

function sheetFromBody(body) {
  const text = String(body?.text || "");
  if (!text.trim()) {
    const err = new Error("Dosya boş");
    err.status = 400;
    throw err;
  }
  if (text.startsWith("PK")) {
    const err = new Error("xlsx yerine CSV veya panelden indirdiğiniz Excel (.xls) dosyasını yükleyin");
    err.status = 400;
    throw err;
  }
  return parseSheet(text);
}

const router = Router();
router.use(adminRequired);

router.get("/overview", async (_req, res) => {
  const [users, keys, visitors, logs, movements] = await Promise.all([
    query("SELECT COUNT(*)::int AS n FROM users"),
    query("SELECT COUNT(*)::int AS n FROM keys"),
    query("SELECT COUNT(*)::int AS n FROM visitors"),
    query("SELECT COUNT(*)::int AS n FROM activity_logs"),
    query("SELECT COUNT(*)::int AS n FROM movements WHERE created_at::date = CURRENT_DATE"),
  ]);
  res.json({
    users: users.rows[0].n,
    keys: keys.rows[0].n,
    visitors: visitors.rows[0].n,
    logs: logs.rows[0].n,
    today: movements.rows[0].n,
  });
});

router.get("/users", async (_req, res) => {
  const { rows } = await query(
    `SELECT id, username, full_name, role, phone, active, created_at
     FROM users ORDER BY created_at DESC`
  );
  res.json({ items: rows });
});

router.post("/users", async (req, res) => {
  const { username, password, full_name, role, phone } = req.body || {};
  if (!username || !password || !full_name) {
    return res.status(400).json({ error: "Kullanıcı adı, şifre ve ad soyad gerekli" });
  }
  const hash = await bcrypt.hash(String(password), 10);
  try {
    const { rows } = await query(
      `INSERT INTO users (username, password_hash, full_name, role, phone)
       VALUES ($1,$2,$3,$4,$5)
       RETURNING id, username, full_name, role, phone, active, created_at`,
      [username.trim(), hash, full_name, role || "guard", phone || null]
    );
    await writeLog(req, "Kullanıcı eklendi", username);
    res.json({ item: rows[0] });
  } catch (err) {
    if (String(err.message).includes("users_username_key")) {
      return res.status(409).json({ error: "Bu kullanıcı adı zaten var" });
    }
    throw err;
  }
});

router.patch("/users/:id", async (req, res) => {
  const { full_name, role, phone, active, password } = req.body || {};
  const sets = [];
  const vals = [];
  let i = 1;
  if (full_name != null) {
    sets.push(`full_name=$${i++}`);
    vals.push(full_name);
  }
  if (role != null) {
    sets.push(`role=$${i++}`);
    vals.push(role);
  }
  if (phone != null) {
    sets.push(`phone=$${i++}`);
    vals.push(phone);
  }
  if (active != null) {
    sets.push(`active=$${i++}`);
    vals.push(Boolean(active));
  }
  if (password) {
    sets.push(`password_hash=$${i++}`);
    vals.push(await bcrypt.hash(String(password), 10));
  }
  sets.push("updated_at=NOW()");
  vals.push(req.params.id);
  const { rows } = await query(
    `UPDATE users SET ${sets.join(", ")} WHERE id=$${i}
     RETURNING id, username, full_name, role, phone, active, created_at`,
    vals
  );
  await writeLog(req, "Kullanıcı güncellendi", rows[0]?.username);
  res.json({ item: rows[0] });
});

router.delete("/users/:id", async (req, res) => {
  if (req.params.id === req.user.id) {
    return res.status(400).json({ error: "Kendi hesabınızı silemezsiniz" });
  }
  const { rows } = await query(`DELETE FROM users WHERE id=$1 RETURNING username`, [
    req.params.id,
  ]);
  await writeLog(req, "Kullanıcı silindi", rows[0]?.username);
  res.json({ ok: true });
});

router.get("/keys", async (_req, res) => {
  const { rows } = await query(
    `SELECT k.*, u.full_name AS holder_name, s.name AS section_name
     FROM keys k
     LEFT JOIN users u ON u.id = k.holder_id
     LEFT JOIN key_sections s ON s.id = k.section_id
     ORDER BY s.sort_order NULLS LAST, k.code`
  );
  res.json({ items: rows });
});

router.get("/key-sections", async (_req, res) => {
  const { rows } = await query(`SELECT * FROM key_sections ORDER BY sort_order, name`);
  res.json({ items: rows });
});

router.post("/key-sections", async (req, res) => {
  const name = String(req.body?.name || "").trim();
  if (!name) return res.status(400).json({ error: "Bölüm adı gerekli" });
  const { rows: n } = await query(`SELECT COALESCE(MAX(sort_order),0)+1 AS n FROM key_sections`);
  try {
    const { rows } = await query(
      `INSERT INTO key_sections (name, sort_order) VALUES ($1,$2) RETURNING *`,
      [name, n[0].n]
    );
    await writeLog(req, "Anahtar bölümü", name);
    res.json({ item: rows[0] });
  } catch {
    return res.status(409).json({ error: "Bu bölüm zaten var" });
  }
});

router.delete("/key-sections/:id", async (req, res) => {
  await query(`UPDATE keys SET section_id = NULL WHERE section_id=$1`, [req.params.id]);
  const { rows } = await query(`DELETE FROM key_sections WHERE id=$1 RETURNING name`, [req.params.id]);
  await writeLog(req, "Bölüm silindi", rows[0]?.name);
  res.json({ ok: true });
});

router.post("/keys", async (req, res) => {
  const { code, name, location, notes, section_id, pinned } = req.body || {};
  if (!code || !name) return res.status(400).json({ error: "Kod/numara ve ad gerekli" });
  try {
    const { rows } = await query(
      `INSERT INTO keys (code, name, location, notes, section_id, pinned) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [code, name, location || null, notes || null, section_id || null, Boolean(pinned)]
    );
    await writeLog(req, "Anahtar eklendi", code);
    res.json({ item: rows[0] });
  } catch {
    return res.status(409).json({ error: "Bu anahtar kodu zaten var" });
  }
});

router.patch("/keys/:id", async (req, res) => {
  const { section_id, pinned, name, location, notes, status } = req.body || {};
  const sets = [];
  const vals = [];
  let i = 1;
  if (name != null) {
    sets.push(`name=$${i++}`);
    vals.push(name);
  }
  if (location != null) {
    sets.push(`location=$${i++}`);
    vals.push(location);
  }
  if (notes != null) {
    sets.push(`notes=$${i++}`);
    vals.push(notes);
  }
  if (section_id !== undefined) {
    sets.push(`section_id=$${i++}`);
    vals.push(section_id || null);
  }
  if (pinned != null) {
    sets.push(`pinned=$${i++}`);
    vals.push(Boolean(pinned));
  }
  if (status && ["available", "taken", "lost"].includes(status)) {
    sets.push(`status=$${i++}`);
    vals.push(status);
  }
  if (!sets.length) return res.status(400).json({ error: "Güncellenecek alan yok" });
  vals.push(req.params.id);
  const { rows } = await query(
    `UPDATE keys SET ${sets.join(", ")} WHERE id=$${i} RETURNING *`,
    vals
  );
  res.json({ item: rows[0] });
});

router.get("/keys/export", async (req, res) => {
  const { rows } = await query(
    `SELECT k.code, k.name, k.location, k.status, k.notes, u.full_name AS holder_name
     FROM keys k LEFT JOIN users u ON u.id = k.holder_id ORDER BY k.code`
  );
  const headers = ["Kod", "Ad", "Konum", "Durum", "Not", "Teslim Alan"];
  const data = rows.map((k) => [k.code, k.name, k.location, k.status, k.notes, k.holder_name]);
  sendSheet(res, `s360-anahtarlar-${Date.now()}`, "Anahtarlar", headers, data, req.query.format);
});

router.post("/keys/import", async (req, res) => {
  let parsed;
  try {
    parsed = sheetFromBody(req.body);
  } catch (err) {
    return res.status(err.status || 400).json({ error: err.message });
  }
  let added = 0;
  let skipped = 0;
  for (const row of parsed.rows) {
    const code = String(row.Kod || row.kod || row.code || row.Code || "").trim();
    const name = String(row.Ad || row.ad || row.name || row.Name || code).trim();
    if (!code || !name) {
      skipped += 1;
      continue;
    }
    try {
      await query(
        `INSERT INTO keys (code, name, location, notes) VALUES ($1,$2,$3,$4)`,
        [
          code,
          name,
          String(row.Konum || row.konum || row.location || row.Location || "").trim() || null,
          String(row.Not || row.notes || row.Notes || "").trim() || null,
        ]
      );
      added += 1;
    } catch {
      skipped += 1;
    }
  }
  await writeLog(req, "Anahtar Excel yüklendi", `${added} eklendi`);
  res.json({ ok: true, added, skipped });
});

router.delete("/keys/:id", async (req, res) => {
  const { rows } = await query(`DELETE FROM keys WHERE id=$1 RETURNING code`, [req.params.id]);
  await writeLog(req, "Anahtar silindi", rows[0]?.code);
  res.json({ ok: true });
});

router.get("/logs", async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 200, 1000);
  const { rows } = await query(
    `SELECT l.*, u.full_name, u.username
     FROM activity_logs l
     LEFT JOIN users u ON u.id = l.user_id
     ORDER BY l.created_at DESC LIMIT $1`,
    [limit]
  );
  res.json({ items: rows });
});

router.get("/backup", async (_req, res) => {
  const tables = [
    "users",
    "keys",
    "key_sections",
    "key_logs",
    "visitors",
    "visitor_people",
    "movements",
    "announcements",
    "patrols",
    "shipments",
    "meetings",
    "activity_logs",
    "visitor_alerts",
    "notifications",
    "contacts",
    "settings",
  ];
  const data = { exported_at: new Date().toISOString(), tables: {} };
  for (const t of tables) {
    const { rows } = await query(`SELECT * FROM ${t}`);
    if (t === "users") {
      data.tables[t] = rows.map(({ password_hash, ...rest }) => rest);
    } else {
      data.tables[t] = rows;
    }
  }
  res.setHeader("Content-Disposition", `attachment; filename="s360-yedek-${Date.now()}.json"`);
  res.json(data);
});

router.post("/purge", async (req, res) => {
  const target = String(req.body?.target || "");
  const allowed = {
    movements: ["DELETE FROM movements"],
    visitors: ["DELETE FROM visitors", "DELETE FROM visitor_people"],
    logs: ["DELETE FROM activity_logs"],
    notifications: ["DELETE FROM notifications"],
    announcements: ["DELETE FROM announcements"],
  };
  if (!allowed[target]) return res.status(400).json({ error: "Geçersiz hedef" });
  for (const sql of allowed[target]) await query(sql);
  await writeLog(req, "Veri silindi", target);
  res.json({ ok: true });
});

router.post("/announcements", async (req, res) => {
  const { title, body } = req.body || {};
  if (!title || !body) return res.status(400).json({ error: "Başlık ve metin gerekli" });
  const { rows } = await query(
    `INSERT INTO announcements (title, body, created_by) VALUES ($1,$2,$3) RETURNING *`,
    [title, body, req.user.id]
  );
  await writeLog(req, "Duyuru", title);
  res.json({ item: rows[0] });
});

router.delete("/announcements/:id", async (req, res) => {
  await query(`DELETE FROM announcements WHERE id=$1`, [req.params.id]);
  res.json({ ok: true });
});

router.get("/settings", async (_req, res) => {
  const { rows } = await query(`SELECT key, value FROM settings`);
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  res.json({
    default_visitor_type: map.default_visitor_type || "sevkiyat",
    visitor_fields: await getVisitorFields(),
    shift_reminders: parseShift(map.shift_reminders),
    copy_templates: parseCopy(map.copy_templates),
  });
});

router.patch("/settings", async (req, res) => {
  const out = {};
  if (req.body?.visitor_fields != null) {
    out.visitor_fields = await saveVisitorFields(req.body.visitor_fields);
    await writeLog(req, "Form sütunları güncellendi", `${out.visitor_fields.length} sütun`);
  }
  if (req.body?.default_visitor_type != null) {
    const type = String(req.body.default_visitor_type || "");
    if (!["sevkiyat", "gorusme", "calisma"].includes(type)) {
      return res.status(400).json({ error: "Geçersiz varsayılan ekran" });
    }
    await query(
      `INSERT INTO settings (key, value) VALUES ('default_visitor_type', $1)
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
      [type]
    );
    out.default_visitor_type = type;
    await writeLog(req, "Ayar güncellendi", `Varsayılan kayıt: ${type}`);
  }
  if (req.body?.shift_reminders != null) {
    const shift = parseShift(req.body.shift_reminders);
    await query(
      `INSERT INTO settings (key, value) VALUES ('shift_reminders', $1)
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
      [JSON.stringify({ ...DEFAULT_SHIFT, ...shift })]
    );
    out.shift_reminders = parseShift(JSON.stringify({ ...DEFAULT_SHIFT, ...shift }));
    await writeLog(req, "Hatırlatma saatleri güncellendi", `${shift.morning} / ${shift.lunch} / ${shift.evening}`);
  }
  if (req.body?.copy_templates != null) {
    const copy = parseCopy(req.body.copy_templates);
    await query(
      `INSERT INTO settings (key, value) VALUES ('copy_templates', $1)
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
      [JSON.stringify({ ...DEFAULT_COPY, ...copy })]
    );
    out.copy_templates = parseCopy(JSON.stringify({ ...DEFAULT_COPY, ...copy }));
    await writeLog(req, "Kopya şablonları güncellendi", "");
  }
  if (!Object.keys(out).length) {
    return res.status(400).json({ error: "Güncellenecek ayar yok" });
  }
  res.json(out);
});

router.get("/visitors", async (req, res) => {
  const q = String(req.query.q || "").trim();
  const fields = await getVisitorFields();
  const { rows } = await query(
    `SELECT * FROM visitors ORDER BY created_at DESC LIMIT 800`
  );
  let items = rows.map((row) => flattenVisitor(row, fields));
  if (q) {
    const needle = q.toLowerCase();
    items = items.filter((row) =>
      Object.values(row).some((v) => String(v || "").toLowerCase().includes(needle))
    );
  }
  res.json({ items, fields: normalizeFields(fields) });
});

router.get("/visitors/export", async (req, res) => {
  const fields = await getVisitorFields();
  const { rows } = await query(
    `SELECT v.*, u.full_name AS created_by_name
     FROM visitors v
     LEFT JOIN users u ON u.id = v.created_by
     ORDER BY v.created_at DESC`
  );
  const sheet = visitorSheet(rows, fields);
  sendSheet(res, `s360-ziyaretciler-${Date.now()}`, "Ziyaretçiler", sheet.headers, sheet.rows, req.query.format);
});

router.post("/visitors/import", async (req, res) => {
  let parsed;
  try {
    parsed = sheetFromBody(req.body);
  } catch (err) {
    return res.status(err.status || 400).json({ error: err.message });
  }
  const fields = await getVisitorFields();
  let added = 0;
  let failed = 0;
  const errors = [];
  for (const row of parsed.rows) {
    try {
      await insertVisitor(req.user.id, mapRowByHeaders(row, fields), fields, {
        skipMovement: true,
        fillDefaults: true,
      });
      added += 1;
    } catch (err) {
      failed += 1;
      if (errors.length < 8) errors.push(err.message);
    }
  }
  await writeLog(req, "Ziyaretçi Excel yüklendi", `${added} kayıt`);
  res.json({ ok: true, added, failed, errors });
});

router.delete("/visitors/:id", async (req, res) => {
  const { rows } = await query(`DELETE FROM visitors WHERE id=$1 RETURNING full_name, record_no`, [
    req.params.id,
  ]);
  await writeLog(req, "Ziyaretçi silindi", rows[0]?.record_no || rows[0]?.full_name);
  res.json({ ok: true });
});

router.post("/backup/restore", async (req, res) => {
  const tables = req.body?.tables;
  if (!tables || typeof tables !== "object") {
    return res.status(400).json({ error: "Geçersiz yedek dosyası" });
  }
  const order = [
    ["key_logs", "DELETE FROM key_logs"],
    ["key_favorites", "DELETE FROM key_favorites"],
    ["notifications", "DELETE FROM notifications"],
    ["activity_logs", "DELETE FROM activity_logs"],
    ["movements", "DELETE FROM movements"],
    ["visitors", "DELETE FROM visitors"],
    ["visitor_people", "DELETE FROM visitor_people"],
    ["visitor_alerts", "DELETE FROM visitor_alerts"],
    ["announcements", "DELETE FROM announcements"],
    ["patrols", "DELETE FROM patrols"],
    ["shipments", "DELETE FROM shipments"],
    ["meetings", "DELETE FROM meetings"],
    ["contacts", "DELETE FROM contacts"],
    ["keys", "DELETE FROM keys"],
    ["key_sections", "DELETE FROM key_sections"],
  ];
  for (const [, sql] of order) await query(sql);

  async function insertRows(table, rows, cols) {
    if (!Array.isArray(rows) || !rows.length) return 0;
    let n = 0;
    for (const row of rows) {
      const values = cols.map((c) => {
        const v = row[c];
        if (v != null && typeof v === "object") return JSON.stringify(v);
        return v === undefined ? null : v;
      });
      const ph = cols.map((_, i) => `$${i + 1}`).join(",");
      try {
        await query(`INSERT INTO ${table} (${cols.join(",")}) VALUES (${ph})`, values);
        n += 1;
      } catch {
        /* satır atlanır */
      }
    }
    return n;
  }

  const restored = {};
  restored.key_sections = await insertRows("key_sections", tables.key_sections, [
    "id", "name", "sort_order", "created_at",
  ]);
  restored.keys = await insertRows("keys", tables.keys, [
    "id", "code", "name", "location", "status", "notes", "created_at", "section_id", "pinned",
    "notify_time", "notify_at",
  ]);
  restored.visitor_alerts = await insertRows("visitor_alerts", tables.visitor_alerts, [
    "id", "full_name", "name_key", "company", "company_key", "visit_date", "visit_time",
    "notes", "active", "matched_at", "matched_visitor_id", "created_by", "created_at",
  ]);
  restored.visitor_people = await insertRows("visitor_people", tables.visitor_people, [
    "id", "name_key", "first_name", "last_name", "full_name", "company", "plate", "phone",
    "visit_count", "first_visit_at", "last_visit_at", "first_visit_date", "last_visit_date",
    "last_entry_type", "last_visit_type", "last_visit_id", "visit_dates", "created_at",
  ]);
  restored.visitors = await insertRows("visitors", tables.visitors, [
    "id", "full_name", "company", "host", "phone", "plate", "category",
    "entered_at", "exited_at", "created_at", "first_name", "last_name",
    "visit_type", "notes", "visit_date", "entry_time", "exit_time", "exited",
    "record_no", "entry_type", "vehicle_status", "extra", "person_id", "search_key",
  ]);
  await backfillVisitorPeople();
  restored.movements = await insertRows("movements", tables.movements, [
    "id", "direction", "person_name", "category", "plate", "created_at",
  ]);
  restored.announcements = await insertRows("announcements", tables.announcements, [
    "id", "title", "body", "created_at",
  ]);
  restored.contacts = await insertRows("contacts", tables.contacts, [
    "id", "name", "title", "phone", "unit",
  ]);
  restored.patrols = await insertRows("patrols", tables.patrols, [
    "id", "name", "checkpoint", "status", "created_at",
  ]);
  restored.settings = 0;
  if (Array.isArray(tables.settings)) {
    for (const s of tables.settings) {
      if (!s?.key) continue;
      await query(
        `INSERT INTO settings (key, value) VALUES ($1,$2)
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
        [s.key, s.value]
      );
      restored.settings += 1;
    }
  }
  await writeLog(req, "Yedek yüklendi", `ziyaretçi ${restored.visitors}`);
  res.json({ ok: true, restored });
});

router.post("/notify", async (req, res) => {
  const { title, body } = req.body || {};
  if (!title || !body) return res.status(400).json({ error: "Başlık ve metin gerekli" });
  await sendPushAll({ title, body, type: "admin", tag: "admin" });
  await writeLog(req, "Bildirim gönderildi", title);
  res.json({ ok: true });
});

export default router;
