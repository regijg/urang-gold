import { describe, expect, it, vi } from "vitest";
import { AppError, fail, ok, toFailure } from "./action-result";

describe("action-result", () => {
  it("builds success and failure shapes", () => {
    expect(ok({ id: 1 }, "Transaksi berhasil")).toEqual({ success: true, message: "Transaksi berhasil", data: { id: 1 } });
    expect(fail("INSUFFICIENT_STOCK", "Stok tidak mencukupi")).toEqual({
      success: false,
      message: "Stok tidak mencukupi",
      code: "INSUFFICIENT_STOCK",
    });
  });

  it("passes AppError through", () => {
    const r = toFailure(new AppError("EMAIL_TAKEN", "Email sudah terdaftar.", { email: "x" }));
    expect(r).toEqual({ success: false, code: "EMAIL_TAKEN", message: "Email sudah terdaftar.", fieldErrors: { email: "x" } });
  });

  it("hides raw errors behind a generic message", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const r = toFailure(new Error('duplicate key value violates unique constraint "gold_users_pkey"'));
    expect(r).toEqual({ success: false, code: "INTERNAL_ERROR", message: "Terjadi kesalahan. Silakan coba lagi." });
    spy.mockRestore();
  });
});
