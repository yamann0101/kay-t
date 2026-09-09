import path from "node:path";
import pg from "pg";
import { PGlite } from "@electric-sql/pglite";

let impl = null;

async function tryExternalPostgres(url) {
  const client = new pg.Client({
    connectionString: url,
    connectionTimeoutMillis: 4000,
    ssl: url.includes("localhost") || url.includes("127.0.0.1")
      ? false
      : { rejectUnauthorized: false },
  });
  try {
    await client.connect();
    await client.end();
    return true;
  } catch {
    try {
      await client.end();
    } catch {
      /* ignore */
    }
    return false;
  }
}

export async function connectDatabase() {
  const url = process.env.DATABASE_URL?.trim();
  const forcePg =
    process.env.NODE_ENV === "production" ||
    process.env.REQUIRE_POSTGRES === "1" ||
    process.env.REQUIRE_POSTGRES === "true";

  if (url) {
    // Bulutta / ilk bağlantıda Postgres hazır olmayabilir — kısa süre dene
    const ready = await waitForExternalPostgres(url, forcePg ? 30 : 3);
    if (ready) {
      const pool = new pg.Pool({
        connectionString: url,
        max: 10,
        ssl:
          url.includes("localhost") || url.includes("127.0.0.1")
            ? false
            : { rejectUnauthorized: false },
      });
      impl = {
        kind: "postgres",
        query: (text, params) => pool.query(text, params),
        exec: (text) => pool.query(text),
      };
      console.log("  PostgreSQL bağlandı.");
      return impl.kind;
    }
    if (forcePg) {
      throw new Error(
        "PostgreSQL bağlantısı kurulamadı. DATABASE_URL değerini kontrol edin."
      );
    }
    console.log("  DATABASE_URL yanıt vermedi, yerel yedek açılıyor…");
  } else if (forcePg) {
    throw new Error(
      "Production için DATABASE_URL zorunlu. PostgreSQL bağlantı adresini ortam değişkenine yazın."
    );
  }

  const dataDir = path.resolve(process.cwd(), ".data", "s360-pglite");
  const db = new PGlite(dataDir);
  await db.waitReady;
  impl = {
    kind: "pglite",
    query: async (text, params) => {
      const res = await db.query(text, params);
      return {
        rows: res.rows || [],
        rowCount: res.affectedRows ?? res.rows?.length ?? 0,
      };
    },
    exec: (text) => db.exec(text),
  };
  console.log("  Yerel veritabanı hazır (PGlite).");
  return impl.kind;
}

async function waitForExternalPostgres(url, attempts = 3) {
  for (let i = 0; i < attempts; i++) {
    if (await tryExternalPostgres(url)) return true;
    if (i < attempts - 1) {
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
  return false;
}

export async function query(text, params) {
  if (!impl) throw new Error("Veritabanı henüz hazır değil");
  return impl.query(text, params);
}

export async function exec(text) {
  if (!impl) throw new Error("Veritabanı henüz hazır değil");
  return impl.exec(text);
}

export async function waitForDb() {
  await query("SELECT 1");
}
