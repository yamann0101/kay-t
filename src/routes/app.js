import { Router } from "express";
import { query } from "../db/pool.js";
import { authRequired, writeLog } from "../middleware/auth.js";
import { parseExtra } from "../lib/visitorFields.js";
import {
  getVisitorFields,
  insertVisitor,
  flattenVisitor,
  extraCompanions,
  normalizeCompanionList,
  attachPersonToVisit,
  withPersonStats,
  resolveEntryType,
} from "../lib/visitors.js";
import { sendPushAll, notifyVisitorAlerts } from "../lib/notify.js";
import { parseShift, parseCopy } from "../lib/appSettings.js";
import { foldSearch, namesMatch, searchBlob, toUpperTr, nextNotifyAt, parseNotifyTime } from "../lib/text.js";

const router = Router();
router.use(authRequired);

router.get("/summary", async (_req, res) => {
  const [giris, cikis, visitors, meetings, shipments, inside] = await Promise.all([
    query(`SELECT COUNT(*)::int AS n FROM movements WHERE direction='giris' AND created_at::date = CURRENT_DATE`),
    query(`SELECT COUNT(*)::int AS n FROM movements WHERE direction='cikis' AND created_at::date = CURRENT_DATE`),
    query(`SELECT COUNT(*)::int AS n FROM visitors WHERE entered_at IS NOT NULL AND exited_at IS NULL`),
    query(`SELECT COUNT(*)::int AS n FROM meetings WHERE status='active'`),
    query(`SELECT COUNT(*)::int AS n FROM shipments WHERE status='open'`),
    query(`
      SELECT GREATEST(
        (SELECT COUNT(*)::int FROM movements WHERE direction='giris' AND created_at::date = CURRENT_DATE)
        - (SELECT COUNT(*)::int FROM movements WHERE direction='cikis' AND created_at::date = CURRENT_DATE)
      , 0) AS n
    `),
  ]);

  res.json({
    giris: giris.rows[0].n,
    cikis: cikis.rows[0].n,
    iceride: inside.rows[0].n + 25,
    gorusme: meetings.rows[0].n,
    ziyaretci: visitors.rows[0].n,
    sevkiyat: shipments.rows[0].n,
  });
});

router.get("/movements", async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 20, 100);
  const { rows } = await query(
    `SELECT id, direction, person_name, category, plate, created_at
     FROM movements ORDER BY created_at DESC LIMIT $1`,
    [limit]
  );
  res.json({ items: rows });
});

router.get("/notifications", async (req, res) => {
  const { rows } = await query(
    `SELECT * FROM notifications WHERE user_id = $1 OR user_id IS NULL
     ORDER BY created_at DESC LIMIT 50`,
    [req.user.id]
  );
  res.json({ items: rows });
});

router.post("/notifications/read-all", async (req, res) => {
  await query(`UPDATE notifications SET read = TRUE WHERE user_id = $1`, [req.user.id]);
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

router.get("/visitors/suggest", async (req, res) => {
  try {
    const q = String(req.query.q || "").trim();
    const field = String(req.query.field || "").trim();
    if (q.length < 1) return res.json({ items: [] });
    const fields = await getVisitorFields();
    const like = `%${q}%`;
    const folded = `%${foldSearch(q)}%`;
    let where = `COALESCE(search_key, '') LIKE $2
        OR first_name ILIKE $1
        OR last_name ILIKE $1
        OR full_name ILIKE $1
        OR company ILIKE $1
        OR plate ILIKE $1
        OR COALESCE(extra, '') ILIKE $1`;
    const params = [like, folded];
    if (field === "first_name") {
      where = `first_name ILIKE $1 OR full_name ILIKE $1 OR COALESCE(search_key,'') LIKE $2 OR COALESCE(extra,'') ILIKE $1`;
    } else if (field === "last_name") {
      where = `last_name ILIKE $1 OR full_name ILIKE $1 OR COALESCE(search_key,'') LIKE $2 OR COALESCE(extra,'') ILIKE $1`;
    } else if (field === "company") {
      where = `company ILIKE $1 OR COALESCE(search_key,'') LIKE $2`;
    } else if (field === "plate") {
      where = `plate ILIKE $1 OR COALESCE(search_key,'') LIKE $2`;
    }
    const { rows } = await query(
      `SELECT * FROM visitors WHERE ${where} ORDER BY created_at DESC LIMIT 80`,
      params
    );
    const fq = foldSearch(q);
    const filtered = rows.filter((row) => {
      if (field === "first_name") {
        return (
          foldSearch(row.first_name).includes(fq) ||
          foldSearch(row.full_name).includes(fq) ||
          extraCompanions(row).some((c) => foldSearch(c.first_name).includes(fq))
        );
      }
      if (field === "last_name") {
        return (
          foldSearch(row.last_name).includes(fq) ||
          foldSearch(row.full_name).includes(fq) ||
          extraCompanions(row).some((c) => foldSearch(c.last_name).includes(fq))
        );
      }
      if (field === "company") return foldSearch(row.company).includes(fq);
      if (field === "plate") return foldSearch(row.plate).includes(fq);
      return true;
    });
    const seen = new Set();
    const items = [];
    for (const row of filtered) {
      const rowName = `${row.first_name || ""} ${row.last_name || ""} ${row.full_name || ""}`.trim();
      if (!rowName) continue;
      const personKey = row.person_id ? `p:${row.person_id}` : `n:${foldSearch(`${row.first_name} ${row.last_name}`)}`;
      if (seen.has(personKey)) continue;
      let source = row;
      if (row.person_id) {
        const latest = await query(
          `SELECT * FROM visitors WHERE person_id = $1 ORDER BY created_at DESC LIMIT 1`,
          [row.person_id]
        );
        if (latest.rows[0]) source = latest.rows[0];
      }
      const sourceName = `${source.first_name || ""} ${source.last_name || ""} ${source.full_name || ""}`.trim();
      if (!sourceName) continue;
      const sourceExtra = parseExtra(source);
      let visit = source;
      if (sourceExtra.group_id) {
        const found = await query(`SELECT * FROM visitors WHERE id = $1`, [sourceExtra.group_id]);
        if (found.rows[0]) visit = found.rows[0];
      }
      seen.add(personKey);
      const group = [
        { first_name: visit.first_name || "", last_name: visit.last_name || "" },
        ...extraCompanions(visit),
      ];
      const matchName = `${row.first_name || ""} ${row.last_name || ""}`.trim();
      const primary =
        group.find((p) => namesMatch(`${p.first_name} ${p.last_name}`, matchName)) || {
          first_name: row.first_name || "",
          last_name: row.last_name || "",
        };
      const companions = group.filter(
        (p) =>
          `${p.first_name || ""} ${p.last_name || ""}`.trim() &&
          !namesMatch(`${p.first_name} ${p.last_name}`, `${primary.first_name} ${primary.last_name}`)
      );
      const flat = flattenVisitor(visit, fields);
      items.push({
        ...flat,
        first_name: primary.first_name,
        last_name: primary.last_name,
        full_name: `${primary.first_name} ${primary.last_name}`.trim(),
        companions,
      });
      if (items.length >= 8) break;
    }
    res.json({ items });
  } catch (err) {
    console.error("suggest", err.message || err);
    res.status(500).json({ error: "Arama başarısız", items: [] });
  }
});

router.get("/visitors", async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 100, 200);
  const fields = await getVisitorFields();
  const { rows } = await query(`SELECT * FROM visitors ORDER BY created_at DESC LIMIT $1`, [limit]);
  res.json({ items: await Promise.all(rows.map((r) => withPersonStats(r, fields))) });
});

router.get("/visitors/people", async (_req, res) => {
  const fields = await getVisitorFields();
  const { rows } = await query(
    `SELECT
       p.id AS person_id,
       p.name_key,
       p.first_name AS person_first_name,
       p.last_name AS person_last_name,
       p.full_name AS person_full_name,
       p.company AS person_company,
       p.plate AS person_plate,
       p.phone AS person_phone,
       p.visit_count,
       p.first_visit_at,
       p.last_visit_at,
       p.first_visit_date,
       p.last_visit_date,
       p.last_entry_type,
       p.last_visit_type,
       p.last_visit_id,
       v.id AS visit_id,
       v.full_name,
       v.first_name,
       v.last_name,
       v.company,
       v.plate,
       v.phone,
       v.category,
       v.visit_type,
       v.notes,
       v.visit_date,
       v.entry_time,
       v.exit_time,
       v.exited,
       v.exited_at,
       v.entered_at,
       v.record_no,
       v.entry_type,
       v.vehicle_status,
       v.extra,
       v.host,
       v.created_at
     FROM visitor_people p
     LEFT JOIN visitors v ON v.id = p.last_visit_id
     ORDER BY p.last_visit_at DESC
     LIMIT 300`
  );
  const items = rows.map((r) => {
    const visit = r.visit_id
      ? {
          id: r.visit_id,
          full_name: r.full_name,
          first_name: r.first_name,
          last_name: r.last_name,
          company: r.company,
          plate: r.plate,
          phone: r.phone,
          category: r.category,
          visit_type: r.visit_type,
          notes: r.notes,
          visit_date: r.visit_date,
          entry_time: r.entry_time,
          exit_time: r.exit_time,
          exited: r.exited,
          exited_at: r.exited_at,
          entered_at: r.entered_at,
          record_no: r.record_no,
          entry_type: r.entry_type,
          vehicle_status: r.vehicle_status,
          extra: r.extra,
          host: r.host,
          created_at: r.created_at,
          person_id: r.person_id,
        }
      : null;
    const flat = visit ? flattenVisitor(visit, fields) : {};
    return {
      ...flat,
      id: r.visit_id || r.person_id,
      person_id: r.person_id,
      visit_count: r.visit_count || 0,
      first_visit_at: r.first_visit_at,
      last_visit_at: r.last_visit_at,
      first_visit_date: r.first_visit_date,
      last_visit_date: r.last_visit_date,
      full_name: r.full_name || r.person_full_name,
      first_name: r.first_name || r.person_first_name,
      last_name: r.last_name || r.person_last_name,
      company: r.company || r.person_company,
      plate: r.plate || r.person_plate,
      phone: r.phone || r.person_phone,
      entry_type: r.entry_type || r.last_entry_type,
      visit_type: r.visit_type || r.last_visit_type,
      created_at: r.last_visit_at || r.created_at,
    };
  });
  res.json({ items });
});

router.get("/visitors/next-no", async (_req, res) => {
  const { rows } = await query(`SELECT COUNT(*)::int AS n FROM visitors`);
  const n = (rows[0]?.n || 0) + 1;
  res.json({ record_no: `ZK-${String(n).padStart(4, "0")}` });
});

router.get("/visitors/:id", async (req, res) => {
  const fields = await getVisitorFields();
  const { rows } = await query(`SELECT * FROM visitors WHERE id = $1`, [req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: "Kayıt bulunamadı" });
  res.json({ item: await withPersonStats(rows[0], fields) });
});

router.post("/visitors", async (req, res) => {
  try {
    const fields = await getVisitorFields();
    const companions = normalizeCompanionList(req.body?.companions);
    const extraIn = req.body?.extra && typeof req.body.extra === "object" ? req.body.extra : {};
    const item = await insertVisitor(
      req.user.id,
      { ...req.body, extra: { ...extraIn, companions } },
      fields
    );
    const created = [];
    for (const c of companions) {
      const child = await insertVisitor(
        req.user.id,
        {
          ...req.body,
          first_name: c.first_name,
          last_name: c.last_name,
          extra: { group_id: item.id, group_leader: item.full_name },
          companions: [],
        },
        fields,
        { skipRequired: true }
      );
      created.push(child);
    }
    await writeLog(
      req,
      "Ziyaretçi kaydı",
      `${item.record_no} · ${item.full_name}${created.length ? ` +${created.length} kişi` : ""}`
    );
    const alerts = await notifyVisitorAlerts(item, created);
    res.json({ item, companions: created, alerts });
  } catch (err) {
    return res.status(400).json({ error: err.message || "Kayıt başarısız" });
  }
});

router.post("/visitors/:id/exit", async (req, res) => {
  const { rows } = await query(
    `UPDATE visitors SET exited_at = NOW(), exited = TRUE WHERE id = $1 RETURNING *`,
    [req.params.id]
  );
  if (rows[0]) {
    await query(
      `INSERT INTO movements (direction, person_name, category, plate, created_by)
       VALUES ('cikis', $1, $2, $3, $4)`,
      [rows[0].full_name, rows[0].category, rows[0].plate, req.user.id]
    );
  }
  res.json({ item: rows[0] });
});

router.patch("/visitors/:id", async (req, res) => {
  const { first_name, last_name, company, plate, notes } = req.body || {};
  const first = toUpperTr(first_name || "").trim();
  const last = toUpperTr(last_name || "").trim();
  const name = `${first} ${last}`.trim();
  const plateVal = toUpperTr(plate || "").trim();
  const companyVal = toUpperTr(company || "").trim();
  const entryType = resolveEntryType(plateVal);
  const { rows } = await query(
    `UPDATE visitors SET
       first_name = COALESCE($2, first_name),
       last_name = COALESCE($3, last_name),
       full_name = CASE WHEN $4 = '' THEN full_name ELSE $4 END,
       company = $5,
       plate = $6,
       notes = $7,
       entry_type = $8,
       vehicle_status = $8,
       search_key = $9
     WHERE id = $1 RETURNING *`,
    [
      req.params.id,
      first || null,
      last || null,
      name,
      companyVal || null,
      plateVal || null,
      notes || null,
      entryType,
      searchBlob(name, first, last, companyVal, plateVal),
    ]
  );
  if (rows[0]) await attachPersonToVisit(rows[0], { countVisit: false });
  res.json({ item: rows[0] });
});

router.get("/keys", async (req, res) => {
  const { rows } = await query(
    `SELECT k.*, u.full_name AS holder_name, s.name AS section_name,
            EXISTS(SELECT 1 FROM key_favorites f WHERE f.key_id = k.id AND f.user_id = $1) AS favorite
     FROM keys k
     LEFT JOIN users u ON u.id = k.holder_id
     LEFT JOIN key_sections s ON s.id = k.section_id
     ORDER BY s.sort_order NULLS LAST, k.code`,
    [req.user.id]
  );
  const sections = await query(`SELECT * FROM key_sections ORDER BY sort_order, name`);
  res.json({ items: rows, sections: sections.rows });
});

router.get("/key-sections", async (_req, res) => {
  const { rows } = await query(`SELECT * FROM key_sections ORDER BY sort_order, name`);
  res.json({ items: rows });
});

router.post("/keys/:id/favorite", async (req, res) => {
  const exists = await query(`SELECT 1 FROM key_favorites WHERE user_id=$1 AND key_id=$2`, [
    req.user.id,
    req.params.id,
  ]);
  if (exists.rows.length) {
    await query(`DELETE FROM key_favorites WHERE user_id=$1 AND key_id=$2`, [req.user.id, req.params.id]);
    return res.json({ favorite: false });
  }
  await query(`INSERT INTO key_favorites (user_id, key_id) VALUES ($1,$2)`, [req.user.id, req.params.id]);
  res.json({ favorite: true });
});

router.post("/keys/:id/take", async (req, res) => {
  const notifyTime = parseNotifyTime(req.body?.notify_time);
  const notifyAt = nextNotifyAt(notifyTime);
  const first = String(req.body?.first_name || "").trim();
  const last = String(req.body?.last_name || "").trim();
  const company = String(req.body?.company || "").trim();
  const full = `${first} ${last}`.trim();
  let takenAt = new Date();
  if (req.body?.taken_at) {
    const parsed = new Date(req.body.taken_at);
    if (!Number.isNaN(parsed.getTime())) takenAt = parsed;
  }
  const { rows } = await query(
    `UPDATE keys SET
       status='taken',
       holder_id=$2,
       notify_time=$3,
       notify_at=$4,
       holder_first_name=$5,
       holder_last_name=$6,
       holder_company=$7,
       taken_at=$8,
       returned_at=NULL
     WHERE id=$1 RETURNING *`,
    [
      req.params.id,
      req.user.id,
      notifyTime,
      notifyAt.toISOString(),
      first || null,
      last || null,
      company || null,
      takenAt.toISOString(),
    ]
  );
  const detail = JSON.stringify({
    first_name: first,
    last_name: last,
    company,
    taken_at: takenAt.toISOString(),
  });
  await query(`INSERT INTO key_logs (key_id, user_id, action, detail) VALUES ($1,$2,'teslim',$3)`, [
    req.params.id,
    req.user.id,
    detail,
  ]);
  await writeLog(
    req,
    "Anahtar teslim",
    `${rows[0]?.code} · ${full || "—"} · ${company || "—"} · hatırlatma ${notifyTime}`
  );
  res.json({ item: rows[0] });
});

router.post("/keys/:id/return", async (req, res) => {
  const current = await query(`SELECT * FROM keys WHERE id=$1`, [req.params.id]);
  const key = current.rows[0];
  if (!key) return res.status(404).json({ error: "Anahtar bulunamadı" });
  let returnedAt = new Date();
  if (req.body?.returned_at) {
    const parsed = new Date(req.body.returned_at);
    if (!Number.isNaN(parsed.getTime())) returnedAt = parsed;
  }
  const detail = JSON.stringify({
    first_name: key.holder_first_name,
    last_name: key.holder_last_name,
    company: key.holder_company,
    taken_at: key.taken_at,
    returned_at: returnedAt.toISOString(),
  });
  const { rows } = await query(
    `UPDATE keys SET
       status='available',
       holder_id=NULL,
       notify_time=NULL,
       notify_at=NULL,
       returned_at=$2
     WHERE id=$1 RETURNING *`,
    [req.params.id, returnedAt.toISOString()]
  );
  await query(`INSERT INTO key_logs (key_id, user_id, action, detail) VALUES ($1,$2,'iade',$3)`, [
    req.params.id,
    req.user.id,
    detail,
  ]);
  await writeLog(req, "Anahtar iade", rows[0]?.code);
  res.json({ item: rows[0] });
});

router.patch("/keys/:id/holder", async (req, res) => {
  const first = String(req.body?.first_name || "").trim();
  const last = String(req.body?.last_name || "").trim();
  const company = String(req.body?.company || "").trim();
  let takenAt = null;
  if (req.body?.taken_at) {
    const parsed = new Date(req.body.taken_at);
    if (!Number.isNaN(parsed.getTime())) takenAt = parsed.toISOString();
  }
  const { rows } = await query(
    `UPDATE keys SET
       holder_first_name=COALESCE($2, holder_first_name),
       holder_last_name=COALESCE($3, holder_last_name),
       holder_company=COALESCE($4, holder_company),
       taken_at=COALESCE($5::timestamptz, taken_at)
     WHERE id=$1 RETURNING *`,
    [req.params.id, first || null, last || null, company || null, takenAt]
  );
  if (!rows[0]) return res.status(404).json({ error: "Anahtar bulunamadı" });
  await writeLog(req, "Anahtar teslim düzenlendi", rows[0].code);
  res.json({ item: rows[0] });
});

router.post("/keys/:id/cancel-take", async (req, res) => {
  const { rows } = await query(
    `UPDATE keys SET
       status='available',
       holder_id=NULL,
       notify_time=NULL,
       notify_at=NULL,
       holder_first_name=NULL,
       holder_last_name=NULL,
       holder_company=NULL,
       taken_at=NULL,
       returned_at=NULL
     WHERE id=$1 RETURNING *`,
    [req.params.id]
  );
  if (!rows[0]) return res.status(404).json({ error: "Anahtar bulunamadı" });
  await query(`INSERT INTO key_logs (key_id, user_id, action, detail) VALUES ($1,$2,'iptal',$3)`, [
    req.params.id,
    req.user.id,
    JSON.stringify({ reason: "silindi" }),
  ]);
  await writeLog(req, "Anahtar teslim silindi", rows[0].code);
  res.json({ item: rows[0] });
});

router.get("/patrols", async (_req, res) => {
  const { rows } = await query(`SELECT * FROM patrols ORDER BY created_at`);
  res.json({ items: rows });
});

router.post("/patrols/:id/check", async (req, res) => {
  const { rows } = await query(
    `UPDATE patrols SET status='done', checked_by=$2, checked_at=NOW() WHERE id=$1 RETURNING *`,
    [req.params.id, req.user.id]
  );
  await writeLog(req, "Devriye", rows[0]?.checkpoint);
  res.json({ item: rows[0] });
});

router.get("/announcements", async (_req, res) => {
  const { rows } = await query(`SELECT * FROM announcements ORDER BY created_at DESC`);
  res.json({ items: rows });
});

router.get("/contacts", async (_req, res) => {
  const { rows } = await query(`SELECT * FROM contacts ORDER BY name`);
  res.json({ items: rows });
});

router.post("/push/subscribe", async (req, res) => {
  const sub = req.body || {};
  if (!sub.endpoint || !sub.keys?.p256dh || !sub.keys?.auth) {
    return res.status(400).json({ error: "Geçersiz abonelik" });
  }
  await query(
    `INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth)
     VALUES ($1,$2,$3,$4)
     ON CONFLICT (endpoint) DO UPDATE SET user_id=EXCLUDED.user_id, p256dh=EXCLUDED.p256dh, auth=EXCLUDED.auth`,
    [req.user.id, sub.endpoint, sub.keys.p256dh, sub.keys.auth]
  );
  res.json({ ok: true });
});

router.post("/emergency", async (req, res) => {
  const message = String(req.body?.message || "Acil durum bildirimi");
  await writeLog(req, "Acil durum", message);
  const sent = await sendPushAll({
    title: "Acil Durum",
    body: message,
    type: "emergency",
    tag: "emergency",
  });
  res.json({ ok: true, sent });
});

router.get("/alerts", async (_req, res) => {
  const { rows } = await query(
    `SELECT a.*, u.full_name AS created_by_name
     FROM visitor_alerts a
     LEFT JOIN users u ON u.id = a.created_by
     ORDER BY a.created_at DESC
     LIMIT 200`
  );
  res.json({ items: rows });
});

router.post("/alerts", async (req, res) => {
  const fullName = toUpperTr(req.body?.full_name || `${req.body?.first_name || ""} ${req.body?.last_name || ""}`).trim();
  if (!fullName) return res.status(400).json({ error: "İsim gerekli" });
  const company = toUpperTr(req.body?.company || "").trim();
  const visitDate = String(req.body?.visit_date || "").trim();
  const visitTime = String(req.body?.visit_time || "").trim();
  const notes = String(req.body?.notes || "").trim();
  const nameKey = foldSearch(fullName);
  const { rows } = await query(
    `INSERT INTO visitor_alerts (full_name, name_key, company, company_key, visit_date, visit_time, notes, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
    [fullName, nameKey, company || null, company ? foldSearch(company) : null, visitDate || null, visitTime || null, notes || null, req.user.id]
  );
  const item = rows[0];
  const when = [visitDate, visitTime].filter(Boolean).join(" ");
  const bits = [fullName, company, when].filter(Boolean);
  const noteBit = notes ? ` · ${notes}` : "";
  await sendPushAll({
    title: "Beklenen ziyaretçi",
    body: `${bits.join(" · ")}${noteBit}`,
    type: "alert",
    tag: `alert-new-${item.id}`,
  });
  await writeLog(req, "Haber ver", fullName);
  res.json({ item });
});

router.delete("/alerts/:id", async (req, res) => {
  await query(`DELETE FROM visitor_alerts WHERE id = $1`, [req.params.id]);
  res.json({ ok: true });
});

export default router;
