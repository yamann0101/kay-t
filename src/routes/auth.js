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

const router = Router();

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

  res.json({
    user: {
      id: user.id,
      username: user.username,
      full_name: user.full_name,
      role: user.role,
      phone: user.phone,
    },
  });
});

router.post("/logout", authRequired, async (req, res) => {
  await writeLog(req, "Çıkış", "Oturum kapatıldı");
  clearAuthCookie(res);
  res.json({ ok: true });
});

router.get("/me", authRequired, (req, res) => {
  res.json({ user: req.user });
});

router.get("/vapid", (_req, res) => {
  res.json({ publicKey: config.vapidPublic });
});

export default router;
