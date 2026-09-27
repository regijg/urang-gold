/**
 * Shared parsers for untrusted form input. Numbers are kept as decimal STRINGS
 * (e.g. "3.210") and handed to Postgres numeric — never converted to JS floats.
 */

export type FieldErrors = Record<string, string>;

export type ValidationResult<T> = { valid: true; data: T } | { valid: false; errors: FieldErrors };

export function str(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/** Empty string -> null, otherwise trimmed text; error when longer than max. */
export function optionalText(value: unknown, max: number, label: string, errors: FieldErrors, key: string): string | null {
  const s = str(value);
  if (!s) return null;
  if (s.length > max) errors[key] = `${label} maksimal ${max} karakter`;
  return s;
}

export function requiredText(value: unknown, min: number, max: number, label: string, errors: FieldErrors, key: string): string {
  const s = str(value);
  if (s.length < min) errors[key] = min <= 1 ? `${label} wajib diisi` : `${label} minimal ${min} karakter`;
  else if (s.length > max) errors[key] = `${label} maksimal ${max} karakter`;
  return s;
}

/**
 * Parses a decimal (used for gram weights / percentages) typed as:
 *   "3,21" -> "3.21"   "3.210" -> "3.210"   "1.234,5" -> "1234.5"   "1.234.567" -> "1234567"
 * Rules: with a comma, the comma is the decimal separator and dots are thousand
 * separators; without a comma, a single dot is the decimal separator (so a weight
 * like "3.210" is never read as 3210 gram); several dots are thousand separators.
 * Returns null when not a valid non-negative number or exceeding `scale` decimals.
 */
export function parseDecimal(value: unknown, scale: number): string | null {
  let s = str(value).replace(/\s/g, "");
  if (!s) return null;

  if (s.includes(",")) {
    if ((s.match(/,/g) ?? []).length > 1) return null;
    s = s.replace(/\./g, "").replace(",", ".");
  } else if ((s.match(/\./g) ?? []).length > 1) {
    s = s.replace(/\./g, "");
  }

  if (!/^\d+(\.\d+)?$/.test(s)) return null;
  const [intPart, frac = ""] = s.split(".");
  if (frac.length > scale) return null;
  const normalizedInt = intPart.replace(/^0+(?=\d)/, "");
  return frac ? `${normalizedInt}.${frac}` : normalizedInt;
}

/** Rupiah: digits with optional thousand separators ("8.500.000", "8500000"). No decimals. */
export function parseRupiah(value: unknown): string | null {
  const s = str(value).replace(/^rp\.?\s*/i, "").replace(/[.\s]/g, "");
  if (!s) return null;
  if (!/^\d{1,13}$/.test(s)) return null;
  return s.replace(/^0+(?=\d)/, "");
}

/**
 * Money value as returned by Postgres numeric ("6557625.00", "-250000.5", 12) ->
 * integer-rupiah string ("6557625"), rounded half away from zero. Use this for DB
 * values before any BigInt math — parseRupiah() is for user input, where "." is a
 * thousand separator.
 */
export function dbRupiah(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") return "0";
  const s = String(value).trim();
  const m = /^(-?)(\d+)(?:\.(\d+))?$/.exec(s);
  if (!m) return "0";
  const [, sign, int, frac = ""] = m;
  let n = BigInt(int);
  if (frac && Number(frac[0]) >= 5) n += BigInt(1);
  return n === BigInt(0) ? "0" : `${sign}${n}`;
}

/** Compares two non-negative decimal strings without floating point. */
export function compareDecimal(a: string, b: string): number {
  const [ai, af = ""] = a.split(".");
  const [bi, bf = ""] = b.split(".");
  const len = Math.max(af.length, bf.length);
  const an = BigInt(ai + af.padEnd(len, "0"));
  const bn = BigInt(bi + bf.padEnd(len, "0"));
  return an === bn ? 0 : an < bn ? -1 : 1;
}

/** "0812-3456 7890" -> "081234567890"; "+62 812..." -> "+62812..."; invalid -> undefined. */
export function normalizePhone(value: unknown): string | null | undefined {
  const s = str(value);
  if (!s) return null;
  const cleaned = s.replace(/[\s().-]/g, "");
  return /^\+?[0-9]{8,15}$/.test(cleaned) ? cleaned : undefined;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function optionalEmail(value: unknown, errors: FieldErrors, key = "email"): string | null {
  const s = str(value).toLowerCase();
  if (!s) return null;
  if (s.length > 150 || !EMAIL_RE.test(s)) errors[key] = "Email tidak valid";
  return s;
}

/** Checkbox / "true"/"on" -> boolean. */
export function bool(value: unknown): boolean {
  return value === true || value === "on" || value === "true" || value === "1";
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}

/**
 * Makes user search text safe for PostgREST `or()` / `ilike` filters:
 * drops characters with filter-syntax meaning and caps the length.
 */
export function sanitizeSearch(value: unknown): string {
  return str(value)
    .replace(/[,()*%\\:"']/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 60);
}

export function parsePage(value: unknown): number {
  const n = Number(typeof value === "string" ? value : "1");
  return Number.isInteger(n) && n > 0 && n < 100000 ? n : 1;
}
