import { describe, expect, it } from "vitest";
import { compareDecimal, dbRupiah, normalizePhone, parseDecimal, parsePage, parseRupiah, sanitizeSearch } from "./common";

describe("parseDecimal (gram / percent)", () => {
  it.each([
    ["3,21", "3.21"],
    ["3.21", "3.21"],
    ["3.210", "3.210"], // must NOT become 3210 gram
    ["0,1", "0.1"],
    ["1.234,5", "1234.5"],
    ["1.234.567", "1234567"],
    ["007,5", "7.5"],
    [" 12 ", "12"],
  ])("%s -> %s", (input, expected) => {
    expect(parseDecimal(input, 3)).toBe(expected);
  });

  it.each(["", "abc", "-1", "1,2,3", "3,2101", "1e3", ",5"])("rejects %s", (input) => {
    expect(parseDecimal(input, 3)).toBeNull();
  });
});

describe("parseRupiah", () => {
  it.each([
    ["8.500.000", "8500000"],
    ["8500000", "8500000"],
    ["Rp 2.350.000", "2350000"],
    ["0", "0"],
  ])("%s -> %s", (input, expected) => {
    expect(parseRupiah(input)).toBe(expected);
  });

  it.each(["", "8,5", "-100", "12abc", "99999999999999"])("rejects %s", (input) => {
    expect(parseRupiah(input)).toBeNull();
  });
});

describe("compareDecimal", () => {
  it("compares without float error", () => {
    expect(compareDecimal("0.10", "0.1")).toBe(0);
    expect(compareDecimal("3.11", "3.21")).toBe(-1);
    expect(compareDecimal("100", "99.999")).toBe(1);
  });
});

describe("normalizePhone", () => {
  it("cleans separators and keeps leading plus", () => {
    expect(normalizePhone("0812-3456 7890")).toBe("081234567890");
    expect(normalizePhone("+62 812 3456 7890")).toBe("+6281234567890");
    expect(normalizePhone("")).toBeNull();
    expect(normalizePhone("12345")).toBeUndefined();
    expect(normalizePhone("08a123456789")).toBeUndefined();
  });
});

describe("sanitizeSearch", () => {
  it("strips PostgREST filter syntax", () => {
    expect(sanitizeSearch("cincin,name.eq.x)")).toBe("cincin name.eq.x");
    expect(sanitizeSearch("50% (promo)*")).toBe("50 promo");
    expect(sanitizeSearch("x".repeat(100))).toHaveLength(60);
    expect(sanitizeSearch(undefined)).toBe("");
  });
});

describe("parsePage", () => {
  it("defaults to 1 for bad input", () => {
    expect(parsePage("3")).toBe(3);
    expect(parsePage("0")).toBe(1);
    expect(parsePage("-2")).toBe(1);
    expect(parsePage("abc")).toBe(1);
    expect(parsePage(undefined)).toBe(1);
  });
});

describe("dbRupiah (Postgres numeric -> integer rupiah)", () => {
  it.each([
    ["6557625.00", "6557625"],
    ["134750", "134750"],
    ["0.00", "0"],
    ["-250000.00", "-250000"],
    ["10.50", "11"],
    ["10.49", "10"],
    [12, "12"],
    [null, "0"],
    ["abc", "0"],
  ])("%s -> %s", (input, expected) => {
    expect(dbRupiah(input as string)).toBe(expected);
  });
});
