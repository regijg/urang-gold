/**
 * Server-side input validation for auth forms. Pure functions: take untrusted
 * FormData-like values, return normalized data or field errors.
 */
export type ValidationResult<T> =
  | { valid: true; data: T }
  | { valid: false; errors: Record<string, string> };

export type LoginInput = { email: string; password: string };
export type RegisterInput = {
  fullName: string;
  email: string;
  password: string;
  tenantName: string;
  storeName: string;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const PASSWORD_MIN_LENGTH = 8;

function str(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function checkName(value: string, label: string): string | null {
  if (value.length < 2) return `${label} minimal 2 karakter`;
  if (value.length > 120) return `${label} maksimal 120 karakter`;
  return null;
}

export function validateLogin(raw: { email?: unknown; password?: unknown }): ValidationResult<LoginInput> {
  const email = str(raw.email).toLowerCase();
  const password = typeof raw.password === "string" ? raw.password : "";
  const errors: Record<string, string> = {};

  if (!EMAIL_RE.test(email)) errors.email = "Email tidak valid";
  if (!password) errors.password = "Password wajib diisi";

  return Object.keys(errors).length ? { valid: false, errors } : { valid: true, data: { email, password } };
}

export function validateRegister(raw: {
  fullName?: unknown;
  email?: unknown;
  password?: unknown;
  tenantName?: unknown;
  storeName?: unknown;
}): ValidationResult<RegisterInput> {
  const fullName = str(raw.fullName);
  const email = str(raw.email).toLowerCase();
  const password = typeof raw.password === "string" ? raw.password : "";
  const tenantName = str(raw.tenantName);
  const storeName = str(raw.storeName) || tenantName;
  const errors: Record<string, string> = {};

  const fullNameError = checkName(fullName, "Nama lengkap");
  if (fullNameError) errors.fullName = fullNameError;
  if (!EMAIL_RE.test(email)) errors.email = "Email tidak valid";
  if (password.length < PASSWORD_MIN_LENGTH) errors.password = `Password minimal ${PASSWORD_MIN_LENGTH} karakter`;
  else if (password.length > 72) errors.password = "Password maksimal 72 karakter";
  const tenantError = checkName(tenantName, "Nama usaha");
  if (tenantError) errors.tenantName = tenantError;
  const storeError = checkName(storeName, "Nama outlet");
  if (storeError) errors.storeName = storeError;

  return Object.keys(errors).length
    ? { valid: false, errors }
    : { valid: true, data: { fullName, email, password, tenantName, storeName } };
}

/** Only allow same-site relative redirects after login (prevents open redirect). */
export function safeRedirectPath(next: unknown, fallback = "/dashboard"): string {
  if (typeof next !== "string") return fallback;
  if (!next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback;
  if (next === "/login" || next === "/register") return fallback;
  return next;
}
