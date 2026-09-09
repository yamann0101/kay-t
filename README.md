# S-360 · Özel Güvenlik Yönetim Sistemi

PWA saha uygulaması + yönetici paneli. Kullanıcılar ve kayıtlar **PostgreSQL**’de tutulur.

## Senin yapacağın tek şey

1. Bu repoyu sunucuya / Railway / Render’a bağla  
2. Ortam değişkenine **PostgreSQL** adresini yaz:

```env
DATABASE_URL=postgresql://KULLANICI:SIFRE@HOST:5432/VERITABANI
```

3. Başlat (`npm start` veya platformun Start komutu)

Gerisini uygulama yapar:
- **İlk açılış:** tablolar + yönetici hesabı otomatik kurulur (bir kez)
- **Sonraki açılış / güncelleme:** yeniden kurulum yok; sadece şema güncellenir, veriler korunur

| Hesap | Kullanıcı | Şifre |
|---|---|---|
| Yönetici | `admin` | `Admin123!` |
| Görevli | `erhan` | `123456` |

İlk girişten sonra şifreleri değiştirmen önerilir.

---

## Railway / Render / benzeri

| Ayar | Değer |
|---|---|
| Build | `npm install` |
| Start | `npm start` |
| Ortam | `DATABASE_URL` → Postgres eklentisinden otomatik gelir |
| Node | 20+ |

İsteğe bağlı:

```env
PORT=3600
ADMIN_USER=admin
ADMIN_PASS=Admin123!
NODE_ENV=production
```

`JWT` / VAPID anahtarları yoksa uygulama kendi üretir ve `.data/secrets.json` içinde tutar (kalıcı disk yoksa her redeploy yeni anahtar üretebilir; kalıcı volume veya env ile sabitleyin).

---

## Lokal (isteğe bağlı)

```bash
npm install
npm start
```

`DATABASE_URL` yoksa yerel PGlite açılır. Docker ile Postgres:

```bash
docker compose up -d
# .env içinde DATABASE_URL hazırsa npm start Postgres’e bağlanır
```

Tarayıcı: http://localhost:3600

---

## Güncelleme mantığı

| Durum | Ne olur |
|---|---|
| İlk `npm start` | Kurulum + seed (boş DB ise) |
| `git pull` / redeploy | Şema güncellenir, **seed tekrarlanmaz**, veriler kalır |
| Elle kontrol | `npm run setup` |

Şema sürümü `settings.schema_version` ile tutulur.
