/**
 * Validation for inventory / location / store forms (pure).
 * Weights -> decimal strings (3 dp), money -> integer-rupiah strings.
 */
import {
  bool,
  compareDecimal,
  isUuid,
  normalizePhone,
  optionalText,
  parseDecimal,
  parseRupiah,
  requiredText,
  str,
  type FieldErrors,
  type ValidationResult,
} from "./common";

type Raw = Record<string, unknown>;

function result<T>(errors: FieldErrors, data: T): ValidationResult<T> {
  return Object.keys(errors).length ? { valid: false, errors } : { valid: true, data };
}

function money(value: unknown, label: string, errors: FieldErrors, key: string): string {
  if (str(value) === "") return "0";
  const v = parseRupiah(value);
  if (v === null) {
    errors[key] = `${label} harus berupa angka rupiah`;
    return "0";
  }
  return v;
}

// ---------------------------------------------------------------------------
/** null stone_weight / cost_price = follow the product's value (resolved in the database). */
export type ReceivePiece = { gross_weight: string; stone_weight: string | null; serial_number: string | null; cost_price: string | null };
export type ReceiveInput = { store_id: string; location_id: string | null; product_id: string; items: ReceivePiece[]; notes: string | null };

export const MAX_PIECES_PER_RECEIVE = 200;

/**
 * Rows come as parallel arrays (grossWeight[i], stoneWeight[i], serialNumber[i], costPrice[i]).
 * Fully empty rows are skipped. Errors are keyed `grossWeight.<i>` etc.
 */
export function validateReceive(raw: {
  storeId?: unknown;
  locationId?: unknown;
  productId?: unknown;
  notes?: unknown;
  grossWeight: unknown[];
  stoneWeight: unknown[];
  serialNumber: unknown[];
  costPrice: unknown[];
}): ValidationResult<ReceiveInput> {
  const errors: FieldErrors = {};
  const store_id = str(raw.storeId);
  if (!isUuid(store_id)) errors.storeId = "Pilih outlet";
  const loc = str(raw.locationId);
  if (loc && !isUuid(loc)) errors.locationId = "Lokasi tidak valid";
  const product_id = str(raw.productId);
  if (!isUuid(product_id)) errors.productId = "Pilih produk";
  const notes = optionalText(raw.notes, 1000, "Catatan", errors, "notes");

  const items: ReceivePiece[] = [];
  const rows = Math.max(raw.grossWeight.length, raw.stoneWeight.length, raw.serialNumber.length, raw.costPrice.length);
  for (let i = 0; i < rows; i++) {
    const g = str(raw.grossWeight[i]);
    const s = str(raw.stoneWeight[i]);
    const sn = str(raw.serialNumber[i]);
    const c = str(raw.costPrice[i]);
    if (!g && !s && !sn && !c) continue;

    const gross = parseDecimal(g, 3);
    const grossOk = gross !== null && compareDecimal(gross, "0") > 0;
    if (!grossOk) errors[`grossWeight.${i}`] = "Berat wajib > 0";
    const stone = s === "" ? null : parseDecimal(s, 3);
    if (s !== "" && stone === null) errors[`stoneWeight.${i}`] = "Berat batu tidak valid";
    else if (stone !== null && grossOk && compareDecimal(stone, gross!) >= 0) errors[`stoneWeight.${i}`] = "Harus < berat total";
    if (sn.length > 60) errors[`serialNumber.${i}`] = "Maksimal 60 karakter";
    const cost = c === "" ? null : money(c, "Harga modal", errors, `costPrice.${i}`);

    items.push({ gross_weight: gross ?? "0", stone_weight: stone, serial_number: sn || null, cost_price: cost });
  }

  if (items.length === 0 && !errors.productId) errors.items = "Isi minimal satu keping";
  if (items.length > MAX_PIECES_PER_RECEIVE) errors.items = `Maksimal ${MAX_PIECES_PER_RECEIVE} keping sekali input`;

  return result(errors, { store_id, location_id: loc || null, product_id, items, notes });
}

// ---------------------------------------------------------------------------
export const PIECE_STATUSES = ["AVAILABLE", "SOLD", "BUYBACK", "RESERVED", "REPAIR", "MELTED", "DAMAGED", "LOST", "VOIDED"] as const;
export type PieceStatus = (typeof PIECE_STATUSES)[number];

export const STATUS_LABELS: Record<PieceStatus, string> = {
  AVAILABLE: "Tersedia",
  SOLD: "Terjual",
  BUYBACK: "Buyback",
  RESERVED: "Dipesan",
  REPAIR: "Reparasi",
  MELTED: "Dilebur",
  DAMAGED: "Rusak",
  LOST: "Hilang",
  VOIDED: "Batal (buyback dibatalkan)",
};

/** Mirrors the transition table in gold_inventory_change_status (DB is authoritative). */
export const STATUS_TRANSITIONS: Record<PieceStatus, PieceStatus[]> = {
  AVAILABLE: ["REPAIR", "MELTED", "DAMAGED", "LOST"],
  BUYBACK: ["AVAILABLE", "REPAIR", "MELTED", "DAMAGED", "LOST"],
  DAMAGED: ["AVAILABLE", "REPAIR", "MELTED", "LOST"],
  REPAIR: ["AVAILABLE", "DAMAGED", "MELTED", "LOST"],
  LOST: ["AVAILABLE"],
  SOLD: [],
  RESERVED: [],
  MELTED: [],
  VOIDED: [],
};

export const MOVEMENT_LABELS: Record<string, string> = {
  PURCHASE: "Pembelian",
  SALE: "Penjualan",
  BUYBACK: "Buyback",
  TRADE_IN: "Tukar tambah",
  TRANSFER: "Transfer",
  ADJUSTMENT: "Penyesuaian",
  STOCK_OPNAME: "Stock opname",
  REPAIR_OUT: "Keluar reparasi",
  REPAIR_IN: "Masuk reparasi",
  MELT: "Lebur",
  RETURN: "Retur",
};

export function isPieceStatus(v: unknown): v is PieceStatus {
  return typeof v === "string" && (PIECE_STATUSES as readonly string[]).includes(v);
}

export type StatusChangeInput = { to_status: PieceStatus; new_gross_weight: string | null; notes: string | null };

export function validateStatusChange(raw: Raw, current: PieceStatus): ValidationResult<StatusChangeInput> {
  const errors: FieldErrors = {};
  const to = str(raw.toStatus);
  if (!isPieceStatus(to) || !STATUS_TRANSITIONS[current].includes(to)) errors.toStatus = "Status tujuan tidak diizinkan";
  const w = str(raw.newGrossWeight);
  let weight: string | null = null;
  if (w) {
    weight = parseDecimal(w, 3);
    if (weight === null || compareDecimal(weight, "0") <= 0) errors.newGrossWeight = "Berat tidak valid";
  }
  const notes = optionalText(raw.notes, 1000, "Catatan", errors, "notes");
  if ((to === "LOST" || to === "DAMAGED" || to === "MELTED") && !notes) errors.notes = "Alasan wajib diisi";
  return result(errors, { to_status: (to || "AVAILABLE") as PieceStatus, new_gross_weight: weight, notes });
}

// ---------------------------------------------------------------------------
export type DetailsInput = {
  name: string;
  serial_number: string | null;
  stone_type: string | null;
  cost_price: string;
  labor_cost: string;
  stone_price: string;
  margin_amount: string;
  notes: string | null;
};

export function validateDetails(raw: Raw): ValidationResult<DetailsInput> {
  const errors: FieldErrors = {};
  return result(errors, {
    name: requiredText(raw.name, 2, 150, "Nama", errors, "name"),
    serial_number: optionalText(raw.serialNumber, 60, "Nomor seri", errors, "serialNumber"),
    stone_type: optionalText(raw.stoneType, 80, "Jenis batu", errors, "stoneType"),
    cost_price: money(raw.costPrice, "Harga modal", errors, "costPrice"),
    labor_cost: money(raw.laborCost, "Ongkos", errors, "laborCost"),
    stone_price: money(raw.stonePrice, "Harga batu", errors, "stonePrice"),
    margin_amount: money(raw.marginAmount, "Margin", errors, "marginAmount"),
    notes: optionalText(raw.notes, 1000, "Catatan", errors, "notes"),
  });
}

// ---------------------------------------------------------------------------
export type TransferInput = { to_store_id: string; to_location_id: string | null; barcodes: string[]; notes: string | null };

/** Barcodes separated by newline, comma or space (scanner input). */
export function parseBarcodeList(value: unknown): string[] {
  return [
    ...new Set(
      str(value)
        .toUpperCase()
        .split(/[\s,;]+/)
        .map((b) => b.trim())
        .filter(Boolean)
    ),
  ];
}

export function validateTransfer(raw: Raw): ValidationResult<TransferInput> {
  const errors: FieldErrors = {};
  const to_store_id = str(raw.toStoreId);
  if (!isUuid(to_store_id)) errors.toStoreId = "Pilih outlet tujuan";
  const loc = str(raw.toLocationId);
  if (loc && !isUuid(loc)) errors.toLocationId = "Lokasi tidak valid";
  const barcodes = parseBarcodeList(raw.barcodes);
  if (barcodes.length === 0) errors.barcodes = "Isi minimal satu barcode";
  else if (barcodes.length > 500) errors.barcodes = "Maksimal 500 barcode sekali transfer";
  else if (barcodes.some((b) => !/^[A-Z0-9-]{3,40}$/.test(b))) errors.barcodes = "Ada barcode dengan format tidak valid";
  return result(errors, { to_store_id, to_location_id: loc || null, barcodes, notes: optionalText(raw.notes, 1000, "Catatan", errors, "notes") });
}

// ---------------------------------------------------------------------------
export const LOCATION_TYPES = ["BAKI", "SLOT", "ETALASE", "GUDANG"] as const;
export type LocationType = (typeof LOCATION_TYPES)[number];
export const LOCATION_TYPE_LABELS: Record<LocationType, string> = { BAKI: "Baki", SLOT: "Slot", ETALASE: "Etalase", GUDANG: "Gudang" };

export type LocationInput = {
  store_id: string;
  parent_id: string | null;
  code: string;
  name: string;
  type: LocationType;
  sort_order: number;
  is_active: boolean;
};

export function validateLocation(raw: Raw): ValidationResult<LocationInput> {
  const errors: FieldErrors = {};
  const store_id = str(raw.storeId);
  if (!isUuid(store_id)) errors.storeId = "Pilih outlet";
  const parent = str(raw.parentId);
  if (parent && !isUuid(parent)) errors.parentId = "Induk tidak valid";
  const code = str(raw.code).toUpperCase();
  if (!/^[A-Z0-9-]{1,20}$/.test(code)) errors.code = "Kode maksimal 20 huruf/angka/-, contoh A-01";
  const type = str(raw.type) as LocationType;
  if (!(LOCATION_TYPES as readonly string[]).includes(type)) errors.type = "Pilih tipe lokasi";
  const so = str(raw.sortOrder);
  const sort_order = so ? Number(so) : 0;
  if (!Number.isInteger(sort_order) || sort_order < 0 || sort_order > 9999) errors.sortOrder = "Urutan 0–9999";
  return result(errors, {
    store_id,
    parent_id: parent || null,
    code,
    name: requiredText(raw.name, 1, 80, "Nama", errors, "name"),
    type,
    sort_order: Number.isInteger(sort_order) ? sort_order : 0,
    is_active: bool(raw.isActive),
  });
}

// ---------------------------------------------------------------------------
export type StoreInput = {
  code: string;
  name: string;
  address: string | null;
  phone: string | null;
  whatsapp: string | null;
  is_active: boolean;
  catalog_enabled: boolean;
};

export function validateStore(raw: Raw): ValidationResult<StoreInput> {
  const errors: FieldErrors = {};
  const code = str(raw.code).toUpperCase();
  if (!/^[A-Z0-9-]{2,20}$/.test(code)) errors.code = "Kode 2–20 huruf/angka/-, contoh JKT-01";
  const phone = normalizePhone(raw.phone);
  if (phone === undefined) errors.phone = "Nomor telepon tidak valid";
  const wa = normalizePhone(raw.whatsapp);
  if (wa === undefined) errors.whatsapp = "Nomor WhatsApp tidak valid";
  return result(errors, {
    code,
    name: requiredText(raw.name, 2, 120, "Nama outlet", errors, "name"),
    address: optionalText(raw.address, 500, "Alamat", errors, "address"),
    phone: phone ?? null,
    whatsapp: wa ?? null,
    is_active: bool(raw.isActive),
    catalog_enabled: bool(raw.catalogEnabled),
  });
}

/** "Toko Emas" + "JKT-01" -> "toko-emas-jkt-01" (catalogue URL slug). */
export function storeSlug(tenantSlug: string, code: string): string {
  return `${tenantSlug}-${code}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}
