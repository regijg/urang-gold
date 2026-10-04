import { describe, expect, it } from "vitest";
import { cashDifferenceLabel } from "./report-labels";
import { netProfit } from "./profit";

describe("netProfit", () => {
  it("adds repair income and forfeited deposits, subtracts expenses", () => {
    expect(netProfit("1000000", "175000", "1500000", "3500000")).toBe("-825000");
    expect(netProfit("5000000", "0", "0", "0")).toBe("5000000");
  });

  it("handles a gross loss and very large rupiah values exactly", () => {
    expect(netProfit("-200000", "0", "0", "100000")).toBe("-300000");
    expect(netProfit("9007199254740993", "1", "0", "0")).toBe("9007199254740994");
  });
});

describe("cashDifferenceLabel", () => {
  it("labels the counted difference", () => {
    expect(cashDifferenceLabel(null)).toBe("");
    expect(cashDifferenceLabel("0")).toBe("Cocok");
    expect(cashDifferenceLabel("-50000")).toBe("Kurang");
    expect(cashDifferenceLabel("20000")).toBe("Lebih");
  });
});
