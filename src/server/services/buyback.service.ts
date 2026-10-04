import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AppError } from "@/lib/action-result";
import { dbRupiah, isUuid, str } from "@/lib/validation/common";
import { validateBuyback } from "@/lib/validation/buyback";
import { getAppSession, requirePermission } from "@/server/auth/session";
import { cashService } from "@/server/services/cash.service";
import { mapDbError } from "@/server/db-errors";
import { providerFor } from "@/server/payments/provider";
import { buybackRepository } from "@/server/repositories/buyback.repository";

async function db<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    throw mapDbError(e);
  }
}
function notFound(): never {
  throw new AppError("NOT_FOUND", "Transaksi buyback tidak ditemukan.");
}

function priceChanged(e: unknown): AppError | null {
  const msg = (e as { message?: string })?.message ?? "";
  if (!msg.startsWith("PRICE_CHANGED")) return null;
  return new AppError("PRICE_CHANGED", "Harga buyback berubah. Periksa total terbaru lalu simpan ulang.", {
    expectedTotal: dbRupiah(msg.split(":")[1]?.trim()),
  });
}

export const buybackService = {
  async create(raw: Parameters<typeof validateBuyback>[0]) {
    await requirePermission("buybacks.manage");
    const parsed = validateBuyback(raw);
    if (!parsed.valid) {
      throw new AppError("VALIDATION_ERROR", parsed.errors.customerId ?? parsed.errors.items ?? parsed.errors.payments ?? "Periksa kembali isian Anda.", parsed.errors);
    }
    await cashService.requireOpen(parsed.data.store_id);
    const payments = await Promise.all(parsed.data.payments.map((p) => providerFor(p.method).prepare(p)));
    const supabase = await createSupabaseServerClient();
    try {
      return await buybackRepository.create(supabase, parsed.data, payments);
    } catch (e) {
      throw priceChanged(e) ?? mapDbError(e);
    }
  },

  async void(id: string, reason: unknown) {
    await requirePermission("sales.void");
    if (!isUuid(id)) notFound();
    const r = str(reason);
    if (!r || r.length > 500) throw new AppError("VALIDATION_ERROR", "Alasan wajib diisi (maks. 500 karakter).", { reason: "Wajib diisi" });
    const supabase = await createSupabaseServerClient();
    await db(() => buybackRepository.void(supabase, id, r));
  },

  async list(params: { q?: string; page?: number; storeId?: string; status?: string }) {
    const session = await getAppSession();
    if (!session) throw new AppError("UNAUTHENTICATED", "Sesi berakhir. Silakan login kembali.");
    if (!session.permissions.includes("buybacks.manage") && !session.permissions.includes("reports.view")) {
      throw new AppError("FORBIDDEN", "Anda tidak memiliki akses untuk tindakan ini.");
    }
    const supabase = await createSupabaseServerClient();
    return db(() =>
      buybackRepository.list(supabase, {
        ...params,
        storeId: isUuid(params.storeId) ? params.storeId : undefined,
        status: params.status === "COMPLETED" || params.status === "VOIDED" ? params.status : undefined,
      })
    );
  },

  async get(id: string) {
    if (!isUuid(id)) notFound();
    if (!(await getAppSession())) throw new AppError("UNAUTHENTICATED", "Sesi berakhir. Silakan login kembali.");
    const supabase = await createSupabaseServerClient();
    const row = await db(() => buybackRepository.getById(supabase, id));
    if (!row) notFound();
    return row;
  },

  async findSoldPiece(barcode: string) {
    await requirePermission("buybacks.manage");
    const code = str(barcode).toUpperCase();
    if (!/^[A-Z0-9-]{3,40}$/.test(code)) throw new AppError("NOT_FOUND", "Barcode tidak valid.");
    const supabase = await createSupabaseServerClient();
    const piece = await db(() => buybackRepository.findSoldByBarcode(supabase, code));
    if (!piece) throw new AppError("NOT_FOUND", `Barang terjual dengan barcode ${code} tidak ditemukan.`);
    return piece;
  },

  async receipt(token: string) {
    if (!isUuid(token)) return null;
    const supabase = await createSupabaseServerClient();
    return db(() => buybackRepository.receipt(supabase, token));
  },
};
