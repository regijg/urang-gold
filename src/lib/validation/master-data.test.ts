import { describe, expect, it } from "vitest";
import { validateCategory, validateCustomer, validateProduct, validatePurity, validateSupplier } from "./master-data";

const CAT = "11111111-1111-4111-8111-111111111111";
const PUR = "22222222-2222-4222-8222-222222222222";

describe("validateCategory", () => {
  it("uppercases code and reads checkbox", () => {
    const r = validateCategory({ code: "rng", name: "Cincin", isActive: "on" });
    expect(r).toEqual({ valid: true, data: { code: "RNG", name: "Cincin", description: null, sort_order: 0, is_active: true } });
  });

  it("rejects bad code and sort order", () => {
    const r = validateCategory({ code: "R", name: "Cincin", sortOrder: "-1" });
    expect(r.valid).toBe(false);
    if (!r.valid) expect(Object.keys(r.errors).sort()).toEqual(["code", "sortOrder"]);
  });
});

describe("validatePurity", () => {
  it("accepts Indonesian decimal percentage", () => {
    const r = validatePurity({ code: "18k", name: "Emas 18 Karat", percentage: "75,000" });
    expect(r.valid).toBe(true);
    if (r.valid) expect(r.data).toMatchObject({ code: "18K", percentage: "75.000", is_active: false });
  });

  it.each(["0", "100,001", "abc", "75,1234"])("rejects percentage %s", (percentage) => {
    const r = validatePurity({ code: "18K", name: "x", percentage });
    expect(r.valid).toBe(false);
  });

  it("accepts 99,99", () => {
    expect(validatePurity({ code: "24K", name: "x", percentage: "99,99" }).valid).toBe(true);
  });
});

describe("validateProduct", () => {
  const base = {
    categoryId: CAT,
    purityId: PUR,
    name: "Cincin Berlian",
    grossWeight: "3,21",
    stoneWeight: "0,10",
    costPrice: "7.000.000",
    laborCost: "150.000",
    isActive: "on",
  };

  it("normalizes weights and money to decimal strings", () => {
    const r = validateProduct(base);
    expect(r.valid).toBe(true);
    if (r.valid) {
      expect(r.data).toMatchObject({
        sku: null,
        gross_weight: "3.21",
        stone_weight: "0.10",
        cost_price: "7000000",
        labor_cost: "150000",
        stone_price: "0",
        margin_amount: "0",
        is_active: true,
      });
    }
  });

  it("uppercases a manual SKU", () => {
    const r = validateProduct({ ...base, sku: "rng-00123" });
    if (r.valid) expect(r.data.sku).toBe("RNG-00123");
    else throw new Error("expected valid");
  });

  it("requires stone weight below gross weight", () => {
    const r = validateProduct({ ...base, stoneWeight: "3,21" });
    expect(r.valid).toBe(false);
    if (!r.valid) expect(r.errors.stoneWeight).toBeDefined();
  });

  it("rejects missing references, zero weight and bad money", () => {
    const r = validateProduct({ ...base, categoryId: "x", purityId: "", grossWeight: "0", costPrice: "7,5" });
    expect(r.valid).toBe(false);
    if (!r.valid) expect(Object.keys(r.errors).sort()).toEqual(["categoryId", "costPrice", "grossWeight", "purityId"]);
  });

  it("rejects SKU with illegal characters", () => {
    expect(validateProduct({ ...base, sku: "RNG 001" }).valid).toBe(false);
  });
});

describe("validateCustomer / validateSupplier", () => {
  it("normalizes phone and email", () => {
    const r = validateCustomer({ name: "Siti", phone: "0812-3456-7890", email: " Siti@Mail.COM " });
    expect(r.valid).toBe(true);
    if (r.valid) expect(r.data).toMatchObject({ phone: "081234567890", email: "siti@mail.com", address: null });
  });

  it("rejects invalid phone/email", () => {
    const r = validateCustomer({ name: "Siti", phone: "123", email: "bukan-email" });
    expect(r.valid).toBe(false);
    if (!r.valid) expect(Object.keys(r.errors).sort()).toEqual(["email", "phone"]);
  });

  it("supplier keeps contact person", () => {
    const r = validateSupplier({ name: "PT Emas Jaya", contactPerson: "Pak Budi" });
    if (r.valid) expect(r.data.contact_person).toBe("Pak Budi");
    else throw new Error("expected valid");
  });
});
