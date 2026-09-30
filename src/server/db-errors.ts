import { AppError } from "@/lib/action-result";

type PgError = { code?: string; message?: string; details?: string | null };

export type UniqueRule = { constraint: string; field: string; message: string };

/**
 * Business errors raised by our RPCs (`raise exception 'CODE' ...`). The message
 * starts with the code, optionally followed by ":<detail>" (e.g. a barcode).
 */
const RPC_ERRORS: Record<string, string> = {
  UNAUTHENTICATED: "Sesi berakhir. Silakan login kembali.",
  FORBIDDEN: "Anda tidak memiliki akses untuk tindakan ini.",
  STORE_FORBIDDEN: "Anda tidak memiliki akses ke outlet tersebut.",
  NOT_FOUND: "Data tidak ditemukan.",
  NO_ITEMS: "Tidak ada barang yang diproses.",
  TOO_MANY_ITEMS: "Jumlah barang terlalu banyak untuk sekali proses.",
  INVALID_LOCATION: "Lokasi tidak valid untuk outlet tersebut.",
  INVALID_STORE: "Outlet tidak valid atau tidak aktif.",
  INVALID_STATUS: "Status saat ini tidak memungkinkan tindakan ini.",
  INVALID_TRANSITION: "Perubahan status tersebut tidak diizinkan.",
  INVALID_WEIGHT: "Berat tidak valid.",
  INVALID_AMOUNT: "Nominal tidak valid.",
  NOTES_REQUIRED: "Alasan wajib diisi.",
  PRODUCT_REQUIRED: "Pilih produk.",
  PRODUCT_NOT_FOUND: "Produk tidak ditemukan.",
  DISCOUNT_EXCEEDS_SUBTOTAL: "Diskon melebihi harga.",
  RATE_NOT_SET: "Harga emas untuk kadar tersebut belum diatur.",
  ITEM_NOT_AVAILABLE: "Barang sudah tidak tersedia (terjual atau dipindah).",
  PAYMENT_MISMATCH: "Total pembayaran tidak sama dengan total transaksi.",
  INSUFFICIENT_PAYMENT: "Pembayaran kurang dari total transaksi.",
  EMPTY_CART: "Keranjang masih kosong.",
  DUPLICATE_ITEM: "Barang yang sama dimasukkan lebih dari sekali.",
  INVALID_CUSTOMER: "Customer tidak valid.",
  INVALID_PAYMENT_METHOD: "Metode pembayaran tidak valid.",
  ALREADY_VOIDED: "Transaksi sudah dibatalkan.",
  OPNAME_NOT_OPEN: "Stock opname sudah tidak dapat diubah.",
  OPNAME_ALREADY_OPEN: "Masih ada stock opname yang berjalan untuk outlet ini.",
  INVALID_SUPPLIER: "Supplier tidak valid.",
  USER_ALREADY_REGISTERED: "User sudah terdaftar.",
  LAST_OWNER: "Tenant harus memiliki minimal satu owner aktif.",
  CANNOT_EDIT_SELF: "Anda tidak dapat mengubah role atau status akun sendiri.",
  INVALID_CATEGORY: "Kategori tidak valid.",
  INVALID_PURITY: "Kadar tidak valid.",
  NAME_REQUIRED: "Nama barang wajib diisi.",
  PRICE_ABOVE_BUY_RATE: "Harga per gram melebihi harga buyback resmi. Hanya owner yang boleh.",
  PRICE_CHANGED: "Harga emas berubah. Periksa total terbaru lalu simpan ulang.",
  OVERPAYMENT: "Pembayaran melebihi sisa tagihan.",
  OWNER_LOCKED: "Hak akses Owner tidak dapat diubah.",
  OWNER_ONLY_PERMISSION: "Hak akses tersebut khusus Owner.",
  INVALID_PERMISSION: "Hak akses tidak dikenal.",
  INVALID_ROLE: "Role tidak dikenal.",
  INVALID_ACTION: "Aksi tidak valid.",
  INVALID_DATE: "Tanggal tidak valid.",
  SESSION_ALREADY_OPEN: "Kas outlet ini masih terbuka. Tutup kas yang berjalan dulu.",
  SESSION_CLOSED: "Kas sudah ditutup.",
  INVALID_DIRECTION: "Jenis uang masuk/keluar tidak valid.",
  TOO_MANY_PAYMENTS: "Terlalu banyak baris pembayaran.",
};

function rpcError(message: string | undefined): AppError | null {
  if (!message) return null;
  const [code, detail] = message.split(":", 2);
  const text = RPC_ERRORS[code?.trim() ?? ""];
  if (!text) return null;
  const appCode = code === "STORE_FORBIDDEN" || code === "PRICE_ABOVE_BUY_RATE" ? "FORBIDDEN" : code.trim();
  return new AppError(appCode, detail ? `${text} (${detail.trim()})` : text);
}

/**
 * Converts a Postgres/PostgREST error into a user-safe AppError.
 * Raw database text is never forwarded to the client.
 */
export function mapDbError(error: unknown, uniqueRules: UniqueRule[] = []): AppError {
  if (error instanceof AppError) return error;
  const e = (error ?? {}) as PgError;
  const text = `${e.message ?? ""} ${e.details ?? ""}`;

  const known = rpcError(e.message);
  if (known) return known;

  switch (e.code) {
    case "23505": {
      const rule = uniqueRules.find((r) => text.includes(r.constraint));
      if (rule) return new AppError("DUPLICATE", rule.message, { [rule.field]: rule.message });
      return new AppError("DUPLICATE", "Data yang sama sudah ada.");
    }
    case "23503":
      return new AppError("IN_USE", "Data masih dipakai oleh data lain. Nonaktifkan saja jika tidak dipakai lagi.");
    case "23514":
    case "22P02":
    case "22003":
    case "22023":
      return new AppError("VALIDATION_ERROR", "Data tidak valid. Periksa kembali isian Anda.");
    case "42501":
      return new AppError("FORBIDDEN", "Anda tidak memiliki akses untuk tindakan ini.");
    case "PGRST116":
      return new AppError("NOT_FOUND", "Data tidak ditemukan.");
    default:
      console.error("[db]", e.code, e.message);
      return new AppError("INTERNAL_ERROR", "Terjadi kesalahan. Silakan coba lagi.");
  }
}
