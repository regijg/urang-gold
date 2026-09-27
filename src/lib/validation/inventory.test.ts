import { describe, expect, it } from "vitest";
import {
  STATUS_TRANSITIONS,
  parseBarcodeList,
  storeSlug,
  validateLocation,
  validateReceive,
  validateStatusChange,
  validateStore,
  validateTransfer,
} from "./inventory";

const S = "11111111-1111-4111-8111-111111111111";
const P = "22222222-2222-4222-8222-222222222222";

describe("validateReceive", () => {
  const base = { storeId: S, productId: P, locationId: "", notes: "" };

  it("builds pieces from parallel arrays and skips empty rows", () => {
    const r = validateReceive({
      ...base,
      grossWeight: ["3,21", "", "2.500"],
      stoneWeight: ["0,1", "", ""],
      serialNumber: ["SN1", "", ""],
      costPrice: ["", "", "4.000.000"],
    });
    expect(r).toEqual({
      valid: true,
      data: {
        store_id: S,
        location_id: null,
        product_id: P,
        notes: null,
        items: [
          { gross_weight: "3.21", stone_weight: "0.1", serial_number: "SN1", cost_price: null },
          { gross_weight: "2.500", stone_weight: null, serial_number: null, cost_price: "4000000" },
        ],
      },
    });
  });

  it("reports per-row errors", () => {
    const r = validateReceive({ ...base, grossWeight: ["0", "2"], stoneWeight: ["", "2"], serialNumber: [], costPrice: ["", "x"] });
    expect(r.valid).toBe(false);
    if (!r.valid) expect(Object.keys(r.errors).sort()).toEqual(["costPrice.1", "grossWeight.0", "stoneWeight.1"]);
  });

  it("requires at least one piece and valid ids", () => {
    const r = validateReceive({ storeId: "x", productId: "", grossWeight: [], stoneWeight: [], serialNumber: [], costPrice: [] });
    expect(r.valid).toBe(false);
    if (!r.valid) expect(Object.keys(r.errors).sort()).toEqual(["productId", "storeId"]);
    const r2 = validateReceive({ ...base, grossWeight: [""], stoneWeight: [""], serialNumber: [""], costPrice: [""] });
    expect(r2.valid).toBe(false);
    if (!r2.valid) expect(r2.errors.items).toBeDefined();
  });

  it("caps the number of pieces", () => {
    const many = Array.from({ length: 201 }, () => "1");
    const r = validateReceive({ ...base, grossWeight: many, stoneWeight: [], serialNumber: [], costPrice: [] });
    expect(r.valid).toBe(false);
  });
});

describe("validateStatusChange", () => {
  it("allows only transitions from the table", () => {
    expect(validateStatusChange({ toStatus: "REPAIR" }, "AVAILABLE").valid).toBe(true);
    expect(validateStatusChange({ toStatus: "SOLD" }, "AVAILABLE").valid).toBe(false);
    expect(validateStatusChange({ toStatus: "AVAILABLE" }, "SOLD").valid).toBe(false);
    expect(STATUS_TRANSITIONS.SOLD).toEqual([]);
  });

  it("requires a reason for lost/damaged/melted", () => {
    const r = validateStatusChange({ toStatus: "LOST" }, "AVAILABLE");
    expect(r.valid).toBe(false);
    if (!r.valid) expect(r.errors.notes).toBeDefined();
    expect(validateStatusChange({ toStatus: "LOST", notes: "hilang saat pameran" }, "AVAILABLE").valid).toBe(true);
  });

  it("parses an optional new weight", () => {
    const r = validateStatusChange({ toStatus: "AVAILABLE", newGrossWeight: "3,150" }, "REPAIR");
    expect(r.valid && r.data.new_gross_weight).toBe("3.150");
  });
});

describe("transfer & barcode parsing", () => {
  it("parses scanner input, uppercases and de-duplicates", () => {
    expect(parseBarcodeList("gold-000001\nGOLD-000002, GOLD-000001 ;gold-000003")).toEqual(["GOLD-000001", "GOLD-000002", "GOLD-000003"]);
  });

  it("validates destination and barcodes", () => {
    expect(validateTransfer({ toStoreId: S, barcodes: "GOLD-000001" }).valid).toBe(true);
    const r = validateTransfer({ toStoreId: "", barcodes: "GOLD 1 <script>" });
    expect(r.valid).toBe(false);
    if (!r.valid) expect(Object.keys(r.errors).sort()).toEqual(["barcodes", "toStoreId"]);
  });
});

describe("location & store", () => {
  it("validates a location", () => {
    const r = validateLocation({ storeId: S, code: "a-01", name: "Baki A slot 1", type: "SLOT", isActive: "on" });
    expect(r.valid && r.data).toMatchObject({ code: "A-01", type: "SLOT", parent_id: null, is_active: true });
    expect(validateLocation({ storeId: S, code: "A 01", name: "x", type: "RAK" }).valid).toBe(false);
  });

  it("validates a store and builds a slug", () => {
    const r = validateStore({ code: "jkt-01", name: "Outlet Jakarta", whatsapp: "0812 3456 7890" });
    expect(r.valid && r.data).toMatchObject({ code: "JKT-01", whatsapp: "081234567890" });
    expect(storeSlug("toko-emas-budi", "JKT-01")).toBe("toko-emas-budi-jkt-01");
  });
});
