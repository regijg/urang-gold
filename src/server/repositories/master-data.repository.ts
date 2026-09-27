import { createCrudRepository } from "./crud";
import type { CategoryInput, CustomerInput, PurityInput, SupplierInput } from "@/lib/validation/master-data";

export type CategoryRow = CategoryInput & { id: string; created_at: string };
export type PurityRow = PurityInput & { id: string; created_at: string };
export type CustomerRow = CustomerInput & { id: string; created_at: string };
export type SupplierRow = SupplierInput & { id: string; created_at: string };

export const categoryRepository = createCrudRepository<CategoryRow, CategoryInput>({
  table: "gold_categories",
  select: "id, code, name, description, sort_order, is_active, created_at",
  searchColumns: ["name", "code"],
  order: [
    { column: "sort_order", ascending: true },
    { column: "name", ascending: true },
  ],
});

export const purityRepository = createCrudRepository<PurityRow, PurityInput>({
  table: "gold_purities",
  select: "id, code, name, percentage, sort_order, is_active, created_at",
  searchColumns: ["name", "code"],
  order: [
    { column: "sort_order", ascending: true },
    { column: "code", ascending: true },
  ],
});

export const customerRepository = createCrudRepository<CustomerRow, CustomerInput>({
  table: "gold_customers",
  select: "id, name, phone, email, address, notes, is_active, created_at",
  searchColumns: ["name", "phone", "email"],
  order: [{ column: "created_at", ascending: false }],
});

export const supplierRepository = createCrudRepository<SupplierRow, SupplierInput>({
  table: "gold_suppliers",
  select: "id, name, contact_person, phone, email, address, notes, is_active, created_at",
  searchColumns: ["name", "contact_person", "phone"],
  order: [{ column: "name", ascending: true }],
});
