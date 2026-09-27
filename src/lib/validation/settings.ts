import { requiredText, type FieldErrors } from "./common";

export function validateTenantName(value: unknown): { name: string; errors: FieldErrors } {
  const errors: FieldErrors = {};
  const name = requiredText(value, 2, 120, "Nama toko", errors, "name");
  return { name, errors };
}
