import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { AppError } from "@/lib/action-result";
import type { LoginInput, RegisterInput } from "@/lib/validation/auth";
import { findProfileById } from "@/server/repositories/user.repository";
import { registerTenant } from "@/server/repositories/tenant.repository";

/** Signs in and verifies the user belongs to an active tenant; otherwise signs out again. */
export async function login(input: LoginInput): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithPassword(input);

  if (error || !data.user) {
    throw new AppError("INVALID_CREDENTIALS", "Email atau password salah.");
  }

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
    throw new AppError("TENANT_INACTIVE", "Toko Anda sedang tidak aktif. Hubungi admin GoldPOS.");
  }

  // audit trail (§27); a failure here must not block the login
  const { error: auditError } = await supabase.rpc("gold_log_login");
  if (auditError) console.error("[auth] login audit failed", auditError.message);
}

/** Public self-service signup can be switched off in production (REGISTRATION_ENABLED=false). */
export function isRegistrationEnabled(): boolean {
  return process.env.REGISTRATION_ENABLED !== "false";
}

/**
 * Self-service signup: creates the auth user, then tenant + first store + OWNER
 * profile in one DB transaction (RPC). Rolls back the auth user if the RPC fails.
 */
export async function registerOwner(input: RegisterInput): Promise<void> {
  if (!isRegistrationEnabled()) {
    throw new AppError("REGISTRATION_DISABLED", "Pendaftaran toko baru sedang ditutup. Hubungi admin GoldPOS.");
  }
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
    await registerTenant(admin, {
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

  await login({ email: input.email, password: input.password });
}

export async function logout(): Promise<void> {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
}
