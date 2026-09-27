/**
 * Display formatters (Indonesian locale). Values arrive from Postgres `numeric`
 * as strings — accept both string and number and never do money/weight math here.
 */
const rupiahFormatter = new Intl.NumberFormat("id-ID", {
  maximumFractionDigits: 0,
});

const gramFormatter = new Intl.NumberFormat("id-ID", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 3,
});

function toNumber(value: number | string | null | undefined): number {
  if (value === null || value === undefined || value === "") return 0;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

/** 8500000 -> "Rp 8.500.000" */
export function formatRupiah(value: number | string | null | undefined): string {
  const n = toNumber(value);
  const formatted = rupiahFormatter.format(Math.abs(n));
  return n < 0 ? `-Rp ${formatted}` : `Rp ${formatted}`;
}

const percentFormatter = new Intl.NumberFormat("id-ID", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 3,
});

/** "75.000" -> "75,00%" ; "99.990" -> "99,99%" */
export function formatPercent(value: number | string | null | undefined): string {
  return `${percentFormatter.format(toNumber(value))}%`;
}

// Server components render in UTC otherwise; stores are in Indonesia.
const dateTimeFormatter = new Intl.DateTimeFormat("id-ID", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Jakarta",
});

/** ISO timestamp -> "27 Sep 2026, 14.30" (WIB) */
export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return "-";
  const d = typeof value === "string" ? new Date(value) : value;
  return Number.isNaN(d.getTime()) ? "-" : dateTimeFormatter.format(d);
}

/** Keeps digits only (max 13), no leading zeros: "Rp 1.500.000" -> "1500000". For money inputs. */
export function onlyDigits(value: string): string {
  return value.replace(/\D/g, "").replace(/^0+(?=\d)/, "").slice(0, 13);
}

/**
 * Groups an integer-rupiah value for display while typing: "1500000" -> "1.500.000".
 * Also accepts DB numerics ("1500000.00") and already grouped text ("1.500.000").
 */
export function groupThousands(value: string | number | null | undefined): string {
  const d = onlyDigits(String(value ?? "").replace(/[.,]\d{1,2}$/, ""));
  return d.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

/** 3.21 -> "3,21 gram" */
export function formatGram(value: number | string | null | undefined): string {
  return `${gramFormatter.format(toNumber(value))} gram`;
}

/** "2026-09-27" (a calendar date, no time) -> "27 Sep 2026". */
export function formatDateOnly(value: string | null | undefined): string {
  if (!value) return "-";
  const [y, m, d] = value.split("-").map(Number);
  if (!y || !m || !d) return value;
  return new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(y, m - 1, d)));
}
