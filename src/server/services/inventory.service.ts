import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AppError } from "@/lib/action-result";
import type { Permission } from "@/lib/auth/permissions";
import { isUuid } from "@/lib/validation/common";
import { validateResell } from "@/lib/validation/operations";
import {
  isPieceStatus,
  storeSlug,
  validateDetails,
  validateLocation,
  validateReceive,
  validateStatusChange,
  validateStore,
  validateTransfer,
  type PieceStatus,
} from "@/lib/validation/inventory";
import { getAppSession, requirePermission, type AppSession } from "@/server/auth/session";
import { mapDbError } from "@/server/db-errors";
import { inventoryRepository, type InventoryListParams } from "@/server/repositories/inventory.repository";
import { locationRepository } from "@/server/repositories/location.repository";
import { storeRepository } from "@/server/repositories/store.repository";

function invalid(errors: Record<string, string>, message = "Periksa kembali isian Anda."): never {
  throw new AppError("VALIDATION_ERROR", message, errors);
}
function notFound(): never {
  throw new AppError("NOT_FOUND", "Data tidak ditemukan.");
}
async function db<T>(fn: () => Promise<T>, rules?: Parameters<typeof mapDbError>[1]): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    throw mapDbError(e, rules);
  }
}
async function requireAny(permissions: Permission[]): Promise<AppSession> {
  const session = await getAppSession();
  if (!session) throw new AppError("UNAUTHENTICATED", "Sesi berakhir. Silakan login kembali.");
  if (!permissions.some((p) => session.permissions.includes(p))) {
    throw new AppError("FORBIDDEN", "Anda tidak memiliki akses untuk tindakan ini.");
  }
  return session;
}
const uuidOrUndef = (v?: string) => (isUuid(v) ? v : undefined);

// ---------------------------------------------------------------------------
// Stores (outlets)
// ---------------------------------------------------------------------------
export const storeService = {
  async list(opts: { activeOnly?: boolean } = {}) {
    if (!(await getAppSession())) throw new AppError("UNAUTHENTICATED", "Sesi berakhir. Silakan login kembali.");
    const supabase = await createSupabaseServerClient();
    return db(() => storeRepository.list(supabase, opts));
  },

  async get(id: string) {
    await requirePermission("stores.manage");
    if (!isUuid(id)) notFound();
    const supabase = await createSupabaseServerClient();
    const row = await db(() => storeRepository.getById(supabase, id));
    if (!row) notFound();
    return row;
  },

  async create(raw: Record<string, unknown>) {
    const session = await requirePermission("stores.manage");
    const parsed = validateStore(raw);
    if (!parsed.valid) invalid(parsed.errors);
    const supabase = await createSupabaseServerClient();
    return db(
      () =>
        storeRepository.insert(supabase, {
          ...parsed.data,
          tenant_id: session.tenant.id, // RLS re-checks this equals the caller's tenant
          slug: storeSlug(session.tenant.slug, parsed.data.code),
        }),
      [
        { constraint: "gold_stores_tenant_id_code_key", field: "code", message: "Kode outlet sudah dipakai" },
        { constraint: "gold_stores_slug_key", field: "code", message: "Kode outlet bentrok dengan outlet lain, gunakan kode lain" },
      ]
    );
  },

  async update(id: string, raw: Record<string, unknown>) {
    await requirePermission("stores.manage");
    if (!isUuid(id)) notFound();
    const parsed = validateStore(raw);
    if (!parsed.valid) invalid(parsed.errors);
    const supabase = await createSupabaseServerClient();
    const ok = await db(() => storeRepository.update(supabase, id, parsed.data), [
      { constraint: "gold_stores_tenant_id_code_key", field: "code", message: "Kode outlet sudah dipakai" },
    ]);
    if (!ok) notFound();
  },
};

// ---------------------------------------------------------------------------
// Locations (baki)
// ---------------------------------------------------------------------------
export const locationService = {
  async list(params: { storeId?: string; activeOnly?: boolean } = {}) {
    await requireAny(["inventory.view", "pos.use"]);
    const supabase = await createSupabaseServerClient();
    return db(() => locationRepository.list(supabase, { ...params, storeId: uuidOrUndef(params.storeId) }));
  },

  async get(id: string) {
    await requirePermission("inventory.manage");
    if (!isUuid(id)) notFound();
    const supabase = await createSupabaseServerClient();
    const row = await db(() => locationRepository.getById(supabase, id));
    if (!row) notFound();
    return row;
  },

  async save(id: string | null, raw: Record<string, unknown>) {
    await requirePermission("inventory.manage");
    const parsed = validateLocation(raw);
    if (!parsed.valid) invalid(parsed.errors);
    if (id && parsed.data.parent_id === id) invalid({ parentId: "Lokasi tidak boleh menjadi induk dirinya sendiri" });
    const supabase = await createSupabaseServerClient();
    const rules = [{ constraint: "gold_locations_store_id_code_key", field: "code", message: "Kode lokasi sudah dipakai di outlet ini" }];
    if (id) {
      if (!isUuid(id)) notFound();
      const ok = await db(() => locationRepository.update(supabase, id, parsed.data), rules);
      if (!ok) notFound();
      return { id };
    }
    return db(() => locationRepository.insert(supabase, parsed.data), rules);
  },

  async remove(id: string) {
    await requirePermission("inventory.manage");
    if (!isUuid(id)) notFound();
    const supabase = await createSupabaseServerClient();
    const ok = await db(() => locationRepository.remove(supabase, id));
    if (!ok) notFound();
  },
};

// ---------------------------------------------------------------------------
// Inventory
// ---------------------------------------------------------------------------
export type InventoryFilter = Omit<InventoryListParams, "status"> & { status?: string };

function cleanFilter(p: InventoryFilter): InventoryListParams {
  return {
    q: p.q,
    page: p.page,
    storeId: uuidOrUndef(p.storeId),
    locationId: uuidOrUndef(p.locationId),
    categoryId: uuidOrUndef(p.categoryId),
    purityId: uuidOrUndef(p.purityId),
    status: isPieceStatus(p.status) ? p.status : undefined,
  };
}

export const inventoryService = {
  async list(filter: InventoryFilter) {
    await requireAny(["inventory.view", "pos.use"]);
    const supabase = await createSupabaseServerClient();
    const params = cleanFilter(filter);
    const [list, summary] = await db(() => Promise.all([inventoryRepository.list(supabase, params), inventoryRepository.summary(supabase, params)]));
    const prices = await db(() => inventoryRepository.prices(supabase, list.rows.map((r) => r.id)));
    return { ...list, summary, prices };
  },

  async get(id: string) {
    await requireAny(["inventory.view", "pos.use"]);
    if (!isUuid(id)) notFound();
    const supabase = await createSupabaseServerClient();
    const row = await db(() => inventoryRepository.getById(supabase, id));
    if (!row) notFound();
    return row;
  },

  async getMany(ids: string[]) {
    await requireAny(["inventory.view", "pos.use"]);
    const clean = ids.filter(isUuid).slice(0, 200);
    const supabase = await createSupabaseServerClient();
    return db(() => inventoryRepository.getByIds(supabase, clean));
  },

  async quote(id: string) {
    await requireAny(["inventory.view", "pos.use"]);
    if (!isUuid(id)) return null;
    const supabase = await createSupabaseServerClient();
    return db(() => inventoryRepository.quote(supabase, id));
  },

  async movements(params: { inventoryId?: string; type?: string; page?: number }) {
    await requirePermission("inventory.view");
    const supabase = await createSupabaseServerClient();
    return db(() =>
      inventoryRepository.movements(supabase, {
        ...params,
        inventoryId: uuidOrUndef(params.inventoryId),
        type: params.type && /^[A-Z_]{3,20}$/.test(params.type) ? params.type : undefined,
      })
    );
  },

  async receive(raw: Parameters<typeof validateReceive>[0]) {
    await requirePermission("inventory.manage");
    const parsed = validateReceive(raw);
    if (!parsed.valid) invalid(parsed.errors, parsed.errors.items ?? "Periksa kembali isian Anda.");
    const supabase = await createSupabaseServerClient();
    return db(() => inventoryRepository.receive(supabase, parsed.data));
  },

  async changeStatus(id: string, raw: Record<string, unknown>) {
    await requirePermission("inventory.manage");
    const current = await this.get(id);
    const parsed = validateStatusChange(raw, current.status);
    if (!parsed.valid) invalid(parsed.errors);
    const supabase = await createSupabaseServerClient();
    await db(() => inventoryRepository.changeStatus(supabase, id, parsed.data));
  },

  /** Bought-back piece goes back on display with its selling components (one atomic RPC). */
  async resellBuyback(id: string, raw: Record<string, unknown>) {
    await requirePermission("inventory.manage");
    if (!isUuid(id)) notFound();
    const parsed = validateResell(raw);
    if (!parsed.valid) invalid(parsed.errors);
    const d = parsed.data;
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.rpc("gold_buyback_resell", {
      p_inventory_id: id,
      p_location_id: d.location_id,
      p_labor_cost: d.labor_cost,
      p_stone_price: d.stone_price,
      p_margin_amount: d.margin_amount,
      p_notes: d.notes,
    });
    if (error) throw mapDbError(error);
  },

  async updateDetails(id: string, raw: Record<string, unknown>) {
    await requirePermission("inventory.manage");
    if (!isUuid(id)) notFound();
    const parsed = validateDetails(raw);
    if (!parsed.valid) invalid(parsed.errors);
    const supabase = await createSupabaseServerClient();
    await db(() => inventoryRepository.updateDetails(supabase, id, parsed.data));
  },

  /** Transfer by barcode list; unknown barcodes are reported, nothing is moved. */
  async transfer(raw: Record<string, unknown>) {
    await requirePermission("stock_transfer.manage");
    const parsed = validateTransfer(raw);
    if (!parsed.valid) invalid(parsed.errors);
    const supabase = await createSupabaseServerClient();
    const found = await db(() => inventoryRepository.findByBarcodes(supabase, parsed.data.barcodes));
    const known = new Set(found.map((f) => f.barcode));
    const missing = parsed.data.barcodes.filter((b) => !known.has(b));
    if (missing.length) invalid({ barcodes: `Barcode tidak ditemukan: ${missing.slice(0, 10).join(", ")}` }, "Ada barcode yang tidak ditemukan.");
    return db(() =>
      inventoryRepository.transfer(supabase, found.map((f) => f.id), parsed.data.to_store_id, parsed.data.to_location_id, parsed.data.notes)
    );
  },

  async transferOne(id: string, raw: Record<string, unknown>) {
    const item = await this.get(id);
    return this.transfer({ ...raw, barcodes: item.barcode });
  },
};

export type { PieceStatus };
