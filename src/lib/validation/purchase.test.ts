import { describe, expect, it } from "vitest";
import { todayJakarta, validatePurchase } from "./purchase";

const S = "11111111-1111-4111-8111-111111111111";
const SUP = "22222222-2222-4222-8222-222222222222";
const P = "33333333-3333-4333-8333-333333333333";

describe("validatePurchase", () => {
  const base = {
    storeId: S,
    supplierId: SUP,
    supplierInvoice: "INV-SUP-001",
    purchaseDate: "2026-09-27",
    items: [
      { productId: P, grossWeight: "3,05", serialNumber: "S1", costPrice: "5.000.000", laborCost: "100.000" },
      { productId: "", grossWeight: "", costPrice: "" },
    ],
    payments: [{ method: "BANK_TRANSFER", amount: "4.000.000", reference: "TRF" }],
  };

  it("normalizes items, skips empty rows, payments optional", () => {
    const r = validatePurchase(base, "2026-09-27");
    expect(r.valid && r.data.items).toEqual([
      { product_id: P, gross_weight: "3.05", stone_weight: null, serial_number: "S1", cost_price: "5000000", labor_cost: "100000" },
    ]);
    expect(validatePurchase({ ...base, payments: [] }, "2026-09-27").valid).toBe(true);
  });

  it("rejects future dates and missing supplier/items", () => {
    const r = validatePurchase({ ...base, supplierId: "", purchaseDate: "2026-09-28", items: [] }, "2026-09-27");
    expect(r.valid).toBe(false);
    if (!r.valid) expect(Object.keys(r.errors).sort()).toEqual(["items", "purchaseDate", "supplierId"]);
  });

  it("requires cost and a valid product per row", () => {
    const r = validatePurchase({ ...base, items: [{ productId: "x", grossWeight: "1", costPrice: "" }] }, "2026-09-27");
    expect(r.valid).toBe(false);
    if (!r.valid) expect(Object.keys(r.errors).sort()).toEqual(["costPrice.0", "productId.0"]);
  });

  it("computes today in WIB", () => {
    expect(todayJakarta(new Date("2026-09-26T18:30:00Z"))).toBe("2026-09-27");
  });
});
