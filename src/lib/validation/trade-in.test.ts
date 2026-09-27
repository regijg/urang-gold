import { describe, expect, it } from "vitest";
import { parseSignedRupiah, validateTradeIn } from "./trade-in";

const S = "11111111-1111-4111-8111-111111111111";
const C = "22222222-2222-4222-8222-222222222222";
const K = "33333333-3333-4333-8333-333333333333";
const P = "44444444-4444-4444-8444-444444444444";
const I = "55555555-5555-4555-8555-555555555555";

describe("parseSignedRupiah", () => {
  it.each([
    ["6.800.000", "6800000"],
    ["-600.000", "-600000"],
    ["-0", "0"],
    ["abc", null],
  ])("%s -> %s", (input, expected) => expect(parseSignedRupiah(input)).toBe(expected));
});

describe("validateTradeIn", () => {
  const base = {
    storeId: S,
    customerId: C,
    buyItems: [{ name: "Kalung lama", categoryId: K, purityId: P, grossWeight: "2,6" }],
    sellItems: [{ inventoryId: I, discount: "" }],
    payments: [{ method: "CASH", amount: "7000000" }],
    expectedBalance: "6800000",
  };

  it("accepts the master prompt example", () => {
    const r = validateTradeIn(base);
    expect(r.valid && r.data).toMatchObject({ expected_balance: "6800000", sell_items: [{ inventory_id: I, discount: "0" }] });
  });

  it("allows no payment when there is no balance", () => {
    expect(validateTradeIn({ ...base, payments: [], expectedBalance: "0" }).valid).toBe(true);
    expect(validateTradeIn({ ...base, payments: [], expectedBalance: "-600000" }).valid).toBe(false);
  });

  it("requires both sides and a customer", () => {
    const r = validateTradeIn({ ...base, customerId: "", buyItems: [], sellItems: [] });
    expect(r.valid).toBe(false);
    if (!r.valid) expect(Object.keys(r.errors).sort()).toEqual(["customerId", "items", "sellItems"]);
  });
});
