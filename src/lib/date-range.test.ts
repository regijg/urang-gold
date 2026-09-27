import { describe, expect, it } from "vitest";
import { resolveRange } from "./date-range";

// 2026-09-27 01:30 WIB == 2026-09-26 18:30 UTC
const NOW = new Date("2026-09-26T18:30:00Z");

describe("resolveRange (WIB)", () => {
  it("today uses the Jakarta calendar day", () => {
    const r = resolveRange({}, NOW);
    expect(r).toMatchObject({ preset: "today", fromDate: "2026-09-27", toDate: "2026-09-27" });
    expect(r.fromIso).toBe("2026-09-26T17:00:00.000Z");
    expect(r.toIso).toBe("2026-09-27T17:00:00.000Z");
  });

  it("7d / 30d / month", () => {
    expect(resolveRange({ range: "7d" }, NOW).fromDate).toBe("2026-09-21");
    expect(resolveRange({ range: "30d" }, NOW).fromDate).toBe("2026-08-29");
    expect(resolveRange({ range: "month" }, NOW).fromDate).toBe("2026-09-01");
  });

  it("custom range is validated, clamped to today and capped", () => {
    expect(resolveRange({ range: "custom", from: "2026-09-01", to: "2026-09-10" }, NOW)).toMatchObject({ fromDate: "2026-09-01", toDate: "2026-09-10" });
    expect(resolveRange({ range: "custom", from: "2026-09-01", to: "2027-01-01" }, NOW).toDate).toBe("2026-09-27");
    expect(resolveRange({ range: "custom", from: "2026-09-10", to: "2026-09-01" }, NOW).preset).toBe("today");
    expect(resolveRange({ range: "custom", from: "x", to: "y" }, NOW).preset).toBe("today");
    expect(resolveRange({ range: "custom", from: "2020-01-01", to: "2026-09-27" }, NOW).fromDate).toBe("2025-09-26");
  });
});
