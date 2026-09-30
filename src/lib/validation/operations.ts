/**
 * Validation for daily operations (cash drawer, expenses, orders, repairs, buyback
 * resale). Pure functions; the database re-checks every rule inside the RPCs.
 */
import { isPaymentMethod, type PaymentMethod } from "@/lib/payments";
import { validatePaymentRows } from "./buyback";
import { isUuid, optionalText, parseDecimal, parseRupiah, requiredText, str, type FieldErrors, type ValidationResult } from "./common";

export const EXPENSE_CATEGORIES = [
  "GAJI",
  "SEWA",
  "LISTRIK_AIR",
  "INTERNET_PULSA",
  "TRANSPORT",
  "PERLENGKAPAN",
  "PERAWATAN",
  "PAJAK",
  "KONSUMSI",
  "LAINNYA",
] as const;
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export const EXPENSE_LABELS: Record<ExpenseCategory, string> = {
  GAJI: "Gaji & bonus",
  SEWA: "Sewa tempat",
  LISTRIK_AIR: "Listrik & air",
  INTERNET_PULSA: "Internet & pulsa",
  TRANSPORT: "Transport & kirim",
  PERLENGKAPAN: "Perlengkapan toko",
  PERAWATAN: "Perawatan & perbaikan",
  PAJAK: "Pajak & retribusi",
  KONSUMSI: "Konsumsi",
  LAINNYA: "Lainnya",
};

export const REPAIR_STATUS_LABELS: Record<string, string> = {
  RECEIVED: "Diterima",
  IN_PROGRESS: "Dikerjakan",
  READY: "Siap diambil",
  PICKED_UP: "Sudah diambil",
  CANCELLED: "Dibatalkan",
};

export const ORDER_STATUS_LABELS: Record<string, string> = {
  OPEN: "Berjalan",
  COMPLETED: "Selesai",
  CANCELLED: "Dibatalkan",
};

type Payments = { method: PaymentMethod; amount: string; reference: string | null }[];

const isDate = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v));

/** Whole rupiah amount; `allowZero` also accepts an empty field as 0. */
export function rupiahField(value: unknown, errors: FieldErrors, key: string, label: string, allowZero = false): string {
  const v = parseRupiah(value);
  if (v === null) {
    if (allowZero && str(value) === "") return "0";
    errors[key] = str(value) === "" ? `${label} wajib diisi` : `${label} tidak valid`;
    return "0";
  }
  if (!allowZero && v === "0") errors[key] = `${label} harus lebih dari 0`;
  return v;
}

/** Optional YYYY-MM-DD; bounds are inclusive YYYY-MM-DD dates. */
export function optionalDate(value: unknown, errors: FieldErrors, key: string, bounds: { notBefore?: string; notAfter?: string } = {}): string | null {
  const v = str(value);
  if (!v) return null;
  if (!isDate(v)) errors[key] = "Tanggal tidak valid";
  else if (bounds.notBefore && v < bounds.notBefore) errors[key] = "Tanggal tidak boleh sebelum hari ini";
  else if (bounds.notAfter && v > bounds.notAfter) errors[key] = "Tanggal tidak boleh setelah hari ini";
  return v;
}

export type ExpenseInput = {
  store_id: string;
  expense_date: string;
  category: ExpenseCategory;
  description: string;
  amount: string;
  method: PaymentMethod;
  reference: string | null;
};

export function validateExpense(raw: Record<string, unknown>, today: string): ValidationResult<ExpenseInput> {
  const errors: FieldErrors = {};
  const store_id = str(raw.storeId);
  if (!isUuid(store_id)) errors.storeId = "Pilih outlet";
  const expense_date = optionalDate(raw.expenseDate, errors, "expenseDate", { notAfter: today }) ?? today;
  const category = str(raw.category);
  if (!(EXPENSE_CATEGORIES as readonly string[]).includes(category)) errors.category = "Pilih kategori";
  const description = requiredText(raw.description, 1, 300, "Keterangan", errors, "description");
  const amount = rupiahField(raw.amount, errors, "amount", "Nominal");
  const method = str(raw.method) || "CASH";
  if (!isPaymentMethod(method)) errors.method = "Metode tidak valid";
  const reference = optionalText(raw.reference, 100, "Referensi", errors, "reference");
  if (Object.keys(errors).length) return { valid: false, errors };
  return {
    valid: true,
    data: { store_id, expense_date, category: category as ExpenseCategory, description, amount, method: method as PaymentMethod, reference },
  };
}

export type OrderInput = {
  store_id: string;
  customer_id: string;
  items: { inventory_id: string; discount: string }[];
  payments: Payments;
  expected_total: string;
  due_date: string | null;
  notes: string | null;
};

export function validateOrder(raw: Record<string, unknown>, today: string): ValidationResult<OrderInput> {
  const errors: FieldErrors = {};
  const store_id = str(raw.storeId);
  if (!isUuid(store_id)) errors.storeId = "Pilih outlet";
  const customer_id = str(raw.customerId);
  if (!isUuid(customer_id)) errors.customerId = "Customer wajib dipilih";
  const items: OrderInput["items"] = [];
  ((Array.isArray(raw.items) ? raw.items : []) as Record<string, unknown>[]).slice(0, 50).forEach((it, i) => {
    const id = str(it?.inventoryId);
    if (!isUuid(id)) errors[`items.${i}`] = "Barang tidak valid";
    const discount = str(it?.discount) === "" ? "0" : parseRupiah(it?.discount);
    if (discount === null) errors[`items.${i}`] = "Diskon tidak valid";
    items.push({ inventory_id: id, discount: discount ?? "0" });
  });
  if (items.length === 0) errors.items = "Pilih minimal satu barang";
  const payments = validatePaymentRows(raw.payments, errors, null);
  const expected_total = parseRupiah(raw.expectedTotal);
  if (expected_total === null) errors.expectedTotal = "Total tidak valid";
  const due_date = optionalDate(raw.dueDate, errors, "dueDate", { notBefore: today });
  const notes = optionalText(raw.notes, 1000, "Catatan", errors, "notes");
  if (Object.keys(errors).length) return { valid: false, errors };
  return { valid: true, data: { store_id, customer_id, items, payments, expected_total: expected_total!, due_date, notes } };
}

export type RepairInput = {
  store_id: string;
  customer_id: string;
  item_description: string;
  service_type: string;
  weight_in: string | null;
  estimated_cost: string;
  due_date: string | null;
  payments: Payments;
  notes: string | null;
};

export function validateRepair(raw: Record<string, unknown>, today: string): ValidationResult<RepairInput> {
  const errors: FieldErrors = {};
  const store_id = str(raw.storeId);
  if (!isUuid(store_id)) errors.storeId = "Pilih outlet";
  const customer_id = str(raw.customerId);
  if (!isUuid(customer_id)) errors.customerId = "Customer wajib dipilih";
  const item_description = requiredText(raw.itemDescription, 1, 300, "Barang", errors, "itemDescription");
  const service_type = requiredText(raw.serviceType, 1, 200, "Jenis servis", errors, "serviceType");
  let weight_in: string | null = null;
  if (str(raw.weightIn)) {
    weight_in = parseDecimal(raw.weightIn, 3);
    if (weight_in === null || /^0+(\.0+)?$/.test(weight_in)) errors.weightIn = "Berat tidak valid";
  }
  const estimated_cost = rupiahField(raw.estimatedCost, errors, "estimatedCost", "Perkiraan biaya", true);
  const due_date = optionalDate(raw.dueDate, errors, "dueDate", { notBefore: today });
  const payments = validatePaymentRows(raw.payments, errors, null);
  const notes = optionalText(raw.notes, 1000, "Catatan", errors, "notes");
  if (Object.keys(errors).length) return { valid: false, errors };
  return { valid: true, data: { store_id, customer_id, item_description, service_type, weight_in, estimated_cost, due_date, payments, notes } };
}

export type ResellInput = { location_id: string | null; labor_cost: string; stone_price: string; margin_amount: string; notes: string | null };

export function validateResell(raw: Record<string, unknown>): ValidationResult<ResellInput> {
  const errors: FieldErrors = {};
  const loc = str(raw.locationId);
  if (loc && !isUuid(loc)) errors.locationId = "Lokasi tidak valid";
  const labor_cost = rupiahField(raw.laborCost, errors, "laborCost", "Ongkos", true);
  const stone_price = rupiahField(raw.stonePrice, errors, "stonePrice", "Harga batu", true);
  const margin_amount = rupiahField(raw.marginAmount, errors, "marginAmount", "Margin", true);
  const notes = optionalText(raw.notes, 1000, "Catatan", errors, "notes");
  if (Object.keys(errors).length) return { valid: false, errors };
  return { valid: true, data: { location_id: loc || null, labor_cost, stone_price, margin_amount, notes } };
}
