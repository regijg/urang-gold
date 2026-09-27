import { describe, expect, it } from "vitest";
import { buildReceiptMessage, waLink } from "./whatsapp";

describe("waLink", () => {
  it("converts local numbers and encodes text", () => {
    expect(waLink("0812-3456-7890", "Halo toko")).toBe("https://wa.me/6281234567890?text=Halo%20toko");
    expect(waLink(null, "x")).toBe("https://wa.me/?text=x");
  });
});

describe("buildReceiptMessage", () => {
  const msg = buildReceiptMessage({
    storeName: "RJG STORE",
    invoiceNumber: "INV-20260927-000001",
    date: new Date("2026-09-27T07:30:00Z"),
    customerName: "Siti",
    items: [{ name: "Cincin", purity: "24K", weight: "10.02", price: "23747000", discount: "250000" }],
    discountTotal: "250000",
    total: "23747000",
    payments: [{ method: "CASH", amount: "24000000" }],
    change: "253000",
    url: "https://urang-gold.vercel.app/nota/abc",
  });

  it("contains store, invoice, items, totals, payment, change and link", () => {
    expect(msg).toContain("*RJG STORE*");
    expect(msg).toContain("Nota: INV-20260927-000001");
    expect(msg).toContain("Customer: Siti");
    expect(msg).toContain("• Cincin (24K, 10,02 gram)");
    expect(msg).toContain("Rp 23.747.000  (diskon Rp 250.000)");
    expect(msg).toContain("*Total: Rp 23.747.000*");
    expect(msg).toContain("Tunai: Rp 24.000.000");
    expect(msg).toContain("Kembalian: Rp 253.000");
    expect(msg).toContain("https://urang-gold.vercel.app/nota/abc");
  });

  it("omits zero discount and change", () => {
    const m = buildReceiptMessage({ storeName: "A", invoiceNumber: "I", items: [], total: "1000", discountTotal: "0", change: "0", url: "u" });
    expect(m).not.toContain("Diskon:");
    expect(m).not.toContain("Kembalian");
  });
});
