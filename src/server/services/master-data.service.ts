import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AppError } from "@/lib/action-result";
import type { Permission } from "@/lib/auth/permissions";
import type { ValidationResult } from "@/lib/validation/common";
import {
  validateCategory,
  validateCustomer,
  validatePurity,
  validateSupplier,
} from "@/lib/validation/master-data";
import { isUuid } from "@/lib/validation/common";
import { getAppSession, requirePermission } from "@/server/auth/session";
import { mapDbError, type UniqueRule } from "@/server/db-errors";
import type { ListParams, ListResult } from "@/server/repositories/crud";
import {
  categoryRepository,
  customerRepository,
  purityRepository,
  supplierRepository,
} from "@/server/repositories/master-data.repository";

type Repo<Row, Insert> = {
  list(s: Awaited<ReturnType<typeof createSupabaseServerClient>>, p?: ListParams): Promise<ListResult<Row>>;
  getById(s: Awaited<ReturnType<typeof createSupabaseServerClient>>, id: string): Promise<Row | null>;
  insert(s: Awaited<ReturnType<typeof createSupabaseServerClient>>, v: Insert): Promise<{ id: string }>;
  update(s: Awaited<ReturnType<typeof createSupabaseServerClient>>, id: string, v: Partial<Insert>): Promise<boolean>;
  remove(s: Awaited<ReturnType<typeof createSupabaseServerClient>>, id: string): Promise<boolean>;
};

type ServiceConfig<Row, Insert> = {
  repo: Repo<Row, Insert>;
  /** null = any active tenant member may read */
  readPermission: Permission | null;
  writePermission: Permission;
  validate: (raw: Record<string, unknown>) => ValidationResult<Insert>;
  uniqueRules: UniqueRule[];
};

function invalid(errors: Record<string, string>): never {
  throw new AppError("VALIDATION_ERROR", "Periksa kembali isian Anda.", errors);
}

function notFound(): never {
  throw new AppError("NOT_FOUND", "Data tidak ditemukan.");
}

async function requireRead(permission: Permission | null) {
  if (permission) return requirePermission(permission);
  const session = await getAppSession();
  if (!session) throw new AppError("UNAUTHENTICATED", "Sesi berakhir. Silakan login kembali.");
  return session;
}

/**
 * Standard master-data service: permission check -> validation -> repository.
 * RLS enforces the same rules again in the database.
 */
function createMasterService<Row, Insert extends object>(config: ServiceConfig<Row, Insert>) {
  return {
    async list(params: ListParams = {}) {
      await requireRead(config.readPermission);
      const supabase = await createSupabaseServerClient();
      try {
        return await config.repo.list(supabase, params);
      } catch (e) {
        throw mapDbError(e);
      }
    },

    async get(id: string) {
      await requireRead(config.readPermission);
      if (!isUuid(id)) notFound();
      const supabase = await createSupabaseServerClient();
      let row: Row | null;
      try {
        row = await config.repo.getById(supabase, id);
      } catch (e) {
        throw mapDbError(e);
      }
      if (!row) notFound();
      return row;
    },

    async create(raw: Record<string, unknown>) {
      await requirePermission(config.writePermission);
      const parsed = config.validate(raw);
      if (!parsed.valid) invalid(parsed.errors);
      const supabase = await createSupabaseServerClient();
      try {
        return await config.repo.insert(supabase, parsed.data);
      } catch (e) {
        throw mapDbError(e, config.uniqueRules);
      }
    },

    async update(id: string, raw: Record<string, unknown>) {
      await requirePermission(config.writePermission);
      if (!isUuid(id)) notFound();
      const parsed = config.validate(raw);
      if (!parsed.valid) invalid(parsed.errors);
      const supabase = await createSupabaseServerClient();
      let updated: boolean;
      try {
        updated = await config.repo.update(supabase, id, parsed.data);
      } catch (e) {
        throw mapDbError(e, config.uniqueRules);
      }
      if (!updated) notFound();
    },

    async remove(id: string) {
      await requirePermission(config.writePermission);
      if (!isUuid(id)) notFound();
      const supabase = await createSupabaseServerClient();
      let removed: boolean;
      try {
        removed = await config.repo.remove(supabase, id);
      } catch (e) {
        throw mapDbError(e);
      }
      if (!removed) notFound();
    },
  };
}

export const categoryService = createMasterService({
  repo: categoryRepository,
  readPermission: null,
  writePermission: "master_data.manage",
  validate: validateCategory,
  uniqueRules: [
    { constraint: "gold_categories_tenant_id_code_key", field: "code", message: "Kode kategori sudah dipakai" },
    { constraint: "gold_categories_tenant_name_uidx", field: "name", message: "Nama kategori sudah ada" },
  ],
});

export const purityService = createMasterService({
  repo: purityRepository,
  readPermission: null,
  writePermission: "master_data.manage",
  validate: validatePurity,
  uniqueRules: [{ constraint: "gold_purities_tenant_id_code_key", field: "code", message: "Kode kadar sudah dipakai" }],
});

export const customerService = createMasterService({
  repo: customerRepository,
  readPermission: "customers.manage",
  writePermission: "customers.manage",
  validate: validateCustomer,
  uniqueRules: [
    { constraint: "gold_customers_tenant_phone_uidx", field: "phone", message: "Nomor HP sudah terdaftar untuk customer lain" },
  ],
});

export const supplierService = createMasterService({
  repo: supplierRepository,
  readPermission: null,
  writePermission: "master_data.manage",
  validate: validateSupplier,
  uniqueRules: [{ constraint: "gold_suppliers_tenant_name_uidx", field: "name", message: "Nama supplier sudah ada" }],
});
