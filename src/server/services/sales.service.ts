import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AppError } from "@/lib/action-result";
import { dbRupiah, isUuid, str } from "@/lib/validation/common";
import { validateCustomer } from "@/lib/validation/master-data";
import { validateCheckout } from "@/lib/validation/sales";
import { getAppSession, requirePermission } from "@/server/auth/session";
import { mapDbError } from "@/server/db-errors";
import { providerFor } from "@/server/payments/provider";
import { customerRepository } from "@/server/repositories/master-data.repository";
import { salesRepository } from "@/server/repositories/sales.repository";

async function db<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    throw mapDbError(e, [{ constraint: "gold_customers_tenant_phone_uidx", field: "phone", message: "Nomor HP sudah terdaftar" }]);
  }
}

function notFound(): never {
  throw new AppError("NOT_FOUND", "Transaksi tidak ditemukan.");
}

export const salesService = {
  // ---- POS lookups -----------------------------------------------------------
  async lookupBarcode(storeId: string, barcode: string) {
    await requirePermission("pos.use");
    const code = str(barcode).toUpperCase();
    if (!isUuid(storeId) || !/^[A-Z0-9-]{3,40}$/.test(code)) throw new AppError("NOT_FOUND", "Barcode tidak valid.");
    const supabase = await createSupabaseServerClient();
    const item = await db(() => salesRepository.findAvailableByBarcode(supabase, storeId, code));
    if (!item) throw new AppError("ITEM_NOT_AVAILABLE", `Barang ${code} tidak tersedia di outlet ini.`);
    return item;
  },

  async searchItems(storeId: string, q: string) {
    await requirePermission("pos.use");
    if (!isUuid(storeId)) return [];
    const supabase = await createSupabaseServerClient();
    return db(() => salesRepository.searchAvailable(supabase, storeId, q));
  },

  async searchCustomers(q: string) {
    await requirePermission("customers.manage");
    const supabase = await createSupabaseServerClient();
    return db(() => salesRepository.searchCustomers(supabase, q));
  },

  async quickCreateCustomer(raw: { name?: unknown; phone?: unknown }) {
    await requirePermission("customers.manage");
    const parsed = validateCustomer({ name: raw.name, phone: raw.phone, isActive: "on" });
    if (!parsed.valid) throw new AppError("VALIDATION_ERROR", Object.values(parsed.errors)[0], parsed.errors);
    const supabase = await createSupabaseServerClient();
    const { id } = await db(() => customerRepository.insert(supabase, parsed.data));
    return { id, name: parsed.data.name, phone: parsed.data.phone };
  },

  // ---- Checkout ----------------------------------------------------------------
  async checkout(raw: Parameters<typeof validateCheckout>[0]) {
    await requirePermission("pos.use");
    const parsed = validateCheckout(raw);
    if (!parsed.valid) {
      throw new AppError("VALIDATION_ERROR", parsed.errors.items ?? parsed.errors.payments ?? "Periksa kembali transaksi.", parsed.errors);
    }
    // Payment providers confirm/prepare each payment before the DB commit.
    const payments = await Promise.all(parsed.data.payments.map((p) => providerFor(p.method).prepare(p)));
    const supabase = await createSupabaseServerClient();
    try {
      return await salesRepository.create(supabase, parsed.data, payments);
    } catch (e) {
      const msg = (e as { message?: string })?.message ?? "";
      if (msg.startsWith("PRICE_CHANGED")) {
        const newTotal = dbRupiah(msg.split(":")[1]?.trim());
        throw new AppError("PRICE_CHANGED", "Harga emas berubah. Periksa total terbaru lalu simpan ulang.", { expectedTotal: newTotal });
      }
      throw mapDbError(e);
    }
  },

  async void(id: string, reason: unknown) {
    await requirePermission("sales.void");
    if (!isUuid(id)) notFound();
    const r = str(reason);
    if (!r) throw new AppError("VALIDATION_ERROR", "Alasan pembatalan wajib diisi.", { reason: "Wajib diisi" });
    if (r.length > 500) throw new AppError("VALIDATION_ERROR", "Alasan maksimal 500 karakter.", { reason: "Maksimal 500 karakter" });
    const supabase = await createSupabaseServerClient();
    await db(() => salesRepository.void(supabase, id, r));
  },

  // ---- Reads ---------------------------------------------------------------------
  async list(params: { q?: string; page?: number; storeId?: string; status?: string; from?: string; to?: string }) {
    const session = await getAppSession();
    if (!session) throw new AppError("UNAUTHENTICATED", "Sesi berakhir. Silakan login kembali.");
    if (!session.permissions.includes("sales.manage") && !session.permissions.includes("reports.view")) {
      throw new AppError("FORBIDDEN", "Anda tidak memiliki akses untuk tindakan ini.");
    }
    const supabase = await createSupabaseServerClient();
    return db(() =>
      salesRepository.list(supabase, {
        ...params,
        storeId: isUuid(params.storeId) ? params.storeId : undefined,
        status: params.status === "COMPLETED" || params.status === "VOIDED" ? params.status : undefined,
      })
    );
  },

  async get(id: string) {
    if (!isUuid(id)) notFound();
    const session = await getAppSession();
    if (!session) throw new AppError("UNAUTHENTICATED", "Sesi berakhir. Silakan login kembali.");
    const supabase = await createSupabaseServerClient();
    const sale = await db(() => salesRepository.getById(supabase, id));
    if (!sale) notFound();
    return sale;
  },

  /** Public e-nota (token = random uuid, no login). */
  async receipt(token: string) {
    if (!isUuid(token)) return null;
    const supabase = await createSupabaseServerClient();
    return db(() => salesRepository.receipt(supabase, token));
  },
};
