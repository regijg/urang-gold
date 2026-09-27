import { describe, expect, it } from "vitest";
import { formatDateOnly, formatGram, formatRupiah, groupThousands, onlyDigits } from "./format";

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

describe("money input helpers", () => {
  it("onlyDigits strips everything but digits and leading zeros", () => {
    expect(onlyDigits("Rp 1.500.000")).toBe("1500000");
    expect(onlyDigits("007")).toBe("7");
    expect(onlyDigits("abc")).toBe("");
    expect(onlyDigits("12345678901234567")).toHaveLength(13);
  });

  it("groupThousands formats while typing and accepts DB numerics", () => {
    expect(groupThousands("1500000")).toBe("1.500.000");
    expect(groupThousands("1500000.00")).toBe("1.500.000");
    expect(groupThousands("1.500.000")).toBe("1.500.000");
    expect(groupThousands("999")).toBe("999");
    expect(groupThousands("")).toBe("");
    expect(groupThousands(null)).toBe("");
  });
});

describe("formatDateOnly", () => {
  it("formats a calendar date without shifting the day", () => {
    expect(formatDateOnly("2026-09-27")).toBe("27 Sep 2026");
    expect(formatDateOnly("2026-01-01")).toBe("1 Jan 2026");
    expect(formatDateOnly("")).toBe("-");
  });
});
