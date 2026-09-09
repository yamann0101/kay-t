import bcrypt from "bcryptjs";
import { config } from "../config.js";
import { query, exec } from "./pool.js";
import { DEFAULT_VISITOR_FIELDS } from "../lib/visitorFields.js";
import { backfillVisitorPeople } from "../lib/visitors.js";
import { DEFAULT_COPY, DEFAULT_SHIFT } from "../lib/appSettings.js";

/** Şema sürümü: her yapısal değişiklikte artır. Seed tekrarlanmaz. */
export const SCHEMA_VERSION = 10;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username      TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  full_name     TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'guard' CHECK (role IN ('admin','supervisor','guard')),
  phone         TEXT,
  active        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS keys (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code        TEXT UNIQUE NOT NULL,
  name        TEXT NOT NULL,
  location    TEXT,
  holder_id   UUID REFERENCES users(id) ON DELETE SET NULL,
  status      TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available','taken','lost')),
  notes       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS key_logs (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key_id     UUID REFERENCES keys(id) ON DELETE CASCADE,
  user_id    UUID REFERENCES users(id) ON DELETE SET NULL,
  action     TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS visitors (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name   TEXT NOT NULL,
  company     TEXT,
  host        TEXT,
  phone       TEXT,
  plate       TEXT,
  category    TEXT NOT NULL DEFAULT 'Ziyaretçi',
  entered_at  TIMESTAMPTZ,
  exited_at   TIMESTAMPTZ,
  created_by  UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS movements (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  direction   TEXT NOT NULL CHECK (direction IN ('giris','cikis')),
  person_name TEXT NOT NULL,
  category    TEXT NOT NULL DEFAULT 'Personel',
  plate       TEXT,
  created_by  UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS announcements (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title       TEXT NOT NULL,
  body        TEXT NOT NULL,
  created_by  UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS patrols (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  checkpoint  TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'pending',
  checked_by  UUID REFERENCES users(id) ON DELETE SET NULL,
  checked_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS shipments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title       TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'open',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS meetings (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title       TEXT NOT NULL,
  visitor     TEXT,
  status      TEXT NOT NULL DEFAULT 'active',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS activity_logs (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID REFERENCES users(id) ON DELETE SET NULL,
  action     TEXT NOT NULL,
  detail     TEXT,
  ip         TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notifications (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title      TEXT NOT NULL,
  body       TEXT NOT NULL,
  type       TEXT NOT NULL DEFAULT 'info',
  read       BOOLEAN NOT NULL DEFAULT FALSE,
  user_id    UUID REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID REFERENCES users(id) ON DELETE CASCADE,
  endpoint   TEXT UNIQUE NOT NULL,
  p256dh     TEXT NOT NULL,
  auth       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS contacts (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  title      TEXT,
  phone      TEXT,
  unit       TEXT
);

CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_movements_created ON movements(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_logs_created ON activity_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_visitors_created ON visitors(created_at DESC);
`;

async function seedIfEmpty() {
  const { rows } = await query("SELECT COUNT(*)::int AS n FROM users");
  if (rows[0].n > 0) return { seeded: false };

  const adminHash = await bcrypt.hash(config.adminPass, 10);
  const guardHash = await bcrypt.hash("123456", 10);

  const admin = await query(
    `INSERT INTO users (username, password_hash, full_name, role, phone)
     VALUES ($1, $2, $3, 'admin', $4) RETURNING id`,
    [config.adminUser, adminHash, "Sistem Yöneticisi", "0555 000 00 01"]
  );

  const guard = await query(
    `INSERT INTO users (username, password_hash, full_name, role, phone)
     VALUES ($1, $2, $3, 'guard', $4) RETURNING id`,
    ["erhan", guardHash, "Erhan YAMAN", "0555 111 22 33"]
  );

  const adminId = admin.rows[0].id;
  const guardId = guard.rows[0].id;

  await query(
    `INSERT INTO keys (code, name, location, status) VALUES
     ('A-01', 'Ana Giriş', 'Turnike 1', 'available'),
     ('A-02', 'Depo Kapısı', 'B Blok', 'available')`
  );

  await query(`UPDATE keys SET holder_id = NULL`);

  // Örnek ziyaretçi / hareket eklenmez — sayaçlar boş başlar
  await query(
    `INSERT INTO announcements (title, body, created_by) VALUES
     ('Gece vardiyası', 'Gece vardiyasında depo kapısı kilitli tutulacak.', $1)`,
    [adminId]
  );

  await query(
    `INSERT INTO contacts (name, title, phone, unit) VALUES
     ('Erhan YAMAN', 'Görevli Güvenlik', '0555 111 22 33', 'Saha'),
     ('Sistem Yöneticisi', 'Yönetici', '0555 000 00 01', 'Merkez')`
  );

  await query(
    `INSERT INTO activity_logs (user_id, action, detail) VALUES
     ($1, 'Sistem kuruldu', 'İlk kurulum tamamlandı'),
     ($2, 'Giriş', 'Saha görevlisi hesabı hazır')`,
    [adminId, guardId]
  );

  await query(
    `INSERT INTO notifications (title, body, type, user_id) VALUES
     ('Hoş geldiniz', 'S-360 sistemine başarıyla giriş yapabilirsiniz.', 'info', $1)`,
    [guardId]
  );

  return { seeded: true };
}

export async function migrate() {
  try {
    await query("SELECT gen_random_uuid()");
  } catch {
    await exec(`
      CREATE OR REPLACE FUNCTION gen_random_uuid() RETURNS uuid AS $$
        SELECT uuid_in(
          overlay(overlay(md5(random()::text || clock_timestamp()::text) placing '4' from 13)
          placing to_hex(floor(random()*4+8)::int)::text from 17)::cstring
        );
      $$ LANGUAGE SQL;
    `);
  }
  await exec(SCHEMA);
  await exec(`
    ALTER TABLE visitors ADD COLUMN IF NOT EXISTS first_name TEXT;
    ALTER TABLE visitors ADD COLUMN IF NOT EXISTS last_name TEXT;
    ALTER TABLE visitors ADD COLUMN IF NOT EXISTS visit_type TEXT;
    ALTER TABLE visitors ADD COLUMN IF NOT EXISTS notes TEXT;
    ALTER TABLE visitors ADD COLUMN IF NOT EXISTS visit_date TEXT;
    ALTER TABLE visitors ADD COLUMN IF NOT EXISTS entry_time TEXT;
    ALTER TABLE visitors ADD COLUMN IF NOT EXISTS exit_time TEXT;
    ALTER TABLE visitors ADD COLUMN IF NOT EXISTS exited BOOLEAN DEFAULT FALSE;
    ALTER TABLE visitors ADD COLUMN IF NOT EXISTS record_no TEXT;
    ALTER TABLE visitors ADD COLUMN IF NOT EXISTS entry_type TEXT;
    ALTER TABLE visitors ADD COLUMN IF NOT EXISTS vehicle_status TEXT;
    ALTER TABLE visitors ADD COLUMN IF NOT EXISTS extra TEXT;
    ALTER TABLE visitors ADD COLUMN IF NOT EXISTS search_key TEXT;
  `);
  await exec(`
    CREATE TABLE IF NOT EXISTS visitor_people (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name_key TEXT UNIQUE NOT NULL,
      first_name TEXT,
      last_name TEXT,
      full_name TEXT NOT NULL,
      company TEXT,
      plate TEXT,
      phone TEXT,
      visit_count INT NOT NULL DEFAULT 0,
      first_visit_at TIMESTAMPTZ,
      last_visit_at TIMESTAMPTZ,
      first_visit_date TEXT,
      last_visit_date TEXT,
      last_entry_type TEXT,
      last_visit_type TEXT,
      last_visit_id UUID,
      visit_dates TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    ALTER TABLE visitors ADD COLUMN IF NOT EXISTS person_id UUID;
    CREATE INDEX IF NOT EXISTS idx_visitors_person ON visitors(person_id);
    CREATE INDEX IF NOT EXISTS idx_visitor_people_last ON visitor_people(last_visit_at DESC);
    ALTER TABLE keys ADD COLUMN IF NOT EXISTS notify_time TEXT;
    ALTER TABLE keys ADD COLUMN IF NOT EXISTS notify_at TIMESTAMPTZ;
    ALTER TABLE keys ADD COLUMN IF NOT EXISTS holder_first_name TEXT;
    ALTER TABLE keys ADD COLUMN IF NOT EXISTS holder_last_name TEXT;
    ALTER TABLE keys ADD COLUMN IF NOT EXISTS holder_company TEXT;
    ALTER TABLE keys ADD COLUMN IF NOT EXISTS taken_at TIMESTAMPTZ;
    ALTER TABLE keys ADD COLUMN IF NOT EXISTS returned_at TIMESTAMPTZ;
    ALTER TABLE key_logs ADD COLUMN IF NOT EXISTS detail TEXT;
    CREATE TABLE IF NOT EXISTS visitor_alerts (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      full_name TEXT NOT NULL,
      name_key TEXT NOT NULL,
      company TEXT,
      company_key TEXT,
      visit_date TEXT,
      visit_time TEXT,
      notes TEXT,
      active BOOLEAN NOT NULL DEFAULT TRUE,
      matched_at TIMESTAMPTZ,
      matched_visitor_id UUID,
      created_by UUID REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_visitor_alerts_name ON visitor_alerts(name_key);
    CREATE INDEX IF NOT EXISTS idx_visitors_search ON visitors(search_key);
    CREATE INDEX IF NOT EXISTS idx_keys_notify ON keys(notify_at);
  `);
  await backfillVisitorPeople();
  await exec(`
    CREATE TABLE IF NOT EXISTS key_sections (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT UNIQUE NOT NULL,
      sort_order INT NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    ALTER TABLE keys ADD COLUMN IF NOT EXISTS section_id UUID REFERENCES key_sections(id) ON DELETE SET NULL;
    ALTER TABLE keys ADD COLUMN IF NOT EXISTS pinned BOOLEAN NOT NULL DEFAULT FALSE;
    CREATE TABLE IF NOT EXISTS key_favorites (
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      key_id UUID NOT NULL REFERENCES keys(id) ON DELETE CASCADE,
      PRIMARY KEY (user_id, key_id)
    );
  `);
  await query(
    `INSERT INTO settings (key, value) VALUES ('default_visitor_type', 'sevkiyat')
     ON CONFLICT (key) DO NOTHING`
  );
  await query(
    `INSERT INTO settings (key, value) VALUES ('visitor_fields', $1)
     ON CONFLICT (key) DO NOTHING`,
    [JSON.stringify(DEFAULT_VISITOR_FIELDS)]
  );
  await query(
    `INSERT INTO settings (key, value) VALUES ('shift_reminders', $1)
     ON CONFLICT (key) DO NOTHING`,
    [JSON.stringify(DEFAULT_SHIFT)]
  );
  await query(
    `INSERT INTO settings (key, value) VALUES ('copy_templates', $1)
     ON CONFLICT (key) DO NOTHING`,
    [JSON.stringify(DEFAULT_COPY)]
  );
  const extraPeople = [];
  for (const row of extraPeople) {
    const found = await query(`SELECT 1 FROM contacts WHERE name = $1`, [row[0]]);
    if (!found.rows.length) {
      await query(`INSERT INTO contacts (name, title, phone, unit) VALUES ($1,$2,$3,$4)`, row);
    }
  }
  // v9: fazla örnek rehber / anahtar temizliği — yalnızca bir kez
  const cleanupFlag = await query(`SELECT value FROM settings WHERE key='seed_cleanup_v9'`);
  if (cleanupFlag.rows[0]?.value !== "1") {
    await query(
      `DELETE FROM contacts WHERE name NOT IN ('Erhan YAMAN', 'Sistem Yöneticisi')`
    );
    await query(`DELETE FROM keys WHERE code NOT IN ('A-01', 'A-02')`);
    await query(
      `DELETE FROM key_sections WHERE name NOT IN ('Ofisler', 'Depo', 'Diğer')
       AND NOT EXISTS (SELECT 1 FROM keys k WHERE k.section_id = key_sections.id)`
    );
    await query(
      `INSERT INTO settings (key, value) VALUES ('seed_cleanup_v9', '1')
       ON CONFLICT (key) DO UPDATE SET value = '1'`
    );
  }
  const sectionSeed = [
    ["Ofisler", 1],
    ["Depo", 2],
    ["Diğer", 3],
  ];
  for (const [name, order] of sectionSeed) {
    await query(
      `INSERT INTO key_sections (name, sort_order) VALUES ($1,$2) ON CONFLICT (name) DO NOTHING`,
      [name, order]
    );
  }
  const { rows: secs } = await query(`SELECT id, name FROM key_sections`);
  const byName = Object.fromEntries(secs.map((s) => [s.name, s.id]));
  await query(`UPDATE keys SET section_id = $1 WHERE code = 'A-01'`, [byName["Ofisler"] || null]);
  await query(`UPDATE keys SET section_id = $1 WHERE code = 'A-02'`, [byName["Depo"] || null]);
  await query(`UPDATE keys SET pinned = TRUE WHERE code = 'A-01'`);
  const extraKeys = [];
  for (const [code, name, section, status, pinned] of extraKeys) {
    await query(
      `INSERT INTO keys (code, name, location, status, section_id, pinned)
       VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (code) DO NOTHING`,
      [code, name, section, status, byName[section] || null, pinned]
    );
  }

  await exec(`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS gender TEXT;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS armed TEXT;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS id_no TEXT;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS photo_url TEXT;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS shoe_size TEXT;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS pants_size TEXT;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS shirt_size TEXT;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS coat_size TEXT;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS sweater_size TEXT;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS start_date DATE;
    CREATE TABLE IF NOT EXISTS chat_messages (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID REFERENCES users(id) ON DELETE SET NULL,
      body TEXT NOT NULL,
      reply_to UUID REFERENCES chat_messages(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_chat_created ON chat_messages(created_at DESC);
    CREATE TABLE IF NOT EXISTS site_notes (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      kind TEXT NOT NULL DEFAULT 'note' CHECK (kind IN ('note','cargo')),
      title TEXT NOT NULL,
      body TEXT,
      created_by UUID REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_site_notes_created ON site_notes(created_at DESC);
    ALTER TABLE visitor_alerts ADD COLUMN IF NOT EXISTS will_enter BOOLEAN NOT NULL DEFAULT TRUE;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS chat_manager BOOLEAN NOT NULL DEFAULT FALSE;
    ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
    ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES users(id) ON DELETE SET NULL;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS blood_type TEXT;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS marital_status TEXT;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS title_id UUID;
    ALTER TABLE site_notes ADD COLUMN IF NOT EXISTS photo_url TEXT;
    ALTER TABLE visitor_alerts ADD COLUMN IF NOT EXISTS first_name TEXT;
    ALTER TABLE visitor_alerts ADD COLUMN IF NOT EXISTS last_name TEXT;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS webauthn_cred_id TEXT;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS webauthn_public_key TEXT;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS webauthn_counter INT NOT NULL DEFAULT 0;
    ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
    ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('admin','supervisor','guard','viewer'));
    CREATE TABLE IF NOT EXISTS job_titles (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT UNIQUE NOT NULL,
      sort_order INT NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS custom_reminders (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      title TEXT NOT NULL,
      body TEXT,
      start_time TEXT NOT NULL,
      end_time TEXT,
      interval_min INT NOT NULL DEFAULT 120,
      days TEXT NOT NULL DEFAULT 'everyday',
      active BOOLEAN NOT NULL DEFAULT TRUE,
      last_sent_key TEXT,
      created_by UUID REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS chat_reads (
      message_id UUID NOT NULL REFERENCES chat_messages(id) ON DELETE CASCADE,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      read_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (message_id, user_id)
    );
    CREATE INDEX IF NOT EXISTS idx_chat_reads_user ON chat_reads(user_id, read_at DESC);
    ALTER TABLE movements ADD COLUMN IF NOT EXISTS visitor_id UUID REFERENCES visitors(id) ON DELETE CASCADE;
    CREATE INDEX IF NOT EXISTS idx_movements_visitor ON movements(visitor_id);
  `);

  // v10: örnek ziyaretçi/hareket temizliği + yetim hareketler (sayaç ziyaretçiden)
  const cleanupV10 = await query(`SELECT value FROM settings WHERE key='seed_cleanup_v10'`);
  if (cleanupV10.rows[0]?.value !== "1") {
    await query(
      `DELETE FROM visitors
       WHERE full_name ILIKE 'Ahmet Kaya'
          OR company ILIKE 'Kaya İnşaat%'
          OR host ILIKE 'İdari İşler'`
    );
    await query(
      `DELETE FROM movements
       WHERE person_name ILIKE 'Ahmet Kaya'
          OR person_name ILIKE 'Mehmet Demir'
          OR visitor_id IS NULL`
    );
    await query(
      `DELETE FROM visitor_people p
       WHERE NOT EXISTS (SELECT 1 FROM visitors v WHERE v.person_id = p.id)
          OR full_name ILIKE 'Ahmet Kaya'`
    );
    await query(`DELETE FROM meetings WHERE visitor ILIKE 'Ahmet Kaya' OR title ILIKE 'İdari görüşme' OR title ILIKE 'Güvenlik toplantısı'`);
    await query(`DELETE FROM shipments WHERE title ILIKE 'Kargo — Yurtiçi' OR title ILIKE 'Evrak kurye'`);
    await query(`DELETE FROM patrols WHERE name IN ('Çevre 1', 'İç hat')`);
    await query(
      `INSERT INTO settings (key, value) VALUES ('seed_cleanup_v10', '1')
       ON CONFLICT (key) DO UPDATE SET value = '1'`
    );
  }

  await query(
    `INSERT INTO job_titles (name, sort_order) VALUES
      ('Güvenlik Amiri', 1),
      ('Yetkili', 2),
      ('Ofis Personeli', 3),
      ('Özel Güvenlik', 4),
      ('Personel', 5)
     ON CONFLICT (name) DO NOTHING`
  );

  const result = await seedIfEmpty();
  await backfillVisitorPeople();
  await query(
    `INSERT INTO settings (key, value) VALUES ('schema_version', $1)
     ON CONFLICT (key) DO UPDATE SET value = $1`,
    [String(SCHEMA_VERSION)]
  );
  await query(
    `INSERT INTO settings (key, value) VALUES ('app_installed', '1')
     ON CONFLICT (key) DO UPDATE SET value = '1'`
  );
  return { ...result, schemaVersion: SCHEMA_VERSION };
}
