# UrangGold — Deployment (Vercel + Supabase)

## 1. Supabase

1. Buat project Supabase (region terdekat, mis. Singapore).
2. Jalankan **semua** file di `supabase/migrations/` **berurutan sesuai nama file** (SQL Editor atau `supabase db push`).
   File yang sudah di-apply **tidak boleh diedit** — perubahan berikutnya selalu lewat migration baru.
3. (Disarankan, di project non-production) jalankan tes keamanan di `supabase/tests/*.test.sql`.
   Setiap file berjalan dalam transaksi yang di-rollback dan mencetak `ALL ... TESTS PASSED`.
4. Auth → URL Configuration: isi **Site URL** dengan domain produksi.
5. Auth → Sign In / Providers: **matikan "Allow new users to sign up"**. Akun dibuat hanya lewat konsol platform,
   jadi pendaftaran langsung ke Supabase Auth tidak perlu dibuka.
6. Storage: bucket `gold-products` dibuat otomatis oleh migration (public read, maks. 2 MB, JPG/PNG/WEBP).

## 2. Environment variables (Vercel → Settings → Environment Variables)

| Nama | Keterangan |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL project Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon key (aman di browser; semua akses dijaga RLS) |
| `SUPABASE_SERVICE_ROLE_KEY` | **rahasia**, hanya server (registrasi tenant & manajemen staf) |
| `PLATFORM_ADMIN_EMAILS` | Email pemilik aplikasi (pisahkan koma bila lebih dari satu). Akun ini masuk ke konsol `/platform`, bukan ke toko. Wajib diisi |
| `REGISTRATION_ENABLED` | Pendaftaran toko publik di `/register` **ditutup secara default**. Isi `true` hanya bila ingin membukanya |

## 3. Vercel

- Framework: Next.js, build `npm run build`, Node 20.
- Setelah deploy: buat akun pemilik aplikasi (lihat bagian 3a), lalu buat toko pelanggan dari konsol platform.
  Jangan isi `REGISTRATION_ENABLED=true` kecuali UrangGold memang dijual self-service.

## 3a. Konsol platform (pemilik aplikasi)

Toko baru tidak bisa mendaftar sendiri. Pelanggan menghubungi pemilik aplikasi, lalu pemilik membuat tokonya.

**Membuat akun pemilik aplikasi (sekali saja):**
1. Isi `PLATFORM_ADMIN_EMAILS` dengan email Anda, lalu deploy ulang.
2. Supabase → Authentication → Users → **Add user**, isi email yang sama, isi password, dan centang **Auto Confirm User**.
   (Email harus terverifikasi, kalau tidak akun tidak dikenali sebagai pemilik aplikasi.)
3. Login di `/login` memakai akun itu. Anda otomatis masuk ke `/platform`.

**Isi konsol `/platform`:**
- Daftar semua toko: pemilik, paket, status, jumlah outlet dan pengguna, transaksi dan omzet, serta kapan terakhir menjual.
- **+ Toko Baru**: membuat toko, outlet pertama, dan akun owner (nama, email, password awal). Berikan email dan password itu ke pelanggan.
- **Tangguhkan / Aktifkan**: toko yang ditangguhkan langsung tidak bisa login, dan pengguna yang sedang masuk keluar pada permintaan berikutnya. Data tidak dihapus.
- **Paket** (Gratis / Starter / Pro): saat ini hanya pencatatan, belum membatasi fitur.

Angka omzet dan jumlah pengguna butuh migration `20261005000016_gold_platform_console.sql`. Tanpa itu daftar toko tetap tampil, tanpa angka.

Migration `20261005000017_gold_report_customers_by_store.sql` menambah filter outlet untuk laporan Customer. Tanpa itu tab Customer tetap jalan, tetapi memilih satu outlet akan menampilkan error.

## 4. Checklist setelah deploy

- [ ] Buat akun pemilik aplikasi dan toko pertama dari `/platform` (bagian 3a).
- [ ] Login owner toko, atur **Harga Emas** semua kadar yang dipakai.
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
