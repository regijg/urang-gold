/**
 * Validation of the POS checkout payload (pure). Amounts become integer-rupiah
 * strings. The database recomputes every price; this only rejects malformed input.
 */
import { isPaymentMethod, type PaymentMethod } from "@/lib/payments";
import { isUuid, optionalText, parseRupiah, str, type FieldErrors, type ValidationResult } from "./common";

export type CheckoutInput = {
  store_id: string;
  customer_id: string | null;
  items: { inventory_id: string; discount: string }[];
  payments: { method: PaymentMethod; amount: string; reference: string | null }[];
  expected_total: string;
  notes: string | null;
};

type RawCheckout = {
  storeId?: unknown;
  customerId?: unknown;
  items?: unknown;
  payments?: unknown;
  expectedTotal?: unknown;
  notes?: unknown;
};

export const MAX_CART_ITEMS = 100;

export function validateCheckout(raw: RawCheckout): ValidationResult<CheckoutInput> {
  const errors: FieldErrors = {};

  const store_id = str(raw.storeId);
  if (!isUuid(store_id)) errors.storeId = "Pilih outlet";
  const customer = str(raw.customerId);
  if (customer && !isUuid(customer)) errors.customerId = "Customer tidak valid";

  const items: CheckoutInput["items"] = [];
  const rawItems = Array.isArray(raw.items) ? raw.items : [];
  if (rawItems.length === 0) errors.items = "Keranjang masih kosong";
  if (rawItems.length > MAX_CART_ITEMS) errors.items = `Maksimal ${MAX_CART_ITEMS} barang per transaksi`;
  const seen = new Set<string>();
  rawItems.slice(0, MAX_CART_ITEMS).forEach((it, i) => {
    const o = (it ?? {}) as Record<string, unknown>;
    const id = str(o.inventoryId);
    if (!isUuid(id)) errors[`items.${i}`] = "Barang tidak valid";
    else if (seen.has(id)) errors[`items.${i}`] = "Barang dobel";
    seen.add(id);
    const d = str(o.discount);
    const discount = d === "" ? "0" : parseRupiah(d);
    if (discount === null) errors[`discount.${i}`] = "Diskon tidak valid";
    items.push({ inventory_id: id, discount: discount ?? "0" });
  });

  const payments: CheckoutInput["payments"] = [];
  const rawPayments = Array.isArray(raw.payments) ? raw.payments : [];
  rawPayments.slice(0, 10).forEach((p, i) => {
    const o = (p ?? {}) as Record<string, unknown>;
    const amountText = str(o.amount);
    if (!amountText) return; // empty row
    const method = str(o.method);
    if (!isPaymentMethod(method)) errors[`payments.${i}`] = "Metode pembayaran tidak valid";
    const amount = parseRupiah(amountText);
    if (amount === null || BigInt(amount) <= BigInt(0)) errors[`payments.${i}`] = "Nominal tidak valid";
    const reference = optionalText(o.reference, 100, "Referensi", errors, `reference.${i}`);
    payments.push({ method: method as PaymentMethod, amount: amount ?? "0", reference });
  });
  if (payments.length === 0) errors.payments = "Isi pembayaran";

  const expected = parseRupiah(raw.expectedTotal);
  if (expected === null) errors.expectedTotal = "Total tidak valid";

  const notes = optionalText(raw.notes, 1000, "Catatan", errors, "notes");

  return Object.keys(errors).length
    ? { valid: false, errors }
    : { valid: true, data: { store_id, customer_id: customer || null, items, payments, expected_total: expected!, notes } };
}

/** Integer-rupiah string sum (display helper for the cart; the DB recomputes). */
export function sumRupiah(values: string[]): string {
  return values.reduce((acc, v) => acc + BigInt(parseRupiah(v) ?? "0"), BigInt(0)).toString();
}

/** a − b for integer-rupiah strings (may be negative). */
export function subRupiah(a: string, b: string): string {
  return (BigInt(parseRupiah(a) ?? "0") - BigInt(parseRupiah(b) ?? "0")).toString();
}
