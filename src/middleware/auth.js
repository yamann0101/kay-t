import jwt from "jsonwebtoken";
import { config } from "../config.js";
import { query } from "../db/pool.js";

export function signToken(user) {
  return jwt.sign(
    { id: user.id, role: user.role, username: user.username },
    config.jwtSecret,
    { expiresIn: "12h" }
  );
}

export function setAuthCookie(res, token) {
  res.cookie(config.cookieName, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: config.isProd,
    maxAge: 12 * 60 * 60 * 1000,
    path: "/",
  });
}

export function clearAuthCookie(res) {
  res.clearCookie(config.cookieName, { path: "/" });
}

export async function authRequired(req, res, next) {
  const token = req.cookies?.[config.cookieName];
  if (!token) return res.status(401).json({ error: "Oturum gerekli" });
  try {
    const payload = jwt.verify(token, config.jwtSecret);
    const { rows } = await query(
      "SELECT u.id, u.username, u.full_name, u.role, u.phone, u.active, u.gender, u.armed, u.id_no, u.photo_url, u.shoe_size, u.pants_size, u.shirt_size, u.coat_size, u.sweater_size, u.start_date, u.chat_manager, u.blood_type, u.marital_status, u.title_id, t.name AS title_name FROM users u LEFT JOIN job_titles t ON t.id = u.title_id WHERE u.id = $1",
      [payload.id]
    );
    if (!rows[0] || !rows[0].active) {
      return res.status(401).json({ error: "Hesap geçersiz" });
    }
    req.user = rows[0];
    next();
  } catch {
    return res.status(401).json({ error: "Oturum süresi doldu" });
  }
}

export function adminRequired(req, res, next) {
  if (!req.user || req.user.role !== "admin") {
    return res.status(403).json({ error: "Yönetici yetkisi gerekli" });
  }
  next();
}

export async function writeLog(req, action, detail) {
  try {
    await query(
      "INSERT INTO activity_logs (user_id, action, detail, ip) VALUES ($1,$2,$3,$4)",
      [req.user?.id || null, action, detail || null, req.ip]
    );
  } catch {
    /* ignore log errors */
  }
}
