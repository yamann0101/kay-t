import path from "node:path";
import express from "express";
import helmet from "helmet";
import compression from "compression";
import cookieParser from "cookie-parser";
import jwt from "jsonwebtoken";
import { config } from "./config.js";
import { connectDatabase, waitForDb, getDbKind } from "./db/pool.js";
import { bootstrapDatabase } from "./db/bootstrap.js";
import { authRequired } from "./middleware/auth.js";
import authRoutes from "./routes/auth.js";
import appRoutes from "./routes/app.js";
import adminRoutes from "./routes/admin.js";
import { startNotifier } from "./lib/notify.js";

const app = express();
const publicDir = path.resolve(process.cwd(), "public");

app.disable("x-powered-by");
app.set("trust proxy", 1);
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  })
);
app.use(compression());
app.use(express.json({ limit: "8mb" }));
app.use(cookieParser());
app.use(
  express.static(publicDir, {
    maxAge: config.isProd ? "1h" : 0,
    etag: !config.isProd,
    index: false,
    setHeaders(res, filePath) {
      if (!config.isProd && /\.(html|js|css)$/.test(filePath)) {
        res.setHeader("Cache-Control", "no-store");
      }
    },
  })
);

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    name: "S-360",
    version: "1.0.0",
    database: getDbKind() || "disconnected",
    storage: "postgresql",
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/app", appRoutes);
app.use("/api/admin", authRequired, adminRoutes);

app.get("/", (req, res) => {
  const token = req.cookies?.[config.cookieName];
  if (token) {
    try {
      jwt.verify(token, config.jwtSecret);
      return res.redirect(302, "/app");
    } catch {
      /* oturum yok → login */
    }
  }
  res.sendFile(path.join(publicDir, "login.html"));
});
app.get("/app", (_req, res) => res.sendFile(path.join(publicDir, "app.html")));
app.get("/admin", (_req, res) => res.sendFile(path.join(publicDir, "admin.html")));

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: "Sunucu hatası" });
});

async function start() {
  console.log("\n  S-360  ·  Özel Güvenlik Yönetim Sistemi");
  console.log("  -----------------------------------------");
  try {
    await connectDatabase();
    await waitForDb();
    const result = await bootstrapDatabase();
    if (result.mode === "install") {
      console.log("  İlk kurulum tamam (bir kez).");
      if (result.seeded) {
        console.log(`  Yönetici  →  ${config.adminUser}  /  ${config.adminPass}`);
        console.log("  Görevli   →  erhan  /  123456");
      }
    } else if (result.mode === "update") {
      console.log(`  Güncelleme uygulandı → şema v${result.schemaVersion}`);
    } else {
      console.log(`  Veritabanı hazır (şema v${result.schemaVersion})`);
    }
    console.log("  Depolama   →  PostgreSQL (kayıtlar kalıcı, paylaşımlı)");
  } catch (err) {
    console.error("\n  Veritabanı hazırlanamadı.\n");
    console.error(" ", err.message || err);
    console.error("  DATABASE_URL ile PostgreSQL bağlayın, sonra tekrar başlatın.\n");
    process.exit(1);
  }

  app.listen(config.port, "0.0.0.0", () => {
    console.log(`  Çalışıyor →  http://localhost:${config.port}\n`);
    startNotifier();
  });
}

start();
