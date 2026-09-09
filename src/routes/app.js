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

import { SQL_TR_TODAY, SQL_TR_MONTH } from "../lib/trTime.js";
import bcrypt from "bcryptjs";

const router = Router();
router.use(authRequired);

function daysWorked(startDate) {
  if (!startDate) return 0;
  const start = new Date(startDate);
  if (Number.isNaN(start.getTime())) return 0;
  const now = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Europe/Istanbul" })
  );
  const diff = Math.floor((now - start) / (24 * 60 * 60 * 1000));
  return Math.max(0, diff + 1);
}

function canMutateVisitor(user, row) {
  if (!row) return false;
  if (user.role === "viewer") return false;
  if (user.role === "admin" || user.role === "supervisor") return true;
  return String(row.created_by || "") === String(user.id);
}

function canWriteApp(user) {
  return user && user.role !== "viewer";
}

router.get("/summary", async (_req, res) => {
  const typeCount = (type, periodSql) =>
    query(
      `SELECT COUNT(*)::int AS n FROM visitors
       WHERE LOWER(COALESCE(visit_type,'')) = $1 AND ${periodSql}`,
      [type]
    );
  const [
    totalGiris,
    monthGiris,
    todayGiris,
    monthSev,
    monthGor,
    monthCal,
    todaySev,
    todayGor,
    todayCal,
  ] = await Promise.all([
    query(`SELECT COUNT(*)::int AS n FROM movements WHERE direction='giris'`),
    query(`SELECT COUNT(*)::int AS n FROM movements WHERE direction='giris' AND ${SQL_TR_MONTH}`),
    query(`SELECT COUNT(*)::int AS n FROM movements WHERE direction='giris' AND ${SQL_TR_TODAY}`),
    typeCount("sevkiyat", SQL_TR_MONTH),
    typeCount("gorusme", SQL_TR_MONTH),
    typeCount("calisma", SQL_TR_MONTH),
    typeCount("sevkiyat", SQL_TR_TODAY),
    typeCount("gorusme", SQL_TR_TODAY),
    typeCount("calisma", SQL_TR_TODAY),
  ]);

  res.json({
    total_giris: totalGiris.rows[0].n,
    month_giris: monthGiris.rows[0].n,
    month_sevkiyat: monthSev.rows[0].n,
    month_gorusme: monthGor.rows[0].n,
    month_calisma: monthCal.rows[0].n,
    giris: todayGiris.rows[0].n,
    sevkiyat: todaySev.rows[0].n,
    gorusme: todayGor.rows[0].n,
    calisma: todayCal.rows[0].n,
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
  const limit = Math.min(Number(req.query.limit) || 100, 200);
  const { rows } = await query(
    `SELECT * FROM notifications WHERE user_id = $1 OR user_id IS NULL
     ORDER BY created_at DESC LIMIT $2`,
    [req.user.id, limit]
  );
  // Eski bildirimleri budama (100+)
  await query(`
    DELETE FROM notifications WHERE id IN (
      SELECT id FROM notifications
      WHERE user_id = $1 OR user_id IS NULL
      ORDER BY created_at DESC
      OFFSET 100
    )
  `, [req.user.id]).catch(() => {});
  res.json({ items: rows });
});

router.post("/notifications/read-all", async (req, res) => {
  await query(`UPDATE notifications SET read = TRUE WHERE user_id = $1 OR user_id IS NULL`, [req.user.id]);
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
       v.created_by,
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
          created_by: r.created_by,
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
      created_by: r.created_by,
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
  if (!canWriteApp(req.user)) return res.status(403).json({ error: "İzleyici modunda kayıt yapılamaz" });
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
  if (!canWriteApp(req.user)) return res.status(403).json({ error: "İzleyici modunda işlem yapılamaz" });
  const { rows } = await query(
    `UPDATE visitors SET exited_at = NOW(), exited = TRUE, exit_time = COALESCE(exit_time, to_char(NOW() AT TIME ZONE 'Europe/Istanbul', 'HH24:MI'))
     WHERE id = $1 AND (exited_at IS NULL AND COALESCE(exited,false)=false) RETURNING *`,
    [req.params.id]
  );
  if (!rows[0]) return res.status(404).json({ error: "Kayıt bulunamadı veya zaten çıkış yapılmış" });
  await query(
    `INSERT INTO movements (direction, person_name, category, plate, created_by)
     VALUES ('cikis', $1, $2, $3, $4)`,
    [rows[0].full_name, rows[0].category, rows[0].plate, req.user.id]
  );
  await writeLog(req, "Ziyaretçi çıkış", `${rows[0].full_name}`);
  res.json({ item: rows[0] });
});

router.post("/visitors/bulk-exit", async (req, res) => {
  if (!canWriteApp(req.user)) return res.status(403).json({ error: "İzleyici modunda işlem yapılamaz" });
  const company = toUpperTr(req.body?.company || "").trim();
  if (!company) return res.status(400).json({ error: "Firma seçin" });
  const { rows } = await query(
    `UPDATE visitors SET exited_at = NOW(), exited = TRUE,
       exit_time = COALESCE(exit_time, to_char(NOW() AT TIME ZONE 'Europe/Istanbul', 'HH24:MI'))
     WHERE UPPER(TRIM(COALESCE(NULLIF(TRIM(company),''),'FİRMASIZ'))) = $1
       AND entered_at IS NOT NULL
       AND (exited_at IS NULL AND COALESCE(exited,false)=false)
     RETURNING *`,
    [company]
  );
  for (const v of rows) {
    await query(
      `INSERT INTO movements (direction, person_name, category, plate, created_by)
       VALUES ('cikis', $1, $2, $3, $4)`,
      [v.full_name, v.category, v.plate, req.user.id]
    );
  }
  await writeLog(req, "Toplu çıkış", `${company} · ${rows.length} kişi`);
  res.json({ count: rows.length, items: rows });
});

router.get("/visitors/inside-companies", async (_req, res) => {
  const { rows } = await query(
    `SELECT UPPER(TRIM(COALESCE(NULLIF(TRIM(company),''),'FİRMASIZ'))) AS company, COUNT(*)::int AS n
     FROM visitors
     WHERE entered_at IS NOT NULL AND (exited_at IS NULL AND COALESCE(exited,false)=false)
     GROUP BY 1
     ORDER BY n DESC, company`
  );
  res.json({ items: rows });
});

router.patch("/visitors/:id", async (req, res) => {
  const cur = await query(`SELECT * FROM visitors WHERE id=$1`, [req.params.id]);
  if (!cur.rows[0]) return res.status(404).json({ error: "Kayıt bulunamadı" });
  if (!canMutateVisitor(req.user, cur.rows[0])) {
    return res.status(403).json({ error: "Sadece kendi kaydınızı düzenleyebilirsiniz" });
  }
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
      notes ?? cur.rows[0].notes,
      entryType,
      searchBlob(name || cur.rows[0].full_name, first, last, companyVal, plateVal),
    ]
  );
  await writeLog(
    req,
    "Ziyaretçi düzenleme",
    `${req.user.full_name} · ${rows[0]?.full_name} · ${new Date().toLocaleString("tr-TR", { timeZone: "Europe/Istanbul" })}`
  );
  res.json({ item: rows[0] });
});

router.delete("/visitors/:id", async (req, res) => {
  const cur = await query(`SELECT * FROM visitors WHERE id=$1`, [req.params.id]);
  if (!cur.rows[0]) return res.status(404).json({ error: "Kayıt bulunamadı" });
  if (!canMutateVisitor(req.user, cur.rows[0])) {
    return res.status(403).json({ error: "Sadece kendi kaydınızı silebilirsiniz" });
  }
  const v = cur.rows[0];
  await query(`UPDATE visitor_alerts SET matched_visitor_id = NULL WHERE matched_visitor_id = $1`, [
    req.params.id,
  ]);
  await query(`UPDATE visitor_people SET last_visit_id = NULL WHERE last_visit_id = $1`, [req.params.id]);
  await query(
    `DELETE FROM movements
     WHERE person_name = $1
       AND COALESCE(plate,'') = COALESCE($2,'')
       AND created_at BETWEEN ($3::timestamptz - INTERVAL '3 minutes') AND ($3::timestamptz + INTERVAL '3 minutes')`,
    [v.full_name, v.plate || null, v.created_at || v.entered_at || new Date()]
  );
  await query(`DELETE FROM visitors WHERE id=$1`, [req.params.id]);
  await writeLog(
    req,
    "Ziyaretçi silme",
    `${req.user.full_name} · ${v.full_name || v.record_no} · ${new Date().toLocaleString("tr-TR", { timeZone: "Europe/Istanbul" })}`
  );
  res.json({ ok: true });
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

router.get("/activity", async (_req, res) => {
  const [vis, logs] = await Promise.all([
    query(
      `SELECT v.*, u.full_name AS created_by_name
       FROM visitors v
       LEFT JOIN users u ON u.id = v.created_by
       ORDER BY v.created_at DESC LIMIT 12`
    ),
    query(
      `SELECT l.id AS log_id, l.action, l.detail, l.created_at AS log_at, l.user_id AS log_user_id,
              k.id, k.code, k.name, k.status, k.location, k.holder_first_name, k.holder_last_name,
              k.holder_company, k.taken_at, k.returned_at, k.holder_id,
              u.full_name AS holder_name
       FROM key_logs l
       JOIN keys k ON k.id = l.key_id
       LEFT JOIN users u ON u.id = k.holder_id
       ORDER BY l.created_at DESC LIMIT 12`
    ),
  ]);
  const visitors = vis.rows.map((v) => ({
    kind: "visitor",
    at: v.created_at,
    ...v,
  }));
  const keys = logs.rows.map((r) => {
    let detail = {};
    try {
      detail = r.detail ? JSON.parse(r.detail) : {};
    } catch {
      detail = {};
    }
    return {
      kind: "key",
      at: r.log_at,
      log_id: r.log_id,
      action: r.action,
      id: r.id,
      code: r.code,
      name: r.name,
      status: r.status,
      location: r.location,
      holder_first_name: r.holder_first_name || detail.first_name,
      holder_last_name: r.holder_last_name || detail.last_name,
      holder_company: r.holder_company || detail.company,
      holder_name: r.holder_name,
      taken_at: r.taken_at || detail.taken_at,
      returned_at: r.returned_at || detail.returned_at,
      holder_id: r.holder_id,
      created_by: r.log_user_id,
    };
  });
  const items = [...visitors, ...keys]
    .sort((a, b) => new Date(b.at) - new Date(a.at))
    .slice(0, 16);
  res.json({ items });
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
  const first = toUpperTr(req.body?.first_name || "").trim();
  const last = toUpperTr(req.body?.last_name || "").trim();
  const fullName = toUpperTr(
    req.body?.full_name || `${first} ${last}`.trim()
  ).trim();
  if (!first && !last && !fullName) return res.status(400).json({ error: "Ad veya soyad gerekli" });
  const company = toUpperTr(req.body?.company || "").trim();
  const notes = String(req.body?.notes || "").trim();
  const willEnter = !(req.body?.will_enter === false || req.body?.will_enter === "false" || req.body?.will_enter === 0 || req.body?.will_enter === "0");
  const displayName = fullName || `${first} ${last}`.trim();
  const nameKey = foldSearch(displayName);
  const { rows } = await query(
    `INSERT INTO visitor_alerts (full_name, first_name, last_name, name_key, company, company_key, notes, will_enter, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
    [
      displayName,
      first || null,
      last || null,
      nameKey,
      company || null,
      company ? foldSearch(company) : null,
      notes || null,
      willEnter,
      req.user.id,
    ]
  );
  const item = rows[0];
  const enterLabel = willEnter ? "İçeri GİRECEK" : "İçeri GİRMEYECEK";
  const bits = [displayName, company, enterLabel].filter(Boolean);
  const noteBit = notes ? ` · ${notes}` : "";
  await sendPushAll({
    title: "Beklenen ziyaretçi",
    body: `${bits.join(" · ")}${noteBit}`,
    type: "alert",
    tag: `alert-new-${item.id}`,
  });
  await writeLog(req, "Haber ver", displayName);
  res.json({ item });
});

router.delete("/alerts/:id", async (req, res) => {
  await query(`DELETE FROM visitor_alerts WHERE id = $1`, [req.params.id]);
  res.json({ ok: true });
});

router.get("/profile", async (req, res) => {
  const u = req.user;
  res.json({
    user: {
      ...u,
      days_worked: daysWorked(u.start_date),
    },
  });
});

router.patch("/profile", async (req, res) => {
  const b = req.body || {};
  const { rows } = await query(
    `UPDATE users SET
       full_name = COALESCE(NULLIF($2,''), full_name),
       phone = COALESCE($3, phone),
       gender = COALESCE($4, gender),
       armed = COALESCE($5, armed),
       id_no = COALESCE($6, id_no),
       photo_url = COALESCE($7, photo_url),
       shoe_size = COALESCE($8, shoe_size),
       pants_size = COALESCE($9, pants_size),
       shirt_size = COALESCE($10, shirt_size),
       coat_size = COALESCE($11, coat_size),
       sweater_size = COALESCE($12, sweater_size),
       start_date = COALESCE($13::date, start_date),
       blood_type = COALESCE($14, blood_type),
       marital_status = COALESCE($15, marital_status),
       updated_at = NOW()
     WHERE id = $1
     RETURNING id, username, full_name, role, phone, active, gender, armed, id_no, photo_url,
               shoe_size, pants_size, shirt_size, coat_size, sweater_size, start_date,
               blood_type, marital_status, title_id, chat_manager`,
    [
      req.user.id,
      String(b.full_name || "").trim(),
      b.phone ?? null,
      b.gender ?? null,
      b.armed ?? null,
      b.id_no ?? null,
      b.photo_url ?? null,
      b.shoe_size ?? null,
      b.pants_size ?? null,
      b.shirt_size ?? null,
      b.coat_size ?? null,
      b.sweater_size ?? null,
      b.start_date || null,
      b.blood_type ?? null,
      b.marital_status ?? null,
    ]
  );
  const title = rows[0]?.title_id
    ? await query(`SELECT name FROM job_titles WHERE id=$1`, [rows[0].title_id])
    : { rows: [] };
  await writeLog(req, "Profil güncelleme", req.user.full_name);
  res.json({
    user: {
      ...rows[0],
      title_name: title.rows[0]?.name || null,
      days_worked: daysWorked(rows[0].start_date),
    },
  });
});

router.post("/profile/password", async (req, res) => {
  const current = String(req.body?.current || "");
  const next = String(req.body?.next || "");
  if (next.length < 4) return res.status(400).json({ error: "Yeni şifre en az 4 karakter" });
  const { rows } = await query(`SELECT password_hash FROM users WHERE id=$1`, [req.user.id]);
  const ok = await bcrypt.compare(current, rows[0]?.password_hash || "");
  if (!ok) return res.status(400).json({ error: "Mevcut şifre hatalı" });
  const hash = await bcrypt.hash(next, 10);
  await query(`UPDATE users SET password_hash=$2, updated_at=NOW() WHERE id=$1`, [req.user.id, hash]);
  await writeLog(req, "Şifre değişikliği", req.user.full_name);
  res.json({ ok: true });
});

router.get("/notes", async (_req, res) => {
  const { rows } = await query(
    `SELECT n.*, u.full_name AS created_by_name
     FROM site_notes n LEFT JOIN users u ON u.id = n.created_by
     ORDER BY n.created_at DESC LIMIT 40`
  );
  res.json({ items: rows });
});

router.post("/notes", async (req, res) => {
  if (!canWriteApp(req.user)) return res.status(403).json({ error: "İzleyici modunda işlem yapılamaz" });
  const kind = req.body?.kind === "cargo" ? "cargo" : "note";
  const title = String(req.body?.title || "").trim() || (kind === "cargo" ? "Kargo" : "Not");
  const body = String(req.body?.body || "").trim();
  let photo = String(req.body?.photo_url || "").trim() || null;
  if (photo && photo.length > 2_500_000) return res.status(400).json({ error: "Fotoğraf çok büyük" });
  if (!body && !title && !photo) return res.status(400).json({ error: "İçerik gerekli" });
  const { rows } = await query(
    `INSERT INTO site_notes (kind, title, body, photo_url, created_by) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [kind, title, body || null, photo, req.user.id]
  );
  const label = kind === "cargo" ? "Kargo bildirimi" : "Not";
  await sendPushAll({
    title: label,
    body: `${req.user.full_name}: ${title}${body ? ` — ${body}` : ""}${photo ? " · 📷" : ""}`.slice(0, 180),
    type: kind,
    tag: `note-${rows[0].id}`,
  });
  await writeLog(req, label, title);
  res.json({ item: rows[0] });
});

router.get("/chat", async (req, res) => {
  const { rows } = await query(
    `SELECT m.id, m.user_id, m.body, m.reply_to, m.created_at, m.deleted_at, m.deleted_by,
            u.full_name AS user_name, u.photo_url, t.name AS title_name,
            CASE WHEN m.deleted_at IS NULL THEN r.body ELSE NULL END AS reply_body,
            ru.full_name AS reply_user_name
     FROM chat_messages m
     LEFT JOIN users u ON u.id = m.user_id
     LEFT JOIN job_titles t ON t.id = u.title_id
     LEFT JOIN chat_messages r ON r.id = m.reply_to
     LEFT JOIN users ru ON ru.id = r.user_id
     ORDER BY m.created_at DESC
     LIMIT 120`
  );
  const settings = await query(`SELECT value FROM settings WHERE key='chat_managers_only'`);
  const managersOnly = settings.rows[0]?.value === "1" || settings.rows[0]?.value === "true";
  res.json({
    items: rows.reverse(),
    managers_only: managersOnly,
    can_post: canPostChat(req.user, managersOnly),
  });
});

function canPostChat(user, managersOnly) {
  if (!managersOnly) return true;
  if (!user) return false;
  if (user.role === "admin" || user.role === "supervisor") return true;
  return Boolean(user.chat_manager);
}

router.get("/chat/settings", async (req, res) => {
  if (req.user.role !== "admin") return res.status(403).json({ error: "Yönetici gerekli" });
  const settings = await query(`SELECT value FROM settings WHERE key='chat_managers_only'`);
  const managers = await query(
    `SELECT id, full_name, username, role, chat_manager FROM users WHERE active = TRUE ORDER BY full_name`
  );
  res.json({
    managers_only: settings.rows[0]?.value === "1" || settings.rows[0]?.value === "true",
    users: managers.rows,
  });
});

router.patch("/chat/settings", async (req, res) => {
  if (req.user.role !== "admin") return res.status(403).json({ error: "Yönetici gerekli" });
  if (req.body?.managers_only != null) {
    const on = Boolean(req.body.managers_only);
    await query(
      `INSERT INTO settings (key, value) VALUES ('chat_managers_only', $1)
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
      [on ? "1" : "0"]
    );
  }
  if (Array.isArray(req.body?.manager_ids)) {
    const ids = req.body.manager_ids.map(String);
    await query(`UPDATE users SET chat_manager = FALSE`);
    if (ids.length) {
      await query(`UPDATE users SET chat_manager = TRUE WHERE id = ANY($1::uuid[])`, [ids]);
    }
  }
  await writeLog(req, "Sohbet ayarları", JSON.stringify(req.body || {}));
  const settings = await query(`SELECT value FROM settings WHERE key='chat_managers_only'`);
  const managers = await query(
    `SELECT id, full_name, username, role, chat_manager FROM users WHERE active = TRUE ORDER BY full_name`
  );
  res.json({
    managers_only: settings.rows[0]?.value === "1" || settings.rows[0]?.value === "true",
    users: managers.rows,
  });
});

router.post("/chat", async (req, res) => {
  const settings = await query(`SELECT value FROM settings WHERE key='chat_managers_only'`);
  const managersOnly = settings.rows[0]?.value === "1" || settings.rows[0]?.value === "true";
  if (!canPostChat(req.user, managersOnly)) {
    return res.status(403).json({ error: "Sadece sohbet yöneticileri mesaj atabilir" });
  }
  const body = String(req.body?.body || "").trim();
  if (!body) return res.status(400).json({ error: "Mesaj boş" });
  const replyTo = req.body?.reply_to || null;
  const { rows } = await query(
    `INSERT INTO chat_messages (user_id, body, reply_to) VALUES ($1,$2,$3) RETURNING *`,
    [req.user.id, body, replyTo]
  );
  const item = rows[0];
  const isReply = Boolean(replyTo);
  await sendPushAll({
    title: isReply ? "Mesajına cevap verildi" : "Yeni sohbet",
    body: `${req.user.full_name}: ${body}`.slice(0, 160),
    type: "chat",
    tag: `chat-${item.id}`,
    chatId: item.id,
    replyTo,
  });
  res.json({ item });
});

router.delete("/chat/:id", async (req, res) => {
  const cur = await query(`SELECT * FROM chat_messages WHERE id=$1`, [req.params.id]);
  if (!cur.rows[0]) return res.status(404).json({ error: "Mesaj yok" });
  const msg = cur.rows[0];
  const isOwner = String(msg.user_id) === String(req.user.id);
  const isAdmin = req.user.role === "admin";
  if (!isOwner && !isAdmin) {
    return res.status(403).json({ error: "Sadece kendi mesajınızı silebilirsiniz" });
  }
  await query(
    `UPDATE chat_messages SET deleted_at = NOW(), deleted_by = $2 WHERE id = $1`,
    [req.params.id, req.user.id]
  );
  await writeLog(req, "Sohbet mesaj silindi", req.params.id);
  res.json({ ok: true, soft: true });
});

router.get("/reminders", async (req, res) => {
  if (req.user.role !== "admin") return res.status(403).json({ error: "Sadece yönetici" });
  const { rows } = await query(`SELECT * FROM custom_reminders ORDER BY created_at DESC`);
  res.json({ items: rows });
});

router.post("/reminders", async (req, res) => {
  if (req.user.role !== "admin") return res.status(403).json({ error: "Sadece yönetici" });
  const title = String(req.body?.title || "").trim();
  if (!title) return res.status(400).json({ error: "Başlık gerekli" });
  const body = String(req.body?.body || "").trim();
  const start_time = String(req.body?.start_time || "").slice(0, 5);
  const end_time = String(req.body?.end_time || "").slice(0, 5) || null;
  const interval_min = Math.max(15, Number(req.body?.interval_min) || 120);
  const days = String(req.body?.days || "everyday").trim() || "everyday";
  const { rows } = await query(
    `INSERT INTO custom_reminders (title, body, start_time, end_time, interval_min, days, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
    [title, body || null, start_time, end_time, interval_min, days, req.user.id]
  );
  await writeLog(req, "Hatırlatıcı", title);
  res.json({ item: rows[0] });
});

router.delete("/reminders/:id", async (req, res) => {
  if (req.user.role !== "admin") return res.status(403).json({ error: "Sadece yönetici" });
  await query(`DELETE FROM custom_reminders WHERE id=$1`, [req.params.id]);
  res.json({ ok: true });
});

export default router;
