import { describe, expect, it } from "vitest";
import { previewBuybackLine, validateBuyback } from "./buyback";

const S = "11111111-1111-4111-8111-111111111111";
const C = "22222222-2222-4222-8222-222222222222";
const K = "33333333-3333-4333-8333-333333333333";
const P = "44444444-4444-4444-8444-444444444444";
const INV = "55555555-5555-4555-8555-555555555555";

describe("previewBuybackLine (buyback calculation)", () => {
  it("matches the master prompt example: 3,21 g × 1.650.000 − 100.000", () => {
    expect(previewBuybackLine("3,21", "", "1.650.000", "100.000")).toEqual({ gross: "5296500", net: "5196500", valid: true });
  });

  it("uses gold weight (minus stone) and rounds half up like the database", () => {
    expect(previewBuybackLine("3,31", "0,10", "1650000", "")?.gross).toBe("5296500");
    expect(previewBuybackLine("0,333", "", "1650000", "")?.gross).toBe("549450");
    expect(previewBuybackLine("0,001", "", "1500", "")?.gross).toBe("2"); // 1.5 -> 2
  });

  it("flags deduction larger than gross and incomplete input", () => {
    expect(previewBuybackLine("1", "", "1000", "2000")?.valid).toBe(false);
    expect(previewBuybackLine("", "", "1000", "")).toBeNull();
    expect(previewBuybackLine("1", "1", "1000", "")).toBeNull();
  });
});

describe("validateBuyback", () => {
  const base = {
    storeId: S,
    customerId: C,
    items: [{ name: "Kalung", categoryId: K, purityId: P, grossWeight: "3,21", deduction: "100.000" }],
    payments: [{ method: "CASH", amount: "5.196.500" }],
    expectedTotal: "5196500",
  };

  it("normalizes a new piece line", () => {
    const r = validateBuyback(base);
    expect(r.valid && r.data.items[0]).toEqual({
      inventory_id: null,
      name: "Kalung",
      category_id: K,
      purity_id: P,
      gross_weight: "3.21",
      stone_weight: null,
      price_per_gram: null,
      deduction: "100000",
    });
  });

  it("accepts a reused sold piece with only its id", () => {
    const r = validateBuyback({ ...base, items: [{ inventoryId: INV }] });
    expect(r.valid && r.data.items[0].inventory_id).toBe(INV);
  });

  it("requires customer, item details and payout", () => {
    const r = validateBuyback({ storeId: S, customerId: "", items: [{ name: "", grossWeight: "" }], payments: [], expectedTotal: "0" });
    expect(r.valid).toBe(false);
    if (!r.valid) expect(Object.keys(r.errors).sort()).toEqual(["categoryId.0", "customerId", "grossWeight.0", "name.0", "payments", "purityId.0"]);
  });
});
