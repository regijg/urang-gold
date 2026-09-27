/**
 * Buyback payload validation + display preview (pure). The database recomputes
 * every line (gold_buyback_line) and rejects the save if the expected total differs.
 */
import { isPaymentMethod, type PaymentMethod } from "@/lib/payments";
import {
  compareDecimal,
  isUuid,
  optionalText,
  parseDecimal,
  parseRupiah,
  str,
  type FieldErrors,
  type ValidationResult,
} from "./common";

export type BuybackItemInput = {
  inventory_id: string | null; // SOLD piece of this store being taken back
  name: string | null;
  category_id: string | null;
  purity_id: string | null;
  gross_weight: string | null;
  stone_weight: string | null;
  price_per_gram: string | null; // null = current official buy price
  deduction: string;
};

export type BuybackInput = {
  store_id: string;
  customer_id: string;
  items: BuybackItemInput[];
  payments: { method: PaymentMethod; amount: string; reference: string | null }[];
  expected_total: string;
  notes: string | null;
};

type RawItem = {
  inventoryId?: unknown;
  name?: unknown;
  categoryId?: unknown;
  purityId?: unknown;
  grossWeight?: unknown;
  stoneWeight?: unknown;
  pricePerGram?: unknown;
  deduction?: unknown;
};

export function validateBuyback(raw: {
  storeId?: unknown;
  customerId?: unknown;
  items?: unknown;
  payments?: unknown;
  expectedTotal?: unknown;
  notes?: unknown;
}): ValidationResult<BuybackInput> {
  const errors: FieldErrors = {};
  const store_id = str(raw.storeId);
  if (!isUuid(store_id)) errors.storeId = "Pilih outlet";
  const customer_id = str(raw.customerId);
  if (!isUuid(customer_id)) errors.customerId = "Customer wajib dipilih";

  const items = validateBuybackItems(raw.items, errors);
  const payments = validatePaymentRows(raw.payments, errors, "Isi pembayaran ke customer");

  const expected = parseRupiah(raw.expectedTotal);
  if (expected === null) errors.expectedTotal = "Total tidak valid";
  const notes = optionalText(raw.notes, 1000, "Catatan", errors, "notes");

  return Object.keys(errors).length
    ? { valid: false, errors }
    : { valid: true, data: { store_id, customer_id, items, payments, expected_total: expected!, notes } };
}

/** Validates buyback item rows; errors keyed `<field>.<index>` (+ `items`). */
export function validateBuybackItems(rawValue: unknown, errors: FieldErrors): BuybackItemInput[] {
  const rawItems = (Array.isArray(rawValue) ? rawValue : []) as RawItem[];
  if (rawItems.length === 0) errors.items = "Tambahkan minimal satu barang";
  if (rawItems.length > 50) errors.items = "Maksimal 50 barang";
  return rawItems.slice(0, 50).map((it, i) => {
    const inv = str(it.inventoryId);
    const reuse = isUuid(inv);
    const gross = str(it.grossWeight) === "" ? null : parseDecimal(it.grossWeight, 3);
    const stone = str(it.stoneWeight) === "" ? null : parseDecimal(it.stoneWeight, 3);
    const price = str(it.pricePerGram) === "" ? null : parseRupiah(it.pricePerGram);
    const deduction = str(it.deduction) === "" ? "0" : parseRupiah(it.deduction);

    if (!reuse) {
      if (str(it.name).length < 2) errors[`name.${i}`] = "Nama wajib diisi";
      if (!isUuid(it.categoryId)) errors[`categoryId.${i}`] = "Pilih kategori";
      if (!isUuid(it.purityId)) errors[`purityId.${i}`] = "Pilih kadar";
      if (gross === null) errors[`grossWeight.${i}`] = "Berat wajib diisi";
    }
    if (str(it.grossWeight) !== "" && (gross === null || compareDecimal(gross, "0") <= 0)) errors[`grossWeight.${i}`] = "Berat tidak valid";
    if (str(it.stoneWeight) !== "" && stone === null) errors[`stoneWeight.${i}`] = "Berat batu tidak valid";
    if (gross !== null && stone !== null && compareDecimal(stone, gross) >= 0) errors[`stoneWeight.${i}`] = "Harus < berat total";
    if (str(it.pricePerGram) !== "" && (price === null || price === "0")) errors[`pricePerGram.${i}`] = "Harga tidak valid";
    if (deduction === null) errors[`deduction.${i}`] = "Potongan tidak valid";

    return {
      inventory_id: reuse ? inv : null,
      name: str(it.name) || null,
      category_id: reuse ? null : str(it.categoryId) || null,
      purity_id: reuse ? null : str(it.purityId) || null,
      gross_weight: gross,
      stone_weight: stone,
      price_per_gram: price,
      deduction: deduction ?? "0",
    };
  });
}

/** Payment rows (empty-amount rows skipped). `requiredMessage` null = payments optional. */
export function validatePaymentRows(
  rawValue: unknown,
  errors: FieldErrors,
  requiredMessage: string | null
): { method: PaymentMethod; amount: string; reference: string | null }[] {
  const payments: { method: PaymentMethod; amount: string; reference: string | null }[] = [];
  ((Array.isArray(rawValue) ? rawValue : []) as Record<string, unknown>[]).slice(0, 10).forEach((p, i) => {
    if (!str(p?.amount)) return;
    const method = str(p.method);
    const amount = parseRupiah(p.amount);
    if (!isPaymentMethod(method)) errors[`payments.${i}`] = "Metode tidak valid";
    if (amount === null || amount === "0") errors[`payments.${i}`] = "Nominal tidak valid";
    payments.push({ method: method as PaymentMethod, amount: amount ?? "0", reference: optionalText(p.reference, 100, "Referensi", errors, `reference.${i}`) });
  });
  if (requiredMessage && payments.length === 0) errors.payments = requiredMessage;
  return payments;
}

/**
 * Display preview of one line: gross = round(goldWeight × pricePerGram), net = gross − deduction.
 * Same rounding as gold_buyback_line (half up). Returns null when inputs are incomplete.
 */
export function previewBuybackLine(grossWeight: string, stoneWeight: string, pricePerGram: string, deduction: string) {
  const g = parseDecimal(grossWeight, 3);
  const s = stoneWeight.trim() === "" ? "0" : parseDecimal(stoneWeight, 3);
  const p = parseRupiah(pricePerGram);
  const d = deduction.trim() === "" ? "0" : parseRupiah(deduction);
  if (g === null || s === null || p === null || d === null) return null;
  const milli = (v: string) => {
    const [i, f = ""] = v.split(".");
    return BigInt(i + f.padEnd(3, "0"));
  };
  const goldMilli = milli(g) - milli(s);
  if (goldMilli <= BigInt(0)) return null;
  const scaled = goldMilli * BigInt(p); // rupiah × 1000
  const gross = (scaled * BigInt(2) + BigInt(1000)) / BigInt(2000);
  const net = gross - BigInt(d);
  return { gross: gross.toString(), net: net.toString(), valid: net >= BigInt(0) };
}
