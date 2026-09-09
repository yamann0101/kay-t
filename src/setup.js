import { connectDatabase, waitForDb } from "./db/pool.js";
import { bootstrapDatabase } from "./db/bootstrap.js";
import { config } from "./config.js";

try {
  await connectDatabase();
  await waitForDb();
  const result = await bootstrapDatabase();
  if (result.mode === "install") {
    console.log("Kurulum tamam.", result.seeded ? "İlk veriler eklendi." : "Veritabanı hazır.");
    console.log(`Yönetici: ${config.adminUser} / ${config.adminPass}`);
  } else if (result.mode === "update") {
    console.log(`Güncelleme tamam. Şema v${result.schemaVersion}`);
  } else {
    console.log(`Hazır. Şema v${result.schemaVersion} (yeniden kurulum yok)`);
  }
  process.exit(0);
} catch (err) {
  console.error("Kurulum başarısız:", err.message);
  process.exit(1);
}
