import pg from "pg";

let impl = null;

function pgSsl(url) {
  if (!url) return false;
  if (url.includes("localhost") || url.includes("127.0.0.1")) return false;
  if (/[?&]sslmode=disable/i.test(url)) return false;
  return { rejectUnauthorized: false };
}

async function tryExternalPostgres(url) {
  const client = new pg.Client({
    connectionString: url,
    connectionTimeoutMillis: 5000,
    ssl: pgSsl(url),
  });
  try {
    await client.connect();
    await client.query("SELECT 1");
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

async function waitForExternalPostgres(url, attempts = 30) {
  for (let i = 0; i < attempts; i++) {
    if (await tryExternalPostgres(url)) return true;
    if (i < attempts - 1) await new Promise((r) => setTimeout(r, 1000));
  }
  return false;
}

/**
 * Tüm kayıtlar yalnızca PostgreSQL’de tutulur.
 * Yerel PGlite yedeği yoktur — herkes aynı uzak DB’ye bağlanır.
 */
export async function connectDatabase() {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    throw new Error(
      "DATABASE_URL yok. PostgreSQL bağlantı adresini ortam değişkenine yazın. Kayıtlar yerel tutulmaz."
    );
  }

  const ready = await waitForExternalPostgres(url, 45);
  if (!ready) {
    throw new Error(
      "PostgreSQL’e bağlanılamadı. DATABASE_URL / veri tabanı servisini kontrol edin. Yerel yedek kullanılmaz."
    );
  }

  const pool = new pg.Pool({
    connectionString: url,
    max: 15,
    ssl: pgSsl(url),
  });

  impl = {
    kind: "postgres",
    query: (text, params) => pool.query(text, params),
    exec: (text) => pool.query(text),
  };

  console.log("  PostgreSQL bağlandı — tüm kayıtlar uzak veritabanında.");
  return impl.kind;
}

export function getDbKind() {
  return impl?.kind || null;
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
