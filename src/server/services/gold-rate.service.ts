import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AppError } from "@/lib/action-result";
import { validateGoldRates } from "@/lib/gold-rate";
import { isUuid } from "@/lib/validation/common";
import { getAppSession, requirePermission } from "@/server/auth/session";
import { mapDbError } from "@/server/db-errors";
import { goldRateRepository } from "@/server/repositories/gold-rate.repository";

async function requireMember() {
  const session = await getAppSession();
  if (!session) throw new AppError("UNAUTHENTICATED", "Sesi berakhir. Silakan login kembali.");
  return session;
}

export const goldRateService = {
  async current() {
    await requireMember();
    const supabase = await createSupabaseServerClient();
    try {
      return await goldRateRepository.listCurrent(supabase);
    } catch (e) {
      throw mapDbError(e);
    }
  },

  async history(params: { purityId?: string; page?: number }) {
    await requireMember();
    const supabase = await createSupabaseServerClient();
    try {
      return await goldRateRepository.history(supabase, { ...params, purityId: isUuid(params.purityId) ? params.purityId : undefined });
    } catch (e) {
      throw mapDbError(e);
    }
  },

  /** Records a new set of rates. Old rates are never modified (history). */
  async update(raw: Record<string, unknown>) {
    await requirePermission("gold_rates.manage");
    const supabase = await createSupabaseServerClient();
    let purityIds: string[];
    try {
      purityIds = (await goldRateRepository.listCurrent(supabase)).map((p) => p.purity_id);
    } catch (e) {
      throw mapDbError(e);
    }
    const parsed = validateGoldRates(raw, purityIds);
    if (!parsed.valid) {
      throw new AppError("VALIDATION_ERROR", parsed.errors._form ?? "Periksa kembali harga yang diisi.", parsed.errors);
    }
    try {
      await goldRateRepository.insertMany(supabase, parsed.data);
    } catch (e) {
      throw mapDbError(e);
    }
    return parsed.data.length;
  },

  async productPrices(productIds: string[]) {
    const supabase = await createSupabaseServerClient();
    try {
      return await goldRateRepository.productPrices(supabase, productIds);
    } catch (e) {
      throw mapDbError(e);
    }
  },

  async quoteProduct(productId: string) {
    await requireMember();
    if (!isUuid(productId)) return null;
    const supabase = await createSupabaseServerClient();
    try {
      return await goldRateRepository.quoteProduct(supabase, productId);
    } catch (e) {
      throw mapDbError(e);
    }
  },
};
