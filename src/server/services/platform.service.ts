import { AppError } from "@/lib/action-result";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { dbRupiah, isUuid } from "@/lib/validation/common";
import { validateRegister } from "@/lib/validation/auth";
import { isSwitchableStatus, isTenantPlan, type TenantPlan, type TenantStatus } from "@/lib/validation/platform";
import { assertPlatformAdmin } from "@/server/auth/platform";
import { mapDbError } from "@/server/db-errors";
import { provisionTenant } from "@/server/services/auth.service";

export type PlatformTenant = {
  id: string;
  name: string;
  slug: string;
  status: TenantStatus;
  plan: TenantPlan;
  created_at: string;
  owner_email: string | null;
  store_count: number;
  user_count: number;
  sales_today: string;
  sales_month: string;
  sales_count_month: number;
  sales_total: string;
  last_sale_at: string | null;
};

type StatsRow = {
  tenant_id: string;
  store_count: number | string;
  user_count: number | string;
  sales_today: string;
  sales_month: string;
  sales_count_month: number | string;
  sales_total: string;
  last_sale_at: string | null;
};

/**
 * Console for the owner of the app. Every method re-checks PLATFORM_ADMIN_EMAILS first and then
 * uses the service role (RLS would hide other shops), so never call these from tenant code.
 */
export const platformService = {
  async list(): Promise<{ tenants: PlatformTenant[]; statsAvailable: boolean }> {
    await assertPlatformAdmin();
    const admin = createSupabaseAdminClient();

    const [tenants, owners, stats] = await Promise.all([
      admin.from("gold_tenants").select("id, name, slug, status, plan, created_at").order("created_at", { ascending: false }),
      admin.from("gold_users").select("tenant_id, email, created_at").eq("role_code", "OWNER").order("created_at"),
      admin.rpc("gold_platform_tenant_stats"),
    ]);
    if (tenants.error) throw mapDbError(tenants.error);

    const ownerOf = new Map<string, string>();
    for (const o of (owners.data ?? []) as { tenant_id: string; email: string }[]) {
      if (!ownerOf.has(o.tenant_id)) ownerOf.set(o.tenant_id, o.email);
    }
    // the stats come from migration 16; without it the list still works, just without the figures
    const statsAvailable = !stats.error;
    const statOf = new Map<string, StatsRow>(((stats.data ?? []) as StatsRow[]).map((r) => [r.tenant_id, r]));

    return {
      statsAvailable,
      tenants: ((tenants.data ?? []) as Pick<PlatformTenant, "id" | "name" | "slug" | "status" | "plan" | "created_at">[]).map((t) => {
        const s = statOf.get(t.id);
        return {
          ...t,
          owner_email: ownerOf.get(t.id) ?? null,
          store_count: Number(s?.store_count ?? 0),
          user_count: Number(s?.user_count ?? 0),
          sales_today: dbRupiah(s?.sales_today ?? "0"),
          sales_month: dbRupiah(s?.sales_month ?? "0"),
          sales_count_month: Number(s?.sales_count_month ?? 0),
          sales_total: dbRupiah(s?.sales_total ?? "0"),
          last_sale_at: s?.last_sale_at ?? null,
        };
      }),
    };
  },

  /** Suspending blocks login and ends the session of every user of that shop on their next request. */
  async setStatus(id: string, status: unknown): Promise<void> {
    await assertPlatformAdmin();
    if (!isUuid(id)) throw new AppError("NOT_FOUND", "Toko tidak ditemukan.");
    if (!isSwitchableStatus(status)) throw new AppError("VALIDATION_ERROR", "Status tidak valid.");
    const { data, error } = await createSupabaseAdminClient().from("gold_tenants").update({ status }).eq("id", id).select("id");
    if (error) throw mapDbError(error);
    if (!data?.length) throw new AppError("NOT_FOUND", "Toko tidak ditemukan.");
  },

  async setPlan(id: string, plan: unknown): Promise<void> {
    await assertPlatformAdmin();
    if (!isUuid(id)) throw new AppError("NOT_FOUND", "Toko tidak ditemukan.");
    if (!isTenantPlan(plan)) throw new AppError("VALIDATION_ERROR", "Paket tidak valid.");
    const { data, error } = await createSupabaseAdminClient().from("gold_tenants").update({ plan }).eq("id", id).select("id");
    if (error) throw mapDbError(error);
    if (!data?.length) throw new AppError("NOT_FOUND", "Toko tidak ditemukan.");
  },

  /** Creates a shop with its first outlet and OWNER account (the app owner hands the login to the customer). */
  async create(raw: Parameters<typeof validateRegister>[0] & { plan?: unknown }): Promise<string> {
    await assertPlatformAdmin();
    const parsed = validateRegister(raw);
    const errors = parsed.valid ? {} : { ...parsed.errors };
    const plan = raw.plan === undefined || raw.plan === "" ? "FREE" : raw.plan;
    if (!isTenantPlan(plan)) errors.plan = "Pilih paket";
    if (!parsed.valid || Object.keys(errors).length) {
      throw new AppError("VALIDATION_ERROR", "Periksa kembali isian Anda.", errors);
    }

    const { tenantId } = await provisionTenant(parsed.data);
    if (plan !== "FREE") {
      const { error } = await createSupabaseAdminClient().from("gold_tenants").update({ plan }).eq("id", tenantId);
      if (error) console.error("[platform] could not set plan for new tenant", tenantId, error.message);
    }
    return tenantId;
  },
};
