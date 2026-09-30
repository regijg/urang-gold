import { describe, expect, it } from "vitest";
import { optionalDate, rupiahField, validateExpense, validateOrder, validateRepair, validateResell } from "./operations";

const STORE = "11111111-1111-4111-8111-111111111111";
const CUST = "22222222-2222-4222-8222-222222222222";
const PIECE = "33333333-3333-4333-8333-333333333333";
const TODAY = "2026-09-30";

describe("rupiahField", () => {
  it("parses thousand separators and rejects zero unless allowed", () => {
    const e: Record<string, string> = {};
    expect(rupiahField("1.500.000", e, "a", "Nominal")).toBe("1500000");
    expect(rupiahField("0", e, "b", "Nominal")).toBe("0");
    expect(e.b).toBeDefined();
    expect(rupiahField("", e, "c", "Modal", true)).toBe("0");
    expect(e.c).toBeUndefined();
    rupiahField("abc", e, "d", "Nominal", true);
    expect(e.d).toContain("tidak valid");
  });
});

describe("optionalDate", () => {
  it("checks format and bounds", () => {
    const e: Record<string, string> = {};
    expect(optionalDate("", e, "x")).toBeNull();
    optionalDate("2026-10-01", e, "future", { notAfter: TODAY });
    optionalDate("2026-09-29", e, "past", { notBefore: TODAY });
    optionalDate("30/09/2026", e, "bad");
    expect(Object.keys(e).sort()).toEqual(["bad", "future", "past"]);
  });
});

describe("validateExpense", () => {
  const base = { storeId: STORE, category: "LISTRIK_AIR", description: "Token listrik", amount: "100.000", method: "CASH" };
  it("accepts a valid expense and defaults the date to today", () => {
    const r = validateExpense(base, TODAY);
    expect(r.valid).toBe(true);
    if (r.valid) expect(r.data).toMatchObject({ amount: "100000", expense_date: TODAY, category: "LISTRIK_AIR", method: "CASH" });
  });
  it("rejects unknown categories, future dates and empty amounts", () => {
    const r = validateExpense({ ...base, category: "JUDI", expenseDate: "2026-10-05", amount: "" }, TODAY);
    expect(r.valid).toBe(false);
    if (!r.valid) expect(Object.keys(r.errors).sort()).toEqual(["amount", "category", "expenseDate"]);
  });
});

describe("validateOrder", () => {
  const base = {
    storeId: STORE,
    customerId: CUST,
    items: [{ inventoryId: PIECE, discount: "50.000" }],
    payments: [{ method: "CASH", amount: "1.000.000", reference: "" }],
    expectedTotal: "6500000",
    dueDate: "2026-10-07",
    notes: "",
  };
  it("normalizes items, DP and dates", () => {
    const r = validateOrder(base, TODAY);
    expect(r.valid).toBe(true);
    if (r.valid) {
      expect(r.data.items).toEqual([{ inventory_id: PIECE, discount: "50000" }]);
      expect(r.data.payments).toEqual([{ method: "CASH", amount: "1000000", reference: null }]);
      expect(r.data.due_date).toBe("2026-10-07");
    }
  });
  it("allows an order without DP", () => {
    const r = validateOrder({ ...base, payments: [{ method: "CASH", amount: "", reference: "" }] }, TODAY);
    expect(r.valid && r.data.payments.length === 0).toBe(true);
  });
  it("requires a customer and at least one piece", () => {
    const r = validateOrder({ ...base, customerId: "", items: [] }, TODAY);
    expect(r.valid).toBe(false);
    if (!r.valid) expect(r.errors).toMatchObject({ customerId: expect.any(String), items: expect.any(String) });
  });
  it("rejects a pick-up date in the past", () => {
    const r = validateOrder({ ...base, dueDate: "2026-09-01" }, TODAY);
    expect(r.valid).toBe(false);
  });
});

describe("validateRepair", () => {
  const base = { storeId: STORE, customerId: CUST, itemDescription: "Cincin", serviceType: "Patri", weightIn: "2,5", estimatedCost: "100.000", payments: [] };
  it("parses weight and estimate", () => {
    const r = validateRepair(base, TODAY);
    expect(r.valid).toBe(true);
    if (r.valid) expect(r.data).toMatchObject({ weight_in: "2.5", estimated_cost: "100000", due_date: null });
  });
  it("accepts an empty estimate (free service) but not a zero weight", () => {
    expect(validateRepair({ ...base, estimatedCost: "" }, TODAY).valid).toBe(true);
    const r = validateRepair({ ...base, weightIn: "0" }, TODAY);
    expect(!r.valid && r.errors.weightIn).toBeTruthy();
  });
});

describe("validateResell", () => {
  it("treats empty price parts as 0 and validates the location id", () => {
    const r = validateResell({ laborCost: "100.000", stonePrice: "", marginAmount: "250.000", locationId: "" });
    expect(r.valid).toBe(true);
    if (r.valid) expect(r.data).toEqual({ location_id: null, labor_cost: "100000", stone_price: "0", margin_amount: "250000", notes: null });
    expect(validateResell({ locationId: "baki-1" }).valid).toBe(false);
  });
});
