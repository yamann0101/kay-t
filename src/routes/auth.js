import { Router } from "express";
import bcrypt from "bcryptjs";
import { query } from "../db/pool.js";
import {
  signToken,
  setAuthCookie,
  clearAuthCookie,
  authRequired,
  writeLog,
} from "../middleware/auth.js";
import { config } from "../config.js";
import { regOptions, regVerify, authOptions, authVerify } from "../lib/webauthn.js";

const router = Router();

function publicUser(user, extra = {}) {
  return {
    id: user.id,
    username: user.username,
    full_name: user.full_name,
    role: user.role,
    phone: user.phone,
    has_webauthn: Boolean(user.webauthn_cred_id),
    ...extra,
  };
}

router.post("/login", async (req, res) => {
  const username = String(req.body?.username || "").trim();
  const password = String(req.body?.password || "");
  if (!username || !password) {
    return res.status(400).json({ error: "Kullanıcı adı ve şifre gerekli" });
  }

  const { rows } = await query(
    "SELECT * FROM users WHERE LOWER(username) = LOWER($1)",
    [username]
  );
  const user = rows[0];
  if (!user || !user.active) {
    return res.status(401).json({ error: "Kullanıcı adı veya şifre hatalı" });
  }

  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) {
    await writeLog({ ...req, user }, "Başarısız giriş", username);
    return res.status(401).json({ error: "Kullanıcı adı veya şifre hatalı" });
  }

  const token = signToken(user);
  setAuthCookie(res, token);
  req.user = user;
  await writeLog(req, "Giriş", `${user.full_name} oturum açtı`);

  res.json({ user: publicUser(user) });
});

router.post("/logout", authRequired, async (req, res) => {
  await writeLog(req, "Çıkış", "Oturum kapatıldı");
  clearAuthCookie(res);
  res.json({ ok: true });
});

router.get("/me", authRequired, async (req, res) => {
  const u = req.user;
  let days = 0;
  if (u.start_date) {
    const start = new Date(u.start_date);
    if (!Number.isNaN(start.getTime())) {
      const now = new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/Istanbul" }));
      days = Math.max(0, Math.floor((now - start) / (24 * 60 * 60 * 1000)) + 1);
    }
  }
  // Oturumu uzat (her /me çağrısında cookie yenile)
  setAuthCookie(res, signToken(u));
  const { rows } = await query(
    `SELECT webauthn_cred_id FROM users WHERE id=$1`,
    [u.id]
  );
  res.json({
    user: {
      ...u,
      days_worked: days,
      has_webauthn: Boolean(rows[0]?.webauthn_cred_id),
    },
  });
});

router.get("/vapid", (_req, res) => {
  res.json({ publicKey: config.vapidPublic });
});

router.post("/webauthn/register/options", authRequired, async (req, res) => {
  try {
    const { rows } = await query(`SELECT * FROM users WHERE id=$1`, [req.user.id]);
    const user = rows[0];
    if (user.webauthn_cred_id) {
      return res.status(400).json({ error: "Zaten bir parmak izi kayıtlı. Önce silin." });
    }
    const options = await regOptions(req, user);
    res.json(options);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message || "Seçenekler alınamadı" });
  }
});

router.post("/webauthn/register/verify", authRequired, async (req, res) => {
  try {
    const { rows } = await query(`SELECT * FROM users WHERE id=$1`, [req.user.id]);
    const user = rows[0];
    if (user.webauthn_cred_id) {
      return res.status(400).json({ error: "Zaten bir parmak izi kayıtlı. Önce silin." });
    }
    const info = await regVerify(req, user, req.body);
    await query(
      `UPDATE users SET webauthn_cred_id=$2, webauthn_public_key=$3, webauthn_counter=$4, updated_at=NOW()
       WHERE id=$1`,
      [user.id, info.credId, info.publicKey, info.counter]
    );
    await writeLog(req, "Parmak izi eklendi", user.username);
    res.json({ ok: true, has_webauthn: true, credId: info.credId });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message || "Kayıt başarısız" });
  }
});

router.delete("/webauthn", authRequired, async (req, res) => {
  await query(
    `UPDATE users SET webauthn_cred_id=NULL, webauthn_public_key=NULL, webauthn_counter=0, updated_at=NOW()
     WHERE id=$1`,
    [req.user.id]
  );
  await writeLog(req, "Parmak izi silindi", req.user.username);
  res.json({ ok: true, has_webauthn: false });
});

router.post("/webauthn/login/options", async (req, res) => {
  try {
    const credId = String(req.body?.credId || "").trim();
    const username = String(req.body?.username || "").trim();
    let user = null;
    if (credId) {
      const { rows } = await query(`SELECT * FROM users WHERE webauthn_cred_id=$1 AND active=TRUE`, [
        credId,
      ]);
      user = rows[0];
    } else if (username) {
      const { rows } = await query(
        `SELECT * FROM users WHERE LOWER(username)=LOWER($1) AND active=TRUE`,
        [username]
      );
      user = rows[0];
    }
    if (!user?.webauthn_cred_id) {
      return res.status(400).json({ error: "Bu hesap için parmak izi yok" });
    }
    const options = await authOptions(req, user);
    res.json({ ...options, userId: user.id });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message || "Seçenekler alınamadı" });
  }
});

router.post("/webauthn/login/verify", async (req, res) => {
  try {
    const userId = String(req.body?.userId || "").trim();
    const response = req.body?.response;
    if (!userId || !response) return res.status(400).json({ error: "Eksik veri" });
    const { rows } = await query(`SELECT * FROM users WHERE id=$1 AND active=TRUE`, [userId]);
    const user = rows[0];
    if (!user) return res.status(401).json({ error: "Kullanıcı bulunamadı" });
    const newCounter = await authVerify(req, user, response);
    await query(`UPDATE users SET webauthn_counter=$2, updated_at=NOW() WHERE id=$1`, [
      user.id,
      newCounter,
    ]);
    const token = signToken(user);
    setAuthCookie(res, token);
    req.user = user;
    await writeLog(req, "Biyometrik giriş", user.full_name);
    res.json({ user: publicUser(user) });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message || "Giriş başarısız" });
  }
});

export default router;
