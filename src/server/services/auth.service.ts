import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { AppError } from "@/lib/action-result";
import { isPlatformAdminUser } from "@/lib/auth/platform";
import type { LoginInput, RegisterInput } from "@/lib/validation/auth";
import { findProfileById } from "@/server/repositories/user.repository";
import { registerTenant } from "@/server/repositories/tenant.repository";

/**
 * Signs in and verifies the user belongs to an active tenant; otherwise signs out again.
 * Platform admins (PLATFORM_ADMIN_EMAILS) have no shop: they go to the platform console instead.
 */
export async function login(input: LoginInput): Promise<{ platformAdmin: boolean }> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithPassword(input);

  if (error?.code === "email_not_confirmed") {
    // Supabase only reports this once the password was right, so it does not reveal which emails exist
    throw new AppError("EMAIL_NOT_CONFIRMED", "Email belum diverifikasi. Minta admin UrangGold memverifikasi akun Anda.");
  }
  if (error || !data.user) {
    throw new AppError("INVALID_CREDENTIALS", "Email atau password salah.");
  }

  if (isPlatformAdminUser(data.user)) return { platformAdmin: true };

  const profile = await findProfileById(supabase, data.user.id);

  if (!profile) {
    await supabase.auth.signOut();
    throw new AppError("NOT_REGISTERED", "Akun belum terdaftar di toko mana pun. Hubungi owner toko.");
  }
  if (!profile.is_active) {
    await supabase.auth.signOut();
    throw new AppError("USER_INACTIVE", "Akun Anda dinonaktifkan. Hubungi owner toko.");
  }
  if (!profile.tenant || profile.tenant.status !== "ACTIVE") {
    await supabase.auth.signOut();
    throw new AppError("TENANT_INACTIVE", "Toko Anda sedang tidak aktif. Hubungi admin UrangGold.");
  }

  // audit trail (§27); a failure here must not block the login
  const { error: auditError } = await supabase.rpc("gold_log_login");
  if (auditError) console.error("[auth] login audit failed", auditError.message);
  return { platformAdmin: false };
}

/**
 * Public self-service signup is CLOSED unless REGISTRATION_ENABLED=true. Shops are normally
 * created by the platform admin from /platform (see provisionTenant), so nobody can use
 * UrangGold without the owner of the app knowing.
 */
export function isRegistrationEnabled(): boolean {
  return process.env.REGISTRATION_ENABLED === "true";
}

/**
 * Creates the auth user, then tenant + first store + OWNER profile in one DB transaction (RPC).
 * Rolls back the auth user if the RPC fails. Callers must have authorised this themselves:
 * registerOwner (when public signup is open) or the platform console (platform admin only).
 */
export async function provisionTenant(input: RegisterInput): Promise<{ tenantId: string; storeId: string }> {
  const admin = createSupabaseAdminClient();

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email: input.email,
    password: input.password,
    email_confirm: true,
    user_metadata: { full_name: input.fullName },
  });

  if (createError || !created.user) {
    const msg = createError?.message?.toLowerCase() ?? "";
    if (msg.includes("already") || msg.includes("registered") || msg.includes("exists")) {
      throw new AppError("EMAIL_TAKEN", "Email sudah terdaftar.", { email: "Email sudah terdaftar" });
    }
    throw createError ?? new Error("createUser returned no user");
  }

  try {
    return await registerTenant(admin, {
      userId: created.user.id,
      email: input.email,
      fullName: input.fullName,
      tenantName: input.tenantName,
      storeName: input.storeName,
    });
  } catch (error) {
    await admin.auth.admin.deleteUser(created.user.id);
    throw error;
  }
}

/** Public self-service signup (only while REGISTRATION_ENABLED=true): provisions the shop and signs the owner in. */
export async function registerOwner(input: RegisterInput): Promise<void> {
  if (!isRegistrationEnabled()) {
    throw new AppError("REGISTRATION_DISABLED", "Pendaftaran toko baru ditutup. Untuk memakai UrangGold, hubungi admin UrangGold.");
  }
  await provisionTenant(input);
  await login({ email: input.email, password: input.password });
}

export async function logout(): Promise<void> {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
}
