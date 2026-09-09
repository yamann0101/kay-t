/** Türkiye (Europe/Istanbul) günü YYYY-MM-DD */
export function trToday() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Istanbul" });
}

/** SQL: satırın TR günü = bugünün TR günü */
export const SQL_TR_TODAY = `(created_at AT TIME ZONE 'Europe/Istanbul')::date = (CURRENT_TIMESTAMP AT TIME ZONE 'Europe/Istanbul')::date`;

/** SQL: satır bu ay içinde (TR) */
export const SQL_TR_MONTH = `(created_at AT TIME ZONE 'Europe/Istanbul')::date >= date_trunc('month', (CURRENT_TIMESTAMP AT TIME ZONE 'Europe/Istanbul'))::date`;

export const SQL_TR_TODAY_COL = (col) =>
  `(${col} AT TIME ZONE 'Europe/Istanbul')::date = (CURRENT_TIMESTAMP AT TIME ZONE 'Europe/Istanbul')::date`;

export const SQL_TR_MONTH_COL = (col) =>
  `(${col} AT TIME ZONE 'Europe/Istanbul')::date >= date_trunc('month', (CURRENT_TIMESTAMP AT TIME ZONE 'Europe/Istanbul'))::date`;

/** TR saat parçaları (yedek zamanlayıcı vb.) */
export function trParts(d = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    weekday: "short",
    hour12: false,
  }).formatToParts(d);
  const get = (t) => parts.find((p) => p.type === t)?.value || "";
  const wdMap = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return {
    y: Number(get("year")),
    m: Number(get("month")),
    day: Number(get("day")),
    hour: get("hour").padStart(2, "0"),
    minute: get("minute").padStart(2, "0"),
    weekday: wdMap[get("weekday")] ?? d.getDay(),
  };
}
