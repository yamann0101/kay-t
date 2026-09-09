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
