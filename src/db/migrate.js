import bcrypt from "bcryptjs";
import { config } from "../config.js";
import { query, exec } from "./pool.js";
import { DEFAULT_VISITOR_FIELDS } from "../lib/visitorFields.js";
import { backfillVisitorPeople } from "../lib/visitors.js";
import { DEFAULT_COPY, DEFAULT_SHIFT } from "../lib/appSettings.js";

/** Şema sürümü: her yapısal değişiklikte artır. Seed tekrarlanmaz. */
export const SCHEMA_VERSION = 4;

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
     ('A-02', 'Depo Kapısı', 'B Blok', 'available'),
     ('A-03', 'Jeneratör Odası', 'Teknik Mahal', 'taken'),
     ('B-12', 'Çatı Girişi', 'Çatı', 'available')`
  );

  await query(`UPDATE keys SET holder_id = $1 WHERE code = 'A-03'`, [guardId]);

  await query(
    `INSERT INTO movements (direction, person_name, category, created_by, created_at) VALUES
     ('giris', 'Ahmet Kaya', 'Ziyaretçi', $1, NOW() - INTERVAL '13 minutes'),
     ('cikis', 'Mehmet Demir', 'Personel', $1, NOW() - INTERVAL '18 minutes'),
     ('giris', '34 ABC 123', 'Tedarikçi', $1, NOW() - INTERVAL '31 minutes'),
     ('cikis', 'Elif Yıldız', 'Ziyaretçi', $1, NOW() - INTERVAL '41 minutes'),
     ('giris', 'Can Özkan', 'Personel', $1, NOW() - INTERVAL '56 minutes')`,
    [guardId]
  );

  await query(
    `INSERT INTO visitors (full_name, company, host, category, entered_at, created_by) VALUES
     ('Ahmet Kaya', 'Kaya İnşaat', 'İdari İşler', 'Ziyaretçi', NOW() - INTERVAL '13 minutes', $1),
     ('Elif Yıldız', 'Nova Lojistik', 'Satın Alma', 'Ziyaretçi', NOW() - INTERVAL '2 hours', $1)`,
    [guardId]
  );

  await query(
    `INSERT INTO meetings (title, visitor) VALUES
     ('İdari görüşme', 'Ahmet Kaya'),
     ('Tedarikçi teslim', '34 ABC 123'),
     ('Personel brifing', NULL),
     ('Güvenlik toplantısı', NULL)`
  );

  await query(
    `INSERT INTO shipments (title, status) VALUES
     ('Kargo — Yurtiçi', 'open'),
     ('Tedarikçi sevkiyat', 'open'),
     ('Evrak kurye', 'closed')`
  );

  await query(
    `INSERT INTO announcements (title, body, created_by) VALUES
     ('Gece vardiyası', 'Gece vardiyasında depo kapısı kilitli tutulacak.', $1),
     ('Yangın tatbikatı', 'Cuma 14:00 yangın tatbikatı yapılacaktır.', $1)`,
    [adminId]
  );

  await query(
    `INSERT INTO patrols (name, checkpoint, status) VALUES
     ('Çevre 1', 'Ana Giriş', 'pending'),
     ('Çevre 2', 'Otopark', 'pending'),
     ('İç hat', 'B Blok koridor', 'done'),
     ('Çatı', 'Çatı kapısı', 'pending')`
  );

  await query(
    `INSERT INTO contacts (name, title, phone, unit) VALUES
     ('Erhan YAMAN', 'Görevli Güvenlik', '0555 111 22 33', 'Saha'),
     ('Sistem Yöneticisi', 'Yönetici', '0555 000 00 01', 'Merkez'),
     ('İtfaiye', 'Acil', '110', 'Acil'),
     ('Polis', 'Acil', '155', 'Acil'),
     ('Ambulans', 'Acil', '112', 'Acil')`
  );

  await query(
    `INSERT INTO activity_logs (user_id, action, detail) VALUES
     ($1, 'Sistem kuruldu', 'İlk kurulum ve örnek veriler oluşturuldu'),
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
  const extraPeople = [
    ["Ahmet Kara", "Proje Müdürü", "0555 200 00 01", "Yönetim"],
    ["Selin Aydın", "İdari İşler", "0555 200 00 02", "Yönetim"],
    ["Mehmet Demir", "Vardiya Amiri", "0555 300 00 01", "Güvenlik"],
    ["Can Özkan", "Teknik Sorumlu", "0555 400 00 01", "Teknik"],
    ["Fatma Kılıç", "Temizlik Amiri", "0555 500 00 01", "Temizlik"],
    ["Kaya İnşaat", "Taşeron Yetkili", "0555 600 00 01", "Taşeron"],
    ["ABC Lojistik", "Sevkiyat Sorumlusu", "0555 700 00 01", "Tedarikçi"],
    ["Site Kuralları", "Talimat / Form", "", "Bilgi"],
  ];
  for (const row of extraPeople) {
    const found = await query(`SELECT 1 FROM contacts WHERE name = $1`, [row[0]]);
    if (!found.rows.length) {
      await query(`INSERT INTO contacts (name, title, phone, unit) VALUES ($1,$2,$3,$4)`, row);
    }
  }
  const sectionSeed = [
    ["Üretim", 1],
    ["Ofisler", 2],
    ["Sistem", 3],
    ["Depo", 4],
    ["Elektrik", 5],
    ["Teknik Alan", 6],
    ["Araç", 7],
    ["Diğer", 8],
  ];
  for (const [name, order] of sectionSeed) {
    await query(
      `INSERT INTO key_sections (name, sort_order) VALUES ($1,$2) ON CONFLICT (name) DO NOTHING`,
      [name, order]
    );
  }
  const { rows: secs } = await query(`SELECT id, name FROM key_sections`);
  const byName = Object.fromEntries(secs.map((s) => [s.name, s.id]));
  await query(`UPDATE keys SET section_id = $1 WHERE section_id IS NULL AND (location ILIKE '%depo%' OR name ILIKE '%depo%')`, [byName["Depo"] || null]);
  await query(`UPDATE keys SET section_id = $1 WHERE section_id IS NULL AND (name ILIKE '%jeneratör%' OR name ILIKE '%teknik%' OR location ILIKE '%teknik%')`, [byName["Teknik Alan"] || null]);
  await query(`UPDATE keys SET section_id = $1 WHERE section_id IS NULL AND name ILIKE '%çatı%'`, [byName["Diğer"] || null]);
  await query(`UPDATE keys SET section_id = $1 WHERE section_id IS NULL`, [byName["Ofisler"] || byName["Diğer"] || null]);
  const extraKeys = [
    ["Ü-1", "Üretim Alanı - Ana Giriş", "Üretim", "available", true],
    ["Ü-2", "Üretim - Yan Kapı", "Üretim", "taken", false],
    ["Ü-3", "Montaj Hattı", "Üretim", "available", false],
    ["O-1", "Yönetim Ofisi", "Ofisler", "available", true],
    ["O-2", "Muhasebe", "Ofisler", "taken", false],
    ["S-1", "Sunucu Odası", "Sistem", "available", true],
    ["S-2", "Kamera Odası", "Sistem", "available", false],
    ["D-1", "Ana Depo", "Depo", "taken", false],
    ["E-1", "Elektrik Panosu", "Elektrik", "available", false],
    ["T-1", "Teknik Mahal", "Teknik Alan", "lost", false],
    ["AR-1", "Servis Aracı", "Araç", "available", false],
  ];
  for (const [code, name, section, status, pinned] of extraKeys) {
    await query(
      `INSERT INTO keys (code, name, location, status, section_id, pinned)
       VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (code) DO NOTHING`,
      [code, name, section, status, byName[section] || null, pinned]
    );
  }
  await query(`UPDATE keys SET pinned = TRUE WHERE code IN ('A-01','Ü-1','O-1','S-1')`);

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
  `);

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
