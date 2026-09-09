export const BUILTIN_KEYS = new Set([
  "record_no",
  "first_name",
  "last_name",
  "company",
  "plate",
  "visit_date",
  "entry_time",
  "exit_time",
  "notes",
  "visit_type",
  "entry_type",
  "vehicle_status",
  "host",
  "phone",
]);

export const FORM_SKIP = new Set(["record_no", "visit_type", "entry_type", "vehicle_status"]);

export const DEFAULT_VISITOR_FIELDS = [
  { key: "record_no", label: "Kayıt No", type: "text", required: false, enabled: true, builtin: true, readonly: true },
  { key: "first_name", label: "İsim", type: "text", required: true, enabled: true, builtin: true },
  { key: "last_name", label: "Soyisim", type: "text", required: true, enabled: true, builtin: true },
  { key: "company", label: "Firma", type: "text", required: true, enabled: true, builtin: true },
  { key: "plate", label: "Plaka", type: "text", required: false, enabled: true, builtin: true },
  { key: "visit_date", label: "Tarih", type: "text", required: true, enabled: true, builtin: true },
  { key: "entry_time", label: "Giriş Saati", type: "text", required: true, enabled: true, builtin: true },
  { key: "exit_time", label: "Çıkış Saati", type: "text", required: false, enabled: true, builtin: true },
  { key: "notes", label: "Açıklama", type: "textarea", required: false, enabled: true, builtin: true },
  { key: "visit_type", label: "Ziyaret Türü", type: "text", required: false, enabled: true, builtin: true, readonly: true },
  { key: "entry_type", label: "Giriş Şekli", type: "text", required: false, enabled: true, builtin: true, readonly: true },
];

function slug(label) {
  return String(label || "alan")
    .toLowerCase()
    .replace(/ı/g, "i")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 32) || "alan";
}

export function normalizeFields(raw) {
  let list = raw;
  if (typeof list === "string") {
    try {
      list = JSON.parse(list);
    } catch {
      list = null;
    }
  }
  if (!Array.isArray(list) || !list.length) list = DEFAULT_VISITOR_FIELDS;
  const used = new Set();
  const out = [];
  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    let key = String(item.key || "").trim();
    const builtin = BUILTIN_KEYS.has(key) || Boolean(item.builtin);
    if (!key) key = `c_${slug(item.label)}_${out.length}`;
    if (!builtin && !key.startsWith("c_")) key = `c_${slug(key)}`;
    if (used.has(key)) continue;
    used.add(key);
    out.push({
      key,
      label: String(item.label || key).trim() || key,
      type: item.type === "textarea" ? "textarea" : "text",
      required: Boolean(item.required),
      enabled: item.enabled !== false,
      builtin,
      readonly: Boolean(item.readonly) || key === "record_no" || key === "entry_type" || key === "vehicle_status",
    });
  }
  for (const def of DEFAULT_VISITOR_FIELDS) {
    if (!used.has(def.key)) out.push({ ...def });
  }
  return out;
}

export function enabledFields(fields) {
  return normalizeFields(fields).filter((f) => f.enabled);
}

export function parseExtra(row) {
  if (!row) return {};
  if (row.extra && typeof row.extra === "object") return row.extra;
  if (typeof row.extra === "string") {
    try {
      return JSON.parse(row.extra) || {};
    } catch {
      return {};
    }
  }
  return {};
}

export function visitorValue(row, key) {
  if (!row) return "";
  if (BUILTIN_KEYS.has(key)) return row[key] ?? "";
  return parseExtra(row)[key] ?? "";
}

export function splitVisitorPayload(body, fields) {
  const cols = {};
  const extra = {};
  for (const f of normalizeFields(fields)) {
    if (!f.enabled && f.readonly) continue;
    const val = body?.[f.key];
    if (BUILTIN_KEYS.has(f.key)) cols[f.key] = val == null ? "" : String(val);
    else extra[f.key] = val == null ? "" : String(val);
  }
  if (body?.extra && typeof body.extra === "object") Object.assign(extra, body.extra);
  return { cols, extra };
}
