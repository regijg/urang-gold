# GoldPOS — Deployment (Vercel + Supabase)

## 1. Supabase

1. Buat project Supabase (region terdekat, mis. Singapore).
2. Jalankan **semua** file di `supabase/migrations/` **berurutan sesuai nama file** (SQL Editor atau `supabase db push`).
   File yang sudah di-apply **tidak boleh diedit** — perubahan berikutnya selalu lewat migration baru.
3. (Disarankan, di project non-production) jalankan tes keamanan di `supabase/tests/*.test.sql`.
   Setiap file berjalan dalam transaksi yang di-rollback dan mencetak `ALL ... TESTS PASSED`.
4. Auth → URL Configuration: isi **Site URL** dengan domain produksi.
5. Storage: bucket `gold-products` dibuat otomatis oleh migration (public read, maks. 2 MB, JPG/PNG/WEBP).

## 2. Environment variables (Vercel → Settings → Environment Variables)

| Nama | Keterangan |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL project Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon key (aman di browser; semua akses dijaga RLS) |
| `SUPABASE_SERVICE_ROLE_KEY` | **rahasia**, hanya server (registrasi tenant & manajemen staf) |
| `REGISTRATION_ENABLED` | `false` untuk menutup pendaftaran toko baru publik |

## 3. Vercel

- Framework: Next.js, build `npm run build`, Node 20.
- Setelah deploy: buka `/register` (jika dibuka) untuk membuat owner pertama, lalu tutup
  pendaftaran dengan `REGISTRATION_ENABLED=false` bila GoldPOS tidak dijual self-service.

## 4. Checklist setelah deploy

- [ ] Login owner, atur **Harga Emas** semua kadar yang dipakai.
- [ ] Buat outlet, lokasi/baki, produk, lalu **Tambah Stok** dan cetak label barcode.
- [ ] Buat akun kasir (Pengguna) dengan akses outlet yang benar.
- [ ] Uji satu penjualan, buyback, dan void di jam sepi.
- [ ] Aktifkan katalog online per outlet hanya jika ingin stok & harga terlihat publik.

## 5. Keamanan — catatan

- Semua transaksi (penjualan, buyback, tukar tambah, pembelian, transfer, opname) berjalan di RPC
  database yang atomik dan mengecek tenant + permission; client tidak punya hak tulis langsung.
- Header keamanan dasar diset di `next.config.ts`. CSP ketat belum diaktifkan karena butuh nonce
  untuk inline script Next.js; tambahkan bila diperlukan audit keamanan.
- Login dilakukan dari server; batas rate Supabase Auth dihitung per IP server. Jika banyak user
  login bersamaan, pantau log Supabase Auth.
- Service worker hanya meng-cache aset statis; halaman dan data transaksi tidak pernah di-cache,
  dan transaksi tidak bisa dibuat offline.

## 6. Pengembangan lokal

```bash
npm install
npm run dev        # http://localhost:3000
npm run typecheck
npm test           # unit test (vitest)
```
