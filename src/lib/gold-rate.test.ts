import { describe, expect, it } from "vitest";
import { suggestPurityPrice, validateGoldRates } from "./gold-rate";

describe("suggestPurityPrice (gold purity calculation)", () => {
  it("matches the master prompt example", () => {
    expect(suggestPurityPrice("2.350.000", "75")).toBe("1762500");
  });

  it.each([
    ["2350000", "99,99", "2349765"],
    ["2350000", "91,67", "2154245"],
    ["2350000", "58,33", "1370755"],
    ["1000", "33,333", "333"],
    ["3", "50", "2"], // 1.5 -> 2 (half up)
  ])("%s × %s%% = %s", (base, pct, expected) => {
    expect(suggestPurityPrice(base, pct)).toBe(expected);
  });

  it("returns null for invalid input", () => {
    expect(suggestPurityPrice("abc", "75")).toBeNull();
    expect(suggestPurityPrice("2350000", "")).toBeNull();
  });
});

describe("validateGoldRates", () => {
  const A = "11111111-1111-4111-8111-111111111111";
  const B = "22222222-2222-4222-8222-222222222222";

  it("collects filled rows only", () => {
    const r = validateGoldRates({ [`buy_${A}`]: "2.200.000", [`sell_${A}`]: "2.350.000", [`buy_${B}`]: "", [`sell_${B}`]: "" }, [A, B]);
    expect(r).toEqual({ valid: true, data: [{ purity_id: A, buy_price: "2200000", sell_price: "2350000" }] });
  });

  it("requires both prices and buy <= sell", () => {
    const r = validateGoldRates({ [`buy_${A}`]: "2.400.000", [`sell_${A}`]: "2.350.000", [`sell_${B}`]: "1.000.000" }, [A, B]);
    expect(r.valid).toBe(false);
    if (!r.valid) expect(Object.keys(r.errors).sort()).toEqual([`buy_${A}`, `buy_${B}`].sort());
  });

  it("ignores ids that were not loaded server-side", () => {
    const forged = "33333333-3333-4333-8333-333333333333";
    const r = validateGoldRates({ [`buy_${forged}`]: "1", [`sell_${forged}`]: "2" }, [A]);
    expect(r.valid).toBe(false);
    if (!r.valid) expect(r.errors._form).toBeDefined();
  });
});
