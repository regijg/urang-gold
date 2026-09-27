import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AppError } from "@/lib/action-result";
import { isRoleCode, normalizePermissions, sanitizeRolePermissions, type Permission } from "@/lib/auth/permissions";
import { validateTenantName } from "@/lib/validation/settings";
import { requirePermission } from "@/server/auth/session";
import { mapDbError } from "@/server/db-errors";

export type TenantProfile = { id: string; name: string; slug: string; plan: string; status: string; created_at: string };
export type RoleInfo = {
  code: string;
  name: string;
  description: string | null;
  defaults: Permission[];
  permissions: Permission[]; // effective for this tenant
  customized: boolean;
};

export const settingsService = {
  async tenant(): Promise<TenantProfile> {
    await requirePermission("tenant.manage");
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.from("gold_tenants").select("id, name, slug, plan, status, created_at").maybeSingle();
    if (error) throw mapDbError(error);
    if (!data) throw new AppError("NOT_FOUND", "Toko tidak ditemukan.");
    return data as TenantProfile;
  },

  /** Only `name` is client-updatable (column grant); RLS allows tenant.manage on own tenant. */
  async renameTenant(value: unknown) {
    const session = await requirePermission("tenant.manage");
    const { name, errors } = validateTenantName(value);
    if (Object.keys(errors).length) throw new AppError("VALIDATION_ERROR", errors.name, errors);
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.from("gold_tenants").update({ name }).eq("id", session.tenant.id).select("id");
    if (error) throw mapDbError(error);
    if (!data?.length) throw new AppError("FORBIDDEN", "Anda tidak memiliki akses untuk tindakan ini.");
  },

  async roles(): Promise<RoleInfo[]> {
    await requirePermission("tenant.manage");
    const supabase = await createSupabaseServerClient();
    const [{ data: roles, error: e1 }, { data: overrides, error: e2 }] = await Promise.all([
      supabase.from("gold_roles").select("code, name, description, permissions").order("sort_order"),
      supabase.from("gold_tenant_role_permissions").select("role_code, permissions"),
    ]);
    if (e1) throw mapDbError(e1);
    if (e2) throw mapDbError(e2);
    const byRole = new Map((overrides ?? []).map((o) => [o.role_code as string, o.permissions as string[]]));
    return ((roles ?? []) as { code: string; name: string; description: string | null; permissions: string[] }[]).map((r) => {
      const override = r.code === "OWNER" ? undefined : byRole.get(r.code);
      return {
        code: r.code,
        name: r.name,
        description: r.description,
        defaults: normalizePermissions(r.permissions),
        permissions: normalizePermissions(override ?? r.permissions),
        customized: !!override,
      };
    });
  },

  /** Saves the permission set of a non-owner role; `null` resets it to the default. Guard rails are enforced in the DB. */
  async setRolePermissions(roleCode: unknown, permissions: unknown[] | null) {
    const session = await requirePermission("tenant.manage");
    if (session.roleCode !== "OWNER") throw new AppError("FORBIDDEN", "Hanya Owner yang dapat mengubah hak akses.");
    if (!isRoleCode(roleCode) || roleCode === "OWNER") throw new AppError("VALIDATION_ERROR", "Role tidak dapat diubah.");
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.rpc("gold_set_role_permissions", {
      p_role_code: roleCode,
      p_permissions: permissions === null ? null : sanitizeRolePermissions(permissions),
    });
    if (error) throw mapDbError(error);
  },
};
