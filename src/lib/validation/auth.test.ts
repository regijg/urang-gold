import { describe, expect, it } from "vitest";
import { safeRedirectPath, validateLogin, validateRegister } from "./auth";

describe("validateLogin", () => {
  it("normalizes email and accepts valid input", () => {
    const r = validateLogin({ email: "  Owner@Toko.COM ", password: "rahasia123" });
    expect(r).toEqual({ valid: true, data: { email: "owner@toko.com", password: "rahasia123" } });
  });

  it("rejects bad email and empty password", () => {
    const r = validateLogin({ email: "bukan-email", password: "" });
    expect(r.valid).toBe(false);
    if (!r.valid) expect(Object.keys(r.errors).sort()).toEqual(["email", "password"]);
  });

  it("treats non-string input as empty", () => {
    const r = validateLogin({ email: null, password: 123 });
    expect(r.valid).toBe(false);
  });
});

describe("validateRegister", () => {
  const base = {
    fullName: "Budi Santoso",
    email: "budi@emas.id",
    password: "password123",
    tenantName: "Toko Emas Budi",
    storeName: "",
  };

  it("defaults store name to tenant name", () => {
    const r = validateRegister(base);
    expect(r.valid).toBe(true);
    if (r.valid) expect(r.data.storeName).toBe("Toko Emas Budi");
  });

  it("enforces minimum password length", () => {
    const r = validateRegister({ ...base, password: "short" });
    expect(r.valid).toBe(false);
    if (!r.valid) expect(r.errors.password).toMatch(/minimal 8/);
  });

  it("rejects passwords longer than bcrypt limit", () => {
    const r = validateRegister({ ...base, password: "x".repeat(73) });
    expect(r.valid).toBe(false);
  });

  it("requires names of at least 2 characters", () => {
    const r = validateRegister({ ...base, fullName: " A ", tenantName: "" });
    expect(r.valid).toBe(false);
    if (!r.valid) expect(Object.keys(r.errors).sort()).toEqual(["fullName", "storeName", "tenantName"]);
  });
});

describe("safeRedirectPath", () => {
  it.each([
    ["/dashboard", "/dashboard"],
    ["/products/123", "/products/123"],
    ["https://evil.com", "/dashboard"],
    ["//evil.com", "/dashboard"],
    ["/\\evil.com", "/dashboard"],
    ["/login", "/dashboard"],
    ["", "/dashboard"],
    [null, "/dashboard"],
  ])("%s -> %s", (input, expected) => {
    expect(safeRedirectPath(input)).toBe(expected);
  });
});
