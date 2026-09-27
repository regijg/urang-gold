/** Payment methods accepted at the till (must match the check constraint in gold_payments). */
export const PAYMENT_METHODS = ["CASH", "BANK_TRANSFER", "QRIS", "DEBIT_CARD", "CREDIT_CARD"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const PAYMENT_LABELS: Record<string, string> = {
  CASH: "Tunai",
  BANK_TRANSFER: "Transfer Bank",
  QRIS: "QRIS",
  DEBIT_CARD: "Kartu Debit",
  CREDIT_CARD: "Kartu Kredit",
  TRADE_IN: "Tukar Tambah",
};

export function isPaymentMethod(v: unknown): v is PaymentMethod {
  return typeof v === "string" && (PAYMENT_METHODS as readonly string[]).includes(v);
}
