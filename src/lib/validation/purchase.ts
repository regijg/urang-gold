import { compareDecimal, isUuid, optionalText, parseDecimal, parseRupiah, str, type FieldErrors, type ValidationResult } from "./common";
import { validatePaymentRows } from "./buyback";
import type { PaymentMethod } from "@/lib/payments";

export type PurchaseItemInput = {
  product_id: string;
  gross_weight: string;
  stone_weight: string | null;
  serial_number: string | null;
  cost_price: string;
  labor_cost: string;
};

export type PurchaseInput = {
  store_id: string;
  location_id: string | null;
  supplier_id: string;
  supplier_invoice: string | null;
  purchase_date: string; // YYYY-MM-DD
  items: PurchaseItemInput[];
  payments: { method: PaymentMethod; amount: string; reference: string | null }[];
  notes: string | null;
};

type RawItem = { productId?: unknown; grossWeight?: unknown; stoneWeight?: unknown; serialNumber?: unknown; costPrice?: unknown; laborCost?: unknown };

/** today in Asia/Jakarta as YYYY-MM-DD */
export function todayJakarta(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(now);
}

export function validatePurchase(raw: {
  storeId?: unknown;
  locationId?: unknown;
  supplierId?: unknown;
  supplierInvoice?: unknown;
  purchaseDate?: unknown;
  items?: unknown;
  payments?: unknown;
  notes?: unknown;
}, today = todayJakarta()): ValidationResult<PurchaseInput> {
  const errors: FieldErrors = {};
  const store_id = str(raw.storeId);
  if (!isUuid(store_id)) errors.storeId = "Pilih outlet";
  const loc = str(raw.locationId);
  if (loc && !isUuid(loc)) errors.locationId = "Lokasi tidak valid";
  const supplier_id = str(raw.supplierId);
  if (!isUuid(supplier_id)) errors.supplierId = "Pilih supplier";
  const supplier_invoice = optionalText(raw.supplierInvoice, 60, "No. invoice", errors, "supplierInvoice");
  const date = str(raw.purchaseDate);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date))) errors.purchaseDate = "Tanggal tidak valid";
  else if (date > today) errors.purchaseDate = "Tanggal tidak boleh di masa depan";

  const rawItems = (Array.isArray(raw.items) ? raw.items : []) as RawItem[];
  const items: PurchaseItemInput[] = [];
  rawItems.slice(0, 200).forEach((it, i) => {
    const g = str(it.grossWeight);
    const c = str(it.costPrice);
    if (!str(it.productId) && !g && !c) return; // empty row
    const product_id = str(it.productId);
    if (!isUuid(product_id)) errors[`productId.${i}`] = "Pilih produk";
    const gross = parseDecimal(g, 3);
    if (gross === null || compareDecimal(gross, "0") <= 0) errors[`grossWeight.${i}`] = "Berat wajib > 0";
    const stone = str(it.stoneWeight) === "" ? null : parseDecimal(it.stoneWeight, 3);
    if (str(it.stoneWeight) !== "" && stone === null) errors[`stoneWeight.${i}`] = "Tidak valid";
    else if (stone !== null && gross !== null && compareDecimal(stone, gross) >= 0) errors[`stoneWeight.${i}`] = "Harus < berat";
    const cost = parseRupiah(c);
    if (cost === null) errors[`costPrice.${i}`] = "Harga modal wajib";
    const labor = str(it.laborCost) === "" ? "0" : parseRupiah(it.laborCost);
    if (labor === null) errors[`laborCost.${i}`] = "Ongkos tidak valid";
    const serial = optionalText(it.serialNumber, 60, "No. seri", errors, `serialNumber.${i}`);
    items.push({ product_id, gross_weight: gross ?? "0", stone_weight: stone, serial_number: serial, cost_price: cost ?? "0", labor_cost: labor ?? "0" });
  });
  if (items.length === 0) errors.items = "Isi minimal satu barang";
  if (rawItems.length > 200) errors.items = "Maksimal 200 barang per pembelian";

  const payments = validatePaymentRows(raw.payments, errors, null);
  const notes = optionalText(raw.notes, 1000, "Catatan", errors, "notes");

  return Object.keys(errors).length
    ? { valid: false, errors }
    : { valid: true, data: { store_id, location_id: loc || null, supplier_id, supplier_invoice, purchase_date: date, items, payments, notes } };
}
