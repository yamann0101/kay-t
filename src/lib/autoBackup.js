import fs from "node:fs";
import path from "node:path";
import { query } from "../db/pool.js";
import { trParts } from "./trTime.js";

const BACKUP_DIR = path.resolve(process.cwd(), ".data", "backups");
const MAX_KEEP = 4;

const BACKUP_TABLES = [
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
  "contact_sections",
  "settings",
  "site_notes",
  "chat_messages",
  "custom_reminders",
  "job_titles",
];

function ensureDir() {
  if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

export async function buildBackupPayload() {
  const data = { exported_at: new Date().toISOString(), tables: {} };
  for (const t of BACKUP_TABLES) {
    try {
      const { rows } = await query(`SELECT * FROM ${t}`);
      if (t === "users") {
        data.tables[t] = rows.map(({ password_hash, webauthn_public_key, ...rest }) => rest);
      } else {
        data.tables[t] = rows;
      }
    } catch {
      data.tables[t] = [];
    }
  }
  return data;
}

export async function createAutoBackup(reason = "weekly") {
  ensureDir();
  const data = await buildBackupPayload();
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const file = path.join(BACKUP_DIR, `s360-${reason}-${stamp}.json`);
  fs.writeFileSync(file, JSON.stringify(data, null, 2), "utf8");
  pruneOldBackups();
  return { file: path.basename(file), at: data.exported_at };
}

function pruneOldBackups() {
  ensureDir();
  const files = fs
    .readdirSync(BACKUP_DIR)
    .filter((f) => f.endsWith(".json"))
    .map((f) => ({ f, t: fs.statSync(path.join(BACKUP_DIR, f)).mtimeMs }))
    .sort((a, b) => b.t - a.t);
  for (const old of files.slice(MAX_KEEP)) {
    try {
      fs.unlinkSync(path.join(BACKUP_DIR, old.f));
    } catch {
      /* ignore */
    }
  }
}

export function listAutoBackups() {
  ensureDir();
  return fs
    .readdirSync(BACKUP_DIR)
    .filter((f) => f.endsWith(".json"))
    .map((f) => {
      const st = fs.statSync(path.join(BACKUP_DIR, f));
      return { name: f, size: st.size, mtime: st.mtime.toISOString() };
    })
    .sort((a, b) => String(b.mtime).localeCompare(String(a.mtime)))
    .slice(0, MAX_KEEP);
}

export function readAutoBackup(name) {
  const safe = path.basename(String(name || ""));
  if (!safe.endsWith(".json")) throw new Error("Geçersiz yedek");
  const full = path.join(BACKUP_DIR, safe);
  if (!fs.existsSync(full)) throw new Error("Yedek bulunamadı");
  return JSON.parse(fs.readFileSync(full, "utf8"));
}

/** Cuma 12:00 (Europe/Istanbul) — dakikada bir kontrol */
export function startWeeklyBackupScheduler() {
  let lastKey = "";
  const tick = async () => {
    try {
      const p = trParts();
      // Cuma = 5
      if (p.weekday !== 5) return;
      if (p.hour !== "12" || p.minute !== "00") return;
      const key = `${p.y}-${p.m}-${p.day}`;
      if (lastKey === key) return;
      lastKey = key;
      const r = await createAutoBackup("weekly");
      console.log(`  Otomatik yedek alındı → ${r.file}`);
    } catch (err) {
      console.warn("  Otomatik yedek hatası:", err?.message || err);
    }
  };
  tick();
  return setInterval(tick, 30_000);
}
