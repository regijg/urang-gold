import { cache } from "react";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { findProfileById } from "@/server/repositories/user.repository";
import { AppError } from "@/lib/action-result";
import { isRoleCode, normalizePermissions, type Permission, type RoleCode } from "@/lib/auth/permissions";

export type AppSession = {
  userId: string;
  email: string;
  fullName: string;
  roleCode: RoleCode;
  roleName: string;
  permissions: Permission[];
  tenant: { id: string; name: string; slug: string };
};

/**
 * Resolves the verified user + tenant for this request (deduplicated per request).
 * Returns null when not signed in, not registered, deactivated, or tenant inactive.
 */
export const getAppSession = cache(async (): Promise<AppSession | null> => {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const profile = await findProfileById(supabase, user.id);
  if (!profile || !profile.is_active || !profile.tenant || profile.tenant.status !== "ACTIVE") return null;
  if (!profile.role || !isRoleCode(profile.role.code)) return null;

  // effective permissions (tenant override or role default), resolved in the database
  const { data: effective, error } = await supabase.rpc("gold_current_permissions");
  if (error) throw error;

  return {
    userId: profile.id,
    email: profile.email,
    fullName: profile.full_name,
    roleCode: profile.role.code,
    roleName: profile.role.name,
    permissions: normalizePermissions((effective as string[] | null) ?? []),
    tenant: { id: profile.tenant.id, name: profile.tenant.name, slug: profile.tenant.slug },
  };
});

/** For pages/layouts: signs out and redirects to /login when there is no usable session. */
export async function requireAppSession(): Promise<AppSession> {
  const session = await getAppSession();
  if (!session) redirect("/auth/signout");
  return session;
}

/** For server actions/services: throws a typed error instead of redirecting. */
export async function requirePermission(permission: Permission): Promise<AppSession> {
  const session = await getAppSession();
  if (!session) throw new AppError("UNAUTHENTICATED", "Sesi berakhir. Silakan login kembali.");
  if (!session.permissions.includes(permission)) {
    throw new AppError("FORBIDDEN", "Anda tidak memiliki akses untuk tindakan ini.");
  }
  return session;
}
