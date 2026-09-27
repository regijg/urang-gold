import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AppError } from "@/lib/action-result";
import { compareDecimal, isUuid, optionalText, parseDecimal, str } from "@/lib/validation/common";
import { getAppSession, requirePermission } from "@/server/auth/session";
import { mapDbError } from "@/server/db-errors";

export type OpnameStatus = "OPEN" | "SUBMITTED" | "APPROVED" | "CANCELLED";

export type OpnameRow = {
  id: string;
  opname_number: string;
  status: OpnameStatus;
  store_id: string;
  location_id: string | null;
  system_count: number;
  system_weight: string;
  physical_count: number;
  physical_weight: string;
  diff_count: number;
  diff_weight: string;
  estimated_value: string;
  notes: string | null;
  review_notes: string | null;
  started_at: string;
  submitted_at: string | null;
  approved_at: string | null;
  store: { name: string } | null;
  location: { code: string } | null;
};

export type OpnameItem = {
  id: string;
  inventory_id: string;
  in_snapshot: boolean;
  system_status: string;
  system_gross_weight: string;
  found: boolean;
  physical_gross_weight: string | null;
  counted_at: string | null;
  result: string | null;
  inventory: { barcode: string; name: string } | null;
};

const one = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? (v[0] ?? null) : v);
const SELECT =
  "id, opname_number, status, store_id, location_id, system_count, system_weight, physical_count, physical_weight, diff_count, diff_weight, " +
  "estimated_value, notes, review_notes, started_at, submitted_at, approved_at, store:gold_stores(name), location:gold_locations(code)";

async function readAccess() {
  const session = await getAppSession();
  if (!session) throw new AppError("UNAUTHENTICATED", "Sesi berakhir. Silakan login kembali.");
  if (!["stock_opname.manage", "stock_opname.approve", "reports.view"].some((p) => session.permissions.includes(p as never))) {
    throw new AppError("FORBIDDEN", "Anda tidak memiliki akses untuk tindakan ini.");
  }
}

function normalize(r: Record<string, unknown>): OpnameRow {
  return { ...(r as unknown as OpnameRow), store: one(r.store as OpnameRow["store"]), location: one(r.location as OpnameRow["location"]) };
}

async function rpc<T = unknown>(fn: string, args: Record<string, unknown>): Promise<T> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw mapDbError(error);
  return data as T;
}

export const stockOpnameService = {
  async list(): Promise<OpnameRow[]> {
    await readAccess();
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.from("gold_stock_opnames").select(SELECT).order("started_at", { ascending: false }).limit(100);
    if (error) throw mapDbError(error);
    return ((data ?? []) as unknown as Record<string, unknown>[]).map(normalize);
  },

  async get(id: string): Promise<{ opname: OpnameRow; items: OpnameItem[] }> {
    await readAccess();
    if (!isUuid(id)) throw new AppError("NOT_FOUND", "Stock opname tidak ditemukan.");
    const supabase = await createSupabaseServerClient();
    const [{ data: o, error: e1 }, { data: items, error: e2 }] = await Promise.all([
      supabase.from("gold_stock_opnames").select(SELECT).eq("id", id).maybeSingle(),
      supabase
        .from("gold_stock_opname_items")
        .select("id, inventory_id, in_snapshot, system_status, system_gross_weight, found, physical_gross_weight, counted_at, result, inventory:gold_inventory(barcode, name)")
        .eq("opname_id", id)
        .order("counted_at", { ascending: false, nullsFirst: false }),
    ]);
    if (e1) throw mapDbError(e1);
    if (e2) throw mapDbError(e2);
    if (!o) throw new AppError("NOT_FOUND", "Stock opname tidak ditemukan.");
    return {
      opname: normalize(o as unknown as Record<string, unknown>),
      items: ((items ?? []) as unknown as (OpnameItem & { inventory: unknown })[]).map((i) => ({
        ...i,
        inventory: one(i.inventory as OpnameItem["inventory"] | OpnameItem["inventory"][]),
      })),
    };
  },

  async start(raw: { storeId?: unknown; locationId?: unknown; notes?: unknown }) {
    await requirePermission("stock_opname.manage");
    const errors: Record<string, string> = {};
    const storeId = str(raw.storeId);
    if (!isUuid(storeId)) errors.storeId = "Pilih outlet";
    const loc = str(raw.locationId);
    if (loc && !isUuid(loc)) errors.locationId = "Lokasi tidak valid";
    const notes = optionalText(raw.notes, 1000, "Catatan", errors, "notes");
    if (Object.keys(errors).length) throw new AppError("VALIDATION_ERROR", "Periksa kembali isian Anda.", errors);
    return rpc<string>("gold_start_stock_opname", { p_store_id: storeId, p_location_id: loc || null, p_notes: notes });
  },

  async scan(id: string, barcode: unknown, weight: unknown) {
    await requirePermission("stock_opname.manage");
    if (!isUuid(id)) throw new AppError("NOT_FOUND", "Stock opname tidak ditemukan.");
    const code = str(barcode).toUpperCase();
    if (!/^[A-Z0-9-]{3,40}$/.test(code)) throw new AppError("VALIDATION_ERROR", "Barcode tidak valid.");
    let w: string | null = null;
    if (str(weight)) {
      w = parseDecimal(weight, 3);
      if (w === null || compareDecimal(w, "0") <= 0) throw new AppError("VALIDATION_ERROR", "Berat tidak valid.");
    }
    const rows = await rpc<{ barcode: string; name: string; in_snapshot: boolean; system_gross_weight: string; physical_gross_weight: string }[]>(
      "gold_opname_scan",
      { p_opname_id: id, p_barcode: code, p_gross_weight: w }
    );
    return rows[0];
  },

  async unscan(id: string, inventoryId: string) {
    await requirePermission("stock_opname.manage");
    if (!isUuid(id) || !isUuid(inventoryId)) throw new AppError("NOT_FOUND", "Data tidak ditemukan.");
    await rpc("gold_opname_unscan", { p_opname_id: id, p_inventory_id: inventoryId });
  },

  async submit(id: string) {
    await requirePermission("stock_opname.manage");
    if (!isUuid(id)) throw new AppError("NOT_FOUND", "Stock opname tidak ditemukan.");
    await rpc("gold_submit_stock_opname", { p_opname_id: id });
  },

  async approve(id: string, notes: unknown) {
    await requirePermission("stock_opname.approve");
    if (!isUuid(id)) throw new AppError("NOT_FOUND", "Stock opname tidak ditemukan.");
    return rpc<number>("gold_approve_stock_opname", { p_opname_id: id, p_review_notes: str(notes).slice(0, 1000) || null });
  },

  async review(id: string, action: "REJECT" | "CANCEL", notes: unknown) {
    await requirePermission(action === "REJECT" ? "stock_opname.approve" : "stock_opname.manage");
    if (!isUuid(id)) throw new AppError("NOT_FOUND", "Stock opname tidak ditemukan.");
    await rpc("gold_review_stock_opname", { p_opname_id: id, p_action: action, p_review_notes: str(notes).slice(0, 1000) || null });
  },
};
