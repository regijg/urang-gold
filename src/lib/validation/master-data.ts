/**
 * Server-side validation for master data forms. Pure: untrusted input in,
 * normalized payload (decimal strings, nulls) or field errors out.
 * tenant_id / created_by are never part of these payloads — the DB sets them.
 */
import {
  bool,
  compareDecimal,
  isUuid,
  normalizePhone,
  optionalEmail,
  optionalText,
  parseDecimal,
  parseRupiah,
  requiredText,
  str,
  type FieldErrors,
  type ValidationResult,
} from "./common";

type Raw = Record<string, unknown>;

function result<T>(errors: FieldErrors, data: T): ValidationResult<T> {
  return Object.keys(errors).length ? { valid: false, errors } : { valid: true, data };
}

function sortOrder(value: unknown, errors: FieldErrors): number {
  const s = str(value);
  if (!s) return 0;
  const n = Number(s);
  if (!Number.isInteger(n) || n < 0 || n > 9999) {
    errors.sortOrder = "Urutan harus angka 0–9999";
    return 0;
  }
  return n;
}

// ---------------------------------------------------------------------------
export type CategoryInput = {
  code: string;
  name: string;
  description: string | null;
  sort_order: number;
  is_active: boolean;
};

export function validateCategory(raw: Raw): ValidationResult<CategoryInput> {
  const errors: FieldErrors = {};
  const code = str(raw.code).toUpperCase();
  if (!/^[A-Z0-9]{2,6}$/.test(code)) errors.code = "Kode 2–6 huruf/angka, contoh: RNG";
  const name = requiredText(raw.name, 2, 80, "Nama", errors, "name");
  const description = optionalText(raw.description, 500, "Deskripsi", errors, "description");
  return result(errors, { code, name, description, sort_order: sortOrder(raw.sortOrder, errors), is_active: bool(raw.isActive) });
}

// ---------------------------------------------------------------------------
export type PurityInput = {
  code: string;
  name: string;
  percentage: string;
  sort_order: number;
  is_active: boolean;
};

export function validatePurity(raw: Raw): ValidationResult<PurityInput> {
  const errors: FieldErrors = {};
  const code = str(raw.code).toUpperCase();
  if (!/^[A-Z0-9.% -]{1,20}$/.test(code)) errors.code = "Kode maksimal 20 karakter, contoh: 18K";
  const name = requiredText(raw.name, 1, 80, "Nama", errors, "name");
  const percentage = parseDecimal(raw.percentage, 3);
  if (percentage === null || compareDecimal(percentage, "0") <= 0 || compareDecimal(percentage, "100") > 0) {
    errors.percentage = "Persentase harus di antara 0 dan 100 (maks. 3 desimal)";
  }
  return result(errors, {
    code,
    name,
    percentage: percentage ?? "0",
    sort_order: sortOrder(raw.sortOrder, errors),
    is_active: bool(raw.isActive),
  });
}

// ---------------------------------------------------------------------------
export type ProductInput = {
  category_id: string;
  purity_id: string;
  sku: string | null;
  name: string;
  description: string | null;
  gross_weight: string;
  stone_weight: string;
  stone_type: string | null;
  cost_price: string;
  labor_cost: string;
  stone_price: string;
  margin_amount: string;
  is_active: boolean;
};

function money(value: unknown, label: string, errors: FieldErrors, key: string): string {
  if (str(value) === "") return "0";
  const v = parseRupiah(value);
  if (v === null) {
    errors[key] = `${label} harus berupa angka rupiah`;
    return "0";
  }
  return v;
}

export function validateProduct(raw: Raw): ValidationResult<ProductInput> {
  const errors: FieldErrors = {};

  const category_id = str(raw.categoryId);
  if (!isUuid(category_id)) errors.categoryId = "Pilih kategori";
  const purity_id = str(raw.purityId);
  if (!isUuid(purity_id)) errors.purityId = "Pilih kadar";

  const skuRaw = str(raw.sku).toUpperCase();
  if (skuRaw && !/^[A-Z0-9-]{2,40}$/.test(skuRaw)) errors.sku = "SKU hanya huruf, angka, dan tanda -";

  const name = requiredText(raw.name, 2, 150, "Nama produk", errors, "name");
  const description = optionalText(raw.description, 2000, "Deskripsi", errors, "description");

  const gross = parseDecimal(raw.grossWeight, 3);
  if (gross === null || compareDecimal(gross, "0") <= 0) errors.grossWeight = "Berat harus lebih dari 0 (maks. 3 desimal)";

  const stone = str(raw.stoneWeight) === "" ? "0" : parseDecimal(raw.stoneWeight, 3);
  if (stone === null) errors.stoneWeight = "Berat batu tidak valid (maks. 3 desimal)";
  else if (gross !== null && compareDecimal(stone, gross) >= 0 && !errors.grossWeight) {
    errors.stoneWeight = "Berat batu harus lebih kecil dari berat total";
  }

  const stone_type = optionalText(raw.stoneType, 80, "Jenis batu", errors, "stoneType");

  return result(errors, {
    category_id,
    purity_id,
    sku: skuRaw || null,
    name,
    description,
    gross_weight: gross ?? "0",
    stone_weight: stone ?? "0",
    stone_type,
    cost_price: money(raw.costPrice, "Harga modal", errors, "costPrice"),
    labor_cost: money(raw.laborCost, "Ongkos", errors, "laborCost"),
    stone_price: money(raw.stonePrice, "Harga batu", errors, "stonePrice"),
    margin_amount: money(raw.marginAmount, "Margin", errors, "marginAmount"),
    is_active: bool(raw.isActive),
  });
}

// ---------------------------------------------------------------------------
export type CustomerInput = {
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
  is_active: boolean;
};

function phoneField(value: unknown, errors: FieldErrors): string | null {
  const phone = normalizePhone(value);
  if (phone === undefined) {
    errors.phone = "Nomor HP 8–15 digit, contoh: 081234567890";
    return null;
  }
  return phone;
}

export function validateCustomer(raw: Raw): ValidationResult<CustomerInput> {
  const errors: FieldErrors = {};
  return result(errors, {
    name: requiredText(raw.name, 2, 120, "Nama", errors, "name"),
    phone: phoneField(raw.phone, errors),
    email: optionalEmail(raw.email, errors),
    address: optionalText(raw.address, 500, "Alamat", errors, "address"),
    notes: optionalText(raw.notes, 1000, "Catatan", errors, "notes"),
    is_active: bool(raw.isActive),
  });
}

// ---------------------------------------------------------------------------
export type SupplierInput = CustomerInput & { contact_person: string | null };

export function validateSupplier(raw: Raw): ValidationResult<SupplierInput> {
  const errors: FieldErrors = {};
  return result(errors, {
    name: requiredText(raw.name, 2, 120, "Nama", errors, "name"),
    contact_person: optionalText(raw.contactPerson, 120, "Kontak", errors, "contactPerson"),
    phone: phoneField(raw.phone, errors),
    email: optionalEmail(raw.email, errors),
    address: optionalText(raw.address, 500, "Alamat", errors, "address"),
    notes: optionalText(raw.notes, 1000, "Catatan", errors, "notes"),
    is_active: bool(raw.isActive),
  });
}

/** FormData -> plain object (string values only; files are ignored here). */
export function formToObject(formData: FormData): Raw {
  const out: Raw = {};
  formData.forEach((value, key) => {
    if (typeof value === "string") out[key] = value;
  });
  return out;
}
