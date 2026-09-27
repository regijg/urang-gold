import { describe, expect, it } from "vitest";
import { validateTenantName } from "./settings";

describe("validateTenantName", () => {
  it("trims and accepts 2–120 chars", () => {
    expect(validateTenantName("  Toko Emas Budi ")).toEqual({ name: "Toko Emas Budi", errors: {} });
  });
  it("rejects too short / too long / non-string", () => {
    expect(Object.keys(validateTenantName("A").errors)).toEqual(["name"]);
    expect(Object.keys(validateTenantName("x".repeat(121)).errors)).toEqual(["name"]);
    expect(Object.keys(validateTenantName(null).errors)).toEqual(["name"]);
  });
});
