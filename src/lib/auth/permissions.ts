/**
 * Permission and role identifiers. The mapping role -> permissions is stored in
 * the database (gold_roles.permissions) and enforced by RLS; these constants
 * only give the app type-safe names. Do not grant access based on this file alone.
 */
export const ROLE_CODES = ["OWNER", "ADMIN", "MANAGER", "CASHIER", "WAREHOUSE"] as const;
export type RoleCode = (typeof ROLE_CODES)[number];

export const PERMISSIONS = [
  "dashboard.view",
  "tenant.manage",
  "stores.manage",
  "users.manage",
  "master_data.manage",
  "gold_rates.manage",
  "inventory.view",
  "inventory.manage",
  "stock_opname.manage",
  "stock_opname.approve",
  "stock_transfer.manage",
  "pos.use",
  "sales.manage",
  "sales.void",
  "buybacks.manage",
  "trade_ins.manage",
  "purchases.manage",
  "customers.manage",
  "reports.view",
  "settings.manage",
] as const;
export type Permission = (typeof PERMISSIONS)[number];

/** Never grantable to non-owner roles (would allow self-promotion). Mirrors gold_set_role_permissions. */
export const OWNER_ONLY_PERMISSIONS: readonly Permission[] = ["tenant.manage", "users.manage", "settings.manage"];
/** Always granted (landing page after login). */
export const ALWAYS_ON_PERMISSIONS: readonly Permission[] = ["dashboard.view"];

export function isEditablePermission(p: Permission): boolean {
  return !OWNER_ONLY_PERMISSIONS.includes(p) && !ALWAYS_ON_PERMISSIONS.includes(p);
}

/** Cleans a submitted permission list for a non-owner role (unknown/locked entries dropped). */
export function sanitizeRolePermissions(values: readonly unknown[]): Permission[] {
  const known = new Set<string>(PERMISSIONS);
  return [...new Set(values.filter((v): v is Permission => typeof v === "string" && known.has(v)))].filter(isEditablePermission).sort();
}

export function isRoleCode(value: unknown): value is RoleCode {
  return typeof value === "string" && (ROLE_CODES as readonly string[]).includes(value);
}

/** Keeps only permission strings the app knows about (ignores unknown DB values). */
export function normalizePermissions(values: readonly string[] | null | undefined): Permission[] {
  if (!values) return [];
  const known = new Set<string>(PERMISSIONS);
  return values.filter((v): v is Permission => known.has(v));
}

export function hasPermission(granted: readonly Permission[], required: Permission): boolean {
  return granted.includes(required);
}

/** Indonesian labels for the role/permission matrix, grouped for display. */
export const PERMISSION_GROUPS: { label: string; items: { key: Permission; label: string }[] }[] = [
  {
    label: "Umum",
    items: [
      { key: "dashboard.view", label: "Lihat dashboard" },
      { key: "reports.view", label: "Lihat laporan & ringkasan keuangan" },
    ],
  },
  {
    label: "Toko & Pengguna",
    items: [
      { key: "tenant.manage", label: "Ubah profil toko" },
      { key: "stores.manage", label: "Kelola outlet" },
      { key: "users.manage", label: "Kelola pengguna & role" },
      { key: "settings.manage", label: "Pengaturan" },
    ],
  },
  {
    label: "Master Data & Harga",
    items: [
      { key: "master_data.manage", label: "Kelola produk, kategori, kadar, supplier" },
      { key: "gold_rates.manage", label: "Ubah harga emas & buyback di atas harga resmi" },
      { key: "customers.manage", label: "Kelola & lihat data customer" },
    ],
  },
  {
    label: "Transaksi",
    items: [
      { key: "pos.use", label: "Pakai kasir (POS)" },
      { key: "sales.manage", label: "Penjualan" },
      { key: "buybacks.manage", label: "Buyback" },
      { key: "trade_ins.manage", label: "Tukar tambah" },
      { key: "sales.void", label: "Batalkan (void) transaksi" },
      { key: "purchases.manage", label: "Pembelian dari supplier" },
    ],
  },
  {
    label: "Inventory",
    items: [
      { key: "inventory.view", label: "Lihat stok & mutasi" },
      { key: "inventory.manage", label: "Stok masuk, ubah status, lokasi" },
      { key: "stock_transfer.manage", label: "Transfer stok" },
      { key: "stock_opname.manage", label: "Hitung stock opname" },
      { key: "stock_opname.approve", label: "Setujui stock opname" },
    ],
  },
];
