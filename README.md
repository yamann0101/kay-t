# S-360 · Özel Güvenlik Yönetim Sistemi

PWA saha uygulaması + yönetici paneli.

## Veri nerede?

**Tüm kayıtlar yalnızca PostgreSQL’de** tutulur (ziyaretçi, anahtar, kullanıcı, log…).

- Telefonda / tarayıcıda kayıt **saklanmaz**
- Yerel dosya veritabanı (PGlite) **yok**
- Güncelleme / redeploy seed’i tekrarlamaz → **veriler silinmez**
- Herkes aynı sunucu + aynı `DATABASE_URL` üzerinden kayıtları görür

## Senin yapacağın

1. Repoyu Railway / Render vb. bağla  
2. Postgres ekle → `DATABASE_URL` otomatik gelsin  
3. Start: `npm start`

| Hesap | Kullanıcı | Şifre |
|---|---|---|
| Yönetici | `admin` | `Admin123!` |
| Görevli | `erhan` | `123456` |

İlk girişten sonra şifreleri değiştir.

---

## Ortam

```env
DATABASE_URL=postgresql://KULLANICI:SIFRE@HOST:5432/VERITABANI
PORT=3600
NODE_ENV=production
```

`DATABASE_URL` yoksa veya Postgres yanıt vermezse uygulama **açılmaz** (yerel yedek yok).

---

## Güncelleme

| Durum | Ne olur |
|---|---|
| İlk start | Tablolar + admin (bir kez) |
| Redeploy / git pull | Şema güncellenir, kayıtlar kalır |
| Elle | `npm run setup` |

---

## Lokal geliştirme

Postgres şart (ör. `docker compose up -d`), sonra:

```bash
npm install
npm start
```
