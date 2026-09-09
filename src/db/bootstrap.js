import { migrate, SCHEMA_VERSION } from "./migrate.js";
import { query } from "./pool.js";

/**
 * İlk açılışta kurulum (tablolar + seed), sonraki açılışlarda sadece şema güncellemesi.
 * Veriler silinmez; seed yalnızca boş veritabanında bir kez çalışır.
 */
export async function bootstrapDatabase() {
  const before = await readMeta();
  const result = await migrate();
  const after = await readMeta();

  const firstInstall = !before.installed || result.seeded;
  const updated =
    before.schemaVersion !== after.schemaVersion && before.installed;

  if (firstInstall) {
    await query(
      `INSERT INTO settings (key, value) VALUES ('app_installed', '1')
       ON CONFLICT (key) DO UPDATE SET value = '1'`
    );
    await query(
      `INSERT INTO settings (key, value) VALUES ('schema_version', $1)
       ON CONFLICT (key) DO UPDATE SET value = $1`,
      [String(SCHEMA_VERSION)]
    );
    return {
      mode: "install",
      seeded: result.seeded,
      schemaVersion: SCHEMA_VERSION,
    };
  }

  if (updated || after.schemaVersion !== String(SCHEMA_VERSION)) {
    await query(
      `INSERT INTO settings (key, value) VALUES ('schema_version', $1)
       ON CONFLICT (key) DO UPDATE SET value = $1`,
      [String(SCHEMA_VERSION)]
    );
    return {
      mode: "update",
      seeded: false,
      schemaVersion: SCHEMA_VERSION,
      fromVersion: before.schemaVersion,
    };
  }

  return {
    mode: "ready",
    seeded: false,
    schemaVersion: SCHEMA_VERSION,
  };
}

async function readMeta() {
  try {
    const { rows } = await query(
      `SELECT key, value FROM settings WHERE key IN ('app_installed', 'schema_version')`
    );
    const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
    return {
      installed: map.app_installed === "1",
      schemaVersion: map.schema_version || "0",
    };
  } catch {
    // settings tablosu henüz yok → ilk kurulum
    return { installed: false, schemaVersion: "0" };
  }
}
