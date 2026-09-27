import { isRoleCode, type RoleCode } from "@/lib/auth/permissions";
import { bool, isUuid, normalizePhone, requiredText, str, type FieldErrors, type ValidationResult } from "./common";
import { PASSWORD_MIN_LENGTH } from "./auth";

export type StaffInput = {
  full_name: string;
  email: string;
  phone: string | null;
  role_code: RoleCode;
  is_active: boolean;
  store_ids: string[];
  password: string | null;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** mode "create" requires email + password; "update" ignores email and password. */
export function validateStaff(raw: Record<string, unknown> & { storeIds?: unknown[] }, mode: "create" | "update"): ValidationResult<StaffInput> {
  const errors: FieldErrors = {};
  const full_name = requiredText(raw.fullName, 2, 120, "Nama", errors, "fullName");
  const email = str(raw.email).toLowerCase();
  if (mode === "create" && !EMAIL_RE.test(email)) errors.email = "Email tidak valid";
  const phone = normalizePhone(raw.phone);
  if (phone === undefined) errors.phone = "Nomor HP tidak valid";
  const role = str(raw.roleCode);
  if (!isRoleCode(role)) errors.roleCode = "Pilih role";
  const store_ids = [...new Set((raw.storeIds ?? []).map(str).filter(Boolean))];
  if (store_ids.some((s) => !isUuid(s))) errors.storeIds = "Outlet tidak valid";
  if (role !== "OWNER" && role !== "ADMIN" && store_ids.length === 0) errors.storeIds = "Pilih minimal satu outlet";

  let password: string | null = null;
  const pw = typeof raw.password === "string" ? raw.password : "";
  if (mode === "create" || pw) {
    if (pw.length < PASSWORD_MIN_LENGTH) errors.password = `Password minimal ${PASSWORD_MIN_LENGTH} karakter`;
    else if (pw.length > 72) errors.password = "Password maksimal 72 karakter";
    else password = pw;
  }

  return Object.keys(errors).length
    ? { valid: false, errors }
    : {
        valid: true,
        data: { full_name, email, phone: phone ?? null, role_code: role as RoleCode, is_active: mode === "create" ? true : bool(raw.isActive), store_ids, password },
      };
}
