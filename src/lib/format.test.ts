import { describe, expect, it } from "vitest";
import { formatGram, formatRupiah } from "./format";

describe("formatRupiah", () => {
  it("formats with Indonesian thousand separators", () => {
    expect(formatRupiah(8500000)).toBe("Rp 8.500.000");
  });

  it("accepts numeric strings from Postgres numeric columns", () => {
    expect(formatRupiah("2350000.00")).toBe("Rp 2.350.000");
  });

  it("handles negatives, zero and empty values", () => {
    expect(formatRupiah(-250000)).toBe("-Rp 250.000");
    expect(formatRupiah(0)).toBe("Rp 0");
    expect(formatRupiah(null)).toBe("Rp 0");
    expect(formatRupiah("abc")).toBe("Rp 0");
  });
});

describe("formatGram", () => {
  it("uses comma decimals and gram unit", () => {
    expect(formatGram(3.21)).toBe("3,21 gram");
    expect(formatGram("78.525")).toBe("78,525 gram");
    expect(formatGram(0)).toBe("0,00 gram");
  });
});
