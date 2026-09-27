import { isUuid, optionalText, parseRupiah, str, type FieldErrors, type ValidationResult } from "./common";
import { validateBuybackItems, validatePaymentRows, type BuybackItemInput } from "./buyback";
import type { PaymentMethod } from "@/lib/payments";

export type TradeInInput = {
  store_id: string;
  customer_id: string;
  buy_items: BuybackItemInput[];
  sell_items: { inventory_id: string; discount: string }[];
  payments: { method: PaymentMethod; amount: string; reference: string | null }[];
  expected_balance: string; // may be negative (store pays the customer)
  notes: string | null;
};

/** Signed integer rupiah ("-600.000" -> "-600000"). */
export function parseSignedRupiah(value: unknown): string | null {
  const s = str(value);
  const negative = s.startsWith("-");
  const v = parseRupiah(negative ? s.slice(1) : s);
  if (v === null) return null;
  return negative && v !== "0" ? `-${v}` : v;
}

export function validateTradeIn(raw: {
  storeId?: unknown;
  customerId?: unknown;
  buyItems?: unknown;
  sellItems?: unknown;
  payments?: unknown;
  expectedBalance?: unknown;
  notes?: unknown;
}): ValidationResult<TradeInInput> {
  const errors: FieldErrors = {};
  const store_id = str(raw.storeId);
  if (!isUuid(store_id)) errors.storeId = "Pilih outlet";
  const customer_id = str(raw.customerId);
  if (!isUuid(customer_id)) errors.customerId = "Customer wajib dipilih";

  const buy_items = validateBuybackItems(raw.buyItems, errors);

  const rawSell = Array.isArray(raw.sellItems) ? raw.sellItems : [];
  if (rawSell.length === 0) errors.sellItems = "Pilih barang baru";
  const seen = new Set<string>();
  const sell_items = rawSell.slice(0, 100).map((it, i) => {
    const o = (it ?? {}) as Record<string, unknown>;
    const id = str(o.inventoryId);
    if (!isUuid(id) || seen.has(id)) errors[`sell.${i}`] = "Barang tidak valid";
    seen.add(id);
    const d = str(o.discount);
    const discount = d === "" ? "0" : parseRupiah(d);
    if (discount === null) errors[`sellDiscount.${i}`] = "Diskon tidak valid";
    return { inventory_id: id, discount: discount ?? "0" };
  });

  const expected = parseSignedRupiah(raw.expectedBalance);
  if (expected === null) errors.expectedBalance = "Selisih tidak valid";
  const payments = validatePaymentRows(raw.payments, errors, expected !== null && expected !== "0" ? "Isi pembayaran selisih" : null);
  const notes = optionalText(raw.notes, 1000, "Catatan", errors, "notes");

  return Object.keys(errors).length
    ? { valid: false, errors }
    : { valid: true, data: { store_id, customer_id, buy_items, sell_items, payments, expected_balance: expected!, notes } };
}
