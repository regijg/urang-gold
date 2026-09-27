import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AppError } from "@/lib/action-result";
import { isUuid } from "@/lib/validation/common";
import { validateStaff } from "@/lib/validation/users";
import { requirePermission } from "@/server/auth/session";
import { mapDbError } from "@/server/db-errors";

export type StaffRow = {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  role_code: string;
  is_active: boolean;
  created_at: string;
  role: { name: string } | null;
  stores: { store_id: string }[];
};

const one = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? (v[0] ?? null) : v);

function invalid(errors: Record<string, string>): never {
  throw new AppError("VALIDATION_ERROR", "Periksa kembali isian Anda.", errors);
}

/**
 * Staff management. Reads go through RLS (own tenant). Writes need the admin API
 * for auth users, so they run with the service role AFTER the permission check,
 * and the RPCs re-verify the actor inside the database.
 */
export const usersService = {
  async list(): Promise<StaffRow[]> {
    await requirePermission("users.manage");
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("gold_users")
      .select("id, full_name, email, phone, role_code, is_active, created_at, role:gold_roles(name), stores:gold_user_stores(store_id)")
      .order("created_at");
    if (error) throw mapDbError(error);
    return ((data ?? []) as unknown as (StaffRow & { role: StaffRow["role"] | StaffRow["role"][] })[]).map((r) => ({ ...r, role: one(r.role) }));
  },

  async get(id: string): Promise<StaffRow> {
    const rows = await this.list();
    const row = isUuid(id) ? rows.find((r) => r.id === id) : undefined;
    if (!row) throw new AppError("NOT_FOUND", "Pengguna tidak ditemukan.");
    return row;
  },

  async roles() {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.from("gold_roles").select("code, name, description").order("sort_order");
    if (error) throw mapDbError(error);
    return (data ?? []) as { code: string; name: string; description: string | null }[];
  },

  async create(raw: Parameters<typeof validateStaff>[0]) {
    const actor = await requirePermission("users.manage");
    const parsed = validateStaff(raw, "create");
    if (!parsed.valid) invalid(parsed.errors);
    const input = parsed.data;

    const admin = createSupabaseAdminClient();
    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email: input.email,
      password: input.password!,
      email_confirm: true,
      user_metadata: { full_name: input.full_name },
    });
    if (createError || !created.user) {
      const msg = createError?.message?.toLowerCase() ?? "";
      if (msg.includes("already") || msg.includes("registered") || msg.includes("exists")) {
        throw new AppError("EMAIL_TAKEN", "Email sudah terdaftar.", { email: "Email sudah terdaftar" });
      }
      console.error("[users] createUser failed", createError?.message);
      throw new AppError("INTERNAL_ERROR", "Gagal membuat akun. Silakan coba lagi.");
    }

    const { error } = await admin.rpc("gold_add_staff", {
      p_actor_id: actor.userId,
      p_user_id: created.user.id,
      p_email: input.email,
      p_full_name: input.full_name,
      p_phone: input.phone,
      p_role_code: input.role_code,
      p_store_ids: input.store_ids,
    });
    if (error) {
      await admin.auth.admin.deleteUser(created.user.id);
      throw mapDbError(error);
    }
    return { id: created.user.id };
  },

  async update(id: string, raw: Parameters<typeof validateStaff>[0]) {
    const actor = await requirePermission("users.manage");
    if (!isUuid(id)) throw new AppError("NOT_FOUND", "Pengguna tidak ditemukan.");
    const parsed = validateStaff(raw, "update");
    if (!parsed.valid) invalid(parsed.errors);
    const input = parsed.data;

    const admin = createSupabaseAdminClient();
    const { error } = await admin.rpc("gold_update_staff", {
      p_actor_id: actor.userId,
      p_user_id: id,
      p_full_name: input.full_name,
      p_phone: input.phone,
      p_role_code: input.role_code,
      p_is_active: input.is_active,
      p_store_ids: input.store_ids,
    });
    if (error) throw mapDbError(error);

    if (input.password) {
      const { data: allowed, error: checkError } = await admin.rpc("gold_can_manage_user", { p_actor_id: actor.userId, p_user_id: id });
      if (checkError || !allowed) throw new AppError("FORBIDDEN", "Anda tidak memiliki akses untuk tindakan ini.");
      const { error: pwError } = await admin.auth.admin.updateUserById(id, { password: input.password });
      if (pwError) {
        console.error("[users] password reset failed", pwError.message);
        throw new AppError("INTERNAL_ERROR", "Data tersimpan, tetapi password gagal diubah.");
      }
    }
  },
};
