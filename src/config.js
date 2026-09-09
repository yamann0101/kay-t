import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import dotenv from "dotenv";
import webpush from "web-push";

dotenv.config();

const DATA_DIR = path.resolve(process.cwd(), ".data");
const SECRET_FILE = path.join(DATA_DIR, "secrets.json");

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function loadOrCreateSecrets() {
  ensureDataDir();
  let stored = {};
  if (fs.existsSync(SECRET_FILE)) {
    try {
      stored = JSON.parse(fs.readFileSync(SECRET_FILE, "utf8"));
    } catch {
      stored = {};
    }
  }

  if (!stored.jwtSecret) stored.jwtSecret = crypto.randomBytes(48).toString("hex");
  if (!stored.vapidPublic || !stored.vapidPrivate) {
    const keys = webpush.generateVAPIDKeys();
    stored.vapidPublic = keys.publicKey;
    stored.vapidPrivate = keys.privateKey;
  }

  fs.writeFileSync(SECRET_FILE, JSON.stringify(stored, null, 2));
  return stored;
}

const secrets = loadOrCreateSecrets();

export const config = {
  port: Number(process.env.PORT || 3600),
  databaseUrl: process.env.DATABASE_URL || "",
  jwtSecret: process.env.JWT_SECRET || secrets.jwtSecret,
  vapidPublic: process.env.VAPID_PUBLIC_KEY || secrets.vapidPublic,
  vapidPrivate: process.env.VAPID_PRIVATE_KEY || secrets.vapidPrivate,
  vapidSubject: process.env.VAPID_SUBJECT || "mailto:admin@s360.local",
  adminUser: process.env.ADMIN_USER || "admin",
  adminPass: process.env.ADMIN_PASS || "Admin123!",
  cookieName: "s360_token",
  isProd: process.env.NODE_ENV === "production",
};

webpush.setVapidDetails(config.vapidSubject, config.vapidPublic, config.vapidPrivate);
