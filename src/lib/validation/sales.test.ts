import { describe, expect, it } from "vitest";
import { subRupiah, sumRupiah, validateCheckout } from "./sales";
import { validateStaff } from "./users";

const S = "11111111-1111-4111-8111-111111111111";
const I1 = "22222222-2222-4222-8222-222222222222";
const I2 = "33333333-3333-4333-8333-333333333333";

describe("validateCheckout", () => {
  const base = {
    storeId: S,
    customerId: "",
    items: [{ inventoryId: I1, discount: "250.000" }, { inventoryId: I2, discount: "" }],
    payments: [{ method: "QRIS", amount: "10.000.000", reference: "QR-1" }, { method: "CASH", amount: "3000000", reference: "" }, { method: "CASH", amount: "", reference: "" }],
    expectedTotal: "12865250",
    notes: "",
  };

  it("normalizes items, payments and skips empty payment rows", () => {
    const r = validateCheckout(base);
    expect(r).toEqual({
      valid: true,
      data: {
        store_id: S,
        customer_id: null,
        items: [
          { inventory_id: I1, discount: "250000" },
          { inventory_id: I2, discount: "0" },
        ],
        payments: [
          { method: "QRIS", amount: "10000000", reference: "QR-1" },
          { method: "CASH", amount: "3000000", reference: null },
        ],
        expected_total: "12865250",
        notes: null,
      },
    });
  });

  it("rejects duplicates, bad methods, empty cart and missing payment", () => {
    expect(validateCheckout({ ...base, items: [{ inventoryId: I1 }, { inventoryId: I1 }] }).valid).toBe(false);
    expect(validateCheckout({ ...base, payments: [{ method: "BITCOIN", amount: "1" }] }).valid).toBe(false);
    const r = validateCheckout({ ...base, items: [], payments: [] });
    expect(r.valid).toBe(false);
    if (!r.valid) expect(Object.keys(r.errors).sort()).toEqual(["items", "payments"]);
  });

  it("rejects non-array input safely", () => {
    expect(validateCheckout({ storeId: S, items: "x", payments: {}, expectedTotal: "1" }).valid).toBe(false);
  });
});

describe("discount calculation helpers (integer rupiah)", () => {
  it("sums and subtracts without float error", () => {
    expect(sumRupiah(["6557625", "6557625"])).toBe("13115250");
    expect(subRupiah("13115250", "250000")).toBe("12865250");
    expect(subRupiah("100", "250")).toBe("-150");
    expect(sumRupiah([])).toBe("0");
  });
});

describe("validateStaff", () => {
  it("requires outlet access for non-owner roles", () => {
    const r = validateStaff({ fullName: "Kasir 1", email: "k@toko.id", password: "password1", roleCode: "CASHIER", storeIds: [] }, "create");
    expect(r.valid).toBe(false);
    if (!r.valid) expect(r.errors.storeIds).toBeDefined();
    expect(validateStaff({ fullName: "Admin", email: "a@toko.id", password: "password1", roleCode: "ADMIN" }, "create").valid).toBe(true);
  });

  it("rejects unknown roles and short passwords; password optional on update", () => {
    expect(validateStaff({ fullName: "X Y", email: "x@y.id", password: "short", roleCode: "CASHIER", storeIds: [S] }, "create").valid).toBe(false);
    expect(validateStaff({ fullName: "X Y", email: "x@y.id", password: "password1", roleCode: "SUPERADMIN", storeIds: [S] }, "create").valid).toBe(false);
    const u = validateStaff({ fullName: "X Y", roleCode: "CASHIER", storeIds: [S], isActive: "on" }, "update");
    expect(u.valid && u.data).toMatchObject({ password: null, is_active: true, store_ids: [S] });
  });
});
