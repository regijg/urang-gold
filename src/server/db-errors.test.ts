import { describe, expect, it, vi } from "vitest";
import { mapDbError } from "./db-errors";

describe("mapDbError", () => {
  const rules = [{ constraint: "gold_products_tenant_id_sku_key", field: "sku", message: "SKU sudah dipakai" }];

  it("maps a known unique violation to a field error", () => {
    const e = mapDbError(
      { code: "23505", message: 'duplicate key value violates unique constraint "gold_products_tenant_id_sku_key"' },
      rules
    );
    expect(e.code).toBe("DUPLICATE");
    expect(e.fieldErrors).toEqual({ sku: "SKU sudah dipakai" });
  });

  it("maps FK, check, RLS and not-found errors without leaking DB text", () => {
    expect(mapDbError({ code: "23503", message: "violates foreign key constraint x" }).code).toBe("IN_USE");
    expect(mapDbError({ code: "23514" }).code).toBe("VALIDATION_ERROR");
    expect(mapDbError({ code: "42501", message: "new row violates row-level security policy" }).code).toBe("FORBIDDEN");
    expect(mapDbError({ code: "42501" }).message).not.toMatch(/row-level/);
  });

  it("falls back to a generic internal error", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const e = mapDbError({ code: "XX000", message: "secret internals" });
    expect(e.code).toBe("INTERNAL_ERROR");
    expect(e.message).not.toMatch(/secret/);
    spy.mockRestore();
  });
});
