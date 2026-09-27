import type { SupabaseClient } from "@supabase/supabase-js";
import { sanitizeSearch } from "@/lib/validation/common";
import type { DetailsInput, PieceStatus, ReceiveInput, StatusChangeInput } from "@/lib/validation/inventory";
import { PAGE_SIZE, type ListResult } from "./crud";

export type InventoryRow = {
  id: string;
  store_id: string;
  location_id: string | null;
  product_id: string | null;
  category_id: string;
  purity_id: string;
  barcode: string;
  serial_number: string | null;
  name: string;
  gross_weight: string;
  stone_weight: string;
  gold_weight: string;
  stone_type: string | null;
  cost_price: string;
  labor_cost: string;
  stone_price: string;
  margin_amount: string;
  status: PieceStatus;
  source: string;
  notes: string | null;
  received_at: string;
  store: { id: string; name: string } | null;
  location: { id: string; code: string; name: string } | null;
  category: { id: string; name: string } | null;
  purity: { id: string; code: string } | null;
  product: { id: string; sku: string; photo_path: string | null } | null;
};

export type MovementRow = {
  id: number;
  inventory_id: string;
  movement_type: string;
  quantity: number;
  weight: string;
  before_weight: string | null;
  after_weight: string | null;
  from_status: string | null;
  to_status: string | null;
  from_store_id: string | null;
  to_store_id: string | null;
  from_location_id: string | null;
  to_location_id: string | null;
  reference_type: string | null;
  reference_id: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  inventory: { id: string; barcode: string; name: string } | null;
};

const SELECT =
  "id, store_id, location_id, product_id, category_id, purity_id, barcode, serial_number, name, " +
  "gross_weight, stone_weight, gold_weight, stone_type, cost_price, labor_cost, stone_price, margin_amount, " +
  "status, source, notes, received_at, " +
  "store:gold_stores(id, name), location:gold_locations(id, code, name), category:gold_categories(id, name), " +
  "purity:gold_purities(id, code), product:gold_products(id, sku, photo_path)";

const one = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? (v[0] ?? null) : v);

function normalize(r: Record<string, unknown>): InventoryRow {
  return {
    ...(r as unknown as InventoryRow),
    store: one(r.store as InventoryRow["store"]),
    location: one(r.location as InventoryRow["location"]),
    category: one(r.category as InventoryRow["category"]),
    purity: one(r.purity as InventoryRow["purity"]),
    product: one(r.product as InventoryRow["product"]),
  };
}

export type InventoryListParams = {
  q?: string;
  page?: number;
  storeId?: string;
  locationId?: string;
  status?: PieceStatus;
  categoryId?: string;
  purityId?: string;
};

type Filterable = { eq(column: string, value: string): Filterable; or(filters: string): Filterable };

// PostgREST builder types are too deep for a generic constraint; narrow to what we use.
function applyFilters<T>(query: T, p: InventoryListParams): T {
  let f = query as unknown as Filterable;
  const q = sanitizeSearch(p.q);
  if (q) f = f.or(`barcode.ilike.%${q}%,name.ilike.%${q}%,serial_number.ilike.%${q}%`);
  if (p.storeId) f = f.eq("store_id", p.storeId);
  if (p.locationId) f = f.eq("location_id", p.locationId);
  if (p.status) f = f.eq("status", p.status);
  if (p.categoryId) f = f.eq("category_id", p.categoryId);
  if (p.purityId) f = f.eq("purity_id", p.purityId);
  return f as unknown as T;
}

export const inventoryRepository = {
  async list(supabase: SupabaseClient, params: InventoryListParams): Promise<ListResult<InventoryRow>> {
    const page = params.page && params.page > 0 ? params.page : 1;
    const from = (page - 1) * PAGE_SIZE;
    const query = applyFilters(supabase.from("gold_inventory").select(SELECT, { count: "exact" }), params);
    const { data, error, count } = await query.order("received_at", { ascending: false }).order("barcode").range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    return { rows: ((data ?? []) as unknown as Record<string, unknown>[]).map(normalize), total: count ?? 0, page, pageSize: PAGE_SIZE };
  },

  /** Count + total gold weight for the current filter (aggregated in SQL under RLS). */
  async summary(supabase: SupabaseClient, p: InventoryListParams): Promise<{ count: number; goldWeight: string }> {
    const { data, error } = await supabase.rpc("gold_inventory_summary", {
      p_store_id: p.storeId ?? null,
      p_location_id: p.locationId ?? null,
      p_status: p.status ?? null,
      p_category_id: p.categoryId ?? null,
      p_purity_id: p.purityId ?? null,
      p_q: sanitizeSearch(p.q) || null,
    });
    if (error) throw error;
    const row = (Array.isArray(data) ? data[0] : data) as { item_count: number | string; gold_weight: string } | undefined;
    return { count: Number(row?.item_count ?? 0), goldWeight: String(row?.gold_weight ?? "0") };
  },

  async getById(supabase: SupabaseClient, id: string): Promise<InventoryRow | null> {
    const { data, error } = await supabase.from("gold_inventory").select(SELECT).eq("id", id).maybeSingle();
    if (error) throw error;
    return data ? normalize(data as unknown as Record<string, unknown>) : null;
  },

  async getByIds(supabase: SupabaseClient, ids: string[]): Promise<InventoryRow[]> {
    if (ids.length === 0) return [];
    const { data, error } = await supabase.from("gold_inventory").select(SELECT).in("id", ids).order("barcode");
    if (error) throw error;
    return ((data ?? []) as unknown as Record<string, unknown>[]).map(normalize);
  },

  async findByBarcodes(supabase: SupabaseClient, barcodes: string[]): Promise<{ id: string; barcode: string }[]> {
    if (barcodes.length === 0) return [];
    const { data, error } = await supabase.from("gold_inventory").select("id, barcode").in("barcode", barcodes);
    if (error) throw error;
    return (data ?? []) as { id: string; barcode: string }[];
  },

  async movements(
    supabase: SupabaseClient,
    params: { inventoryId?: string; type?: string; page?: number }
  ): Promise<ListResult<MovementRow>> {
    const page = params.page && params.page > 0 ? params.page : 1;
    const from = (page - 1) * PAGE_SIZE;
    let query = supabase
      .from("gold_inventory_movements")
      .select("*, inventory:gold_inventory(id, barcode, name)", { count: "exact" });
    if (params.inventoryId) query = query.eq("inventory_id", params.inventoryId);
    if (params.type) query = query.eq("movement_type", params.type);
    const { data, error, count } = await query.order("created_at", { ascending: false }).order("id", { ascending: false }).range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    const rows = ((data ?? []) as unknown as (MovementRow & { inventory: MovementRow["inventory"] | MovementRow["inventory"][] })[]).map(
      (r) => ({ ...r, inventory: one(r.inventory) })
    );
    return { rows, total: count ?? 0, page, pageSize: PAGE_SIZE };
  },

  async prices(supabase: SupabaseClient, ids: string[]): Promise<Map<string, string | null>> {
    if (ids.length === 0) return new Map();
    const { data, error } = await supabase.from("gold_v_inventory_prices").select("inventory_id, sell_price").in("inventory_id", ids);
    if (error) throw error;
    return new Map((data ?? []).map((r) => [r.inventory_id as string, r.sell_price === null ? null : String(r.sell_price)]));
  },

  // --- RPCs (atomic, permission-checked in the database) ---------------------
  async receive(supabase: SupabaseClient, input: ReceiveInput): Promise<{ inventory_id: string; barcode: string }[]> {
    const { data, error } = await supabase.rpc("gold_inventory_receive", {
      p_store_id: input.store_id,
      p_location_id: input.location_id,
      p_product_id: input.product_id,
      p_items: input.items,
      p_notes: input.notes,
    });
    if (error) throw error;
    return (data ?? []) as { inventory_id: string; barcode: string }[];
  },

  async transfer(supabase: SupabaseClient, ids: string[], toStoreId: string, toLocationId: string | null, notes: string | null): Promise<number> {
    const { data, error } = await supabase.rpc("gold_inventory_transfer", {
      p_inventory_ids: ids,
      p_to_store_id: toStoreId,
      p_to_location_id: toLocationId,
      p_notes: notes,
    });
    if (error) throw error;
    return Number(data ?? 0);
  },

  async changeStatus(supabase: SupabaseClient, id: string, input: StatusChangeInput): Promise<void> {
    const { error } = await supabase.rpc("gold_inventory_change_status", {
      p_inventory_id: id,
      p_to_status: input.to_status,
      p_new_gross_weight: input.new_gross_weight,
      p_notes: input.notes,
    });
    if (error) throw error;
  },

  async updateDetails(supabase: SupabaseClient, id: string, input: DetailsInput): Promise<void> {
    const { error } = await supabase.rpc("gold_inventory_update_details", {
      p_inventory_id: id,
      p_name: input.name,
      p_serial_number: input.serial_number,
      p_stone_type: input.stone_type,
      p_cost_price: input.cost_price,
      p_labor_cost: input.labor_cost,
      p_stone_price: input.stone_price,
      p_margin_amount: input.margin_amount,
      p_notes: input.notes,
    });
    if (error) throw error;
  },

  async quote(supabase: SupabaseClient, id: string) {
    const { data, error } = await supabase.rpc("gold_quote_inventory", { p_inventory_id: id, p_discount: 0 });
    if (error) throw error;
    const row = (Array.isArray(data) ? data[0] : data) as
      | { sell_rate: string; gold_value: string; subtotal: string; total: string }
      | undefined;
    return row ?? null;
  },
};
