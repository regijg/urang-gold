/**
 * Gold-rate helpers (pure). Money is handled as integer-rupiah strings with BigInt,
 * never as floats. The authoritative price formula lives in the database
 * (gold_price_quote); this file only covers the rate-entry helper.
 */
import { parseDecimal, parseRupiah, type FieldErrors, type ValidationResult } from "@/lib/validation/common";

/**
 * Suggested per-gram price for a purity derived from the 24K base price:
 * base × percentage / 100, rounded half-up to whole rupiah.
 * e.g. 2.350.000 × 75% = 1.762.500 (master prompt §9).
 */
export function suggestPurityPrice(base: string, percentage: string): string | null {
  const b = parseRupiah(base);
  const p = parseDecimal(percentage, 3);
  if (b === null || p === null) return null;
  const [pi, pf = ""] = p.split(".");
  const pScaled = BigInt(pi + pf.padEnd(3, "0")); // percentage × 1000
  const numerator = BigInt(b) * pScaled; // base × pct × 1000
  const denominator = BigInt(100_000); // 100 × 1000
  return ((numerator * BigInt(2) + denominator) / (denominator * BigInt(2))).toString();
}

export type GoldRateEntry = { purity_id: string; buy_price: string; sell_price: string };

/**
 * Validates the bulk rate form. Fields are `buy_<purityId>` / `sell_<purityId>`;
 * a purity is included only when at least one of its two fields is filled.
 * Only purity ids from `allowedPurityIds` (loaded server-side) are accepted.
 */
export function validateGoldRates(raw: Record<string, unknown>, allowedPurityIds: string[]): ValidationResult<GoldRateEntry[]> {
  const errors: FieldErrors = {};
  const entries: GoldRateEntry[] = [];

  for (const id of allowedPurityIds) {
    const buyRaw = typeof raw[`buy_${id}`] === "string" ? (raw[`buy_${id}`] as string).trim() : "";
    const sellRaw = typeof raw[`sell_${id}`] === "string" ? (raw[`sell_${id}`] as string).trim() : "";
    if (!buyRaw && !sellRaw) continue;

    const buy = parseRupiah(buyRaw);
    const sell = parseRupiah(sellRaw);
    if (buy === null || BigInt(buy) <= BigInt(0)) errors[`buy_${id}`] = "Harga beli wajib dan harus > 0";
    if (sell === null || BigInt(sell) <= BigInt(0)) errors[`sell_${id}`] = "Harga jual wajib dan harus > 0";
    if (buy !== null && sell !== null && BigInt(buy) > BigInt(sell)) {
      errors[`buy_${id}`] = "Harga beli tidak boleh melebihi harga jual";
    }
    if (buy !== null && sell !== null) entries.push({ purity_id: id, buy_price: buy, sell_price: sell });
  }

  if (!Object.keys(errors).length && entries.length === 0) errors._form = "Isi minimal satu harga kadar";
  return Object.keys(errors).length ? { valid: false, errors } : { valid: true, data: entries };
}
