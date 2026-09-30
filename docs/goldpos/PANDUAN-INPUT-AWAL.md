# Panduan Input Awal UrangGold

Urutan input dari nol sampai toko siap berjualan. Ikuti berurutan — setiap langkah
membutuhkan data dari langkah sebelumnya.

| No | Langkah | Menu | Wajib? |
|---|---|---|---|
| 1 | Profil toko & outlet | Pengaturan, Outlet | Ya |
| 2 | Cek kadar & kategori | Master Data | Ya (cek saja) |
| 3 | Harga emas | Harga Emas | **Ya, sebelum jualan** |
| 4 | Lokasi / baki | Inventory → Lokasi & Baki | Disarankan |
| 5 | Produk (model barang) | Master Data → Produk | Ya |
| 6 | Stok awal + label barcode | Inventory → Daftar Stok → + Tambah Stok | Ya |
| 7 | Supplier & customer | Master Data → Supplier, Customer | Bisa menyusul |
| 8 | Akun staf | Pengguna | Jika ada staf |
| 9 | Uji coba transaksi | Kasir (POS) | Disarankan |

---

## 1. Profil Toko & Outlet

- **Pengaturan → Profil Toko**: pastikan nama toko/usaha sudah benar.
- **Outlet → klik PUSAT**: isi **alamat, telepon, dan WhatsApp**.
  Data ini tercetak di nota dan dipakai tombol WhatsApp di katalog online.

## 2. Cek Kadar & Kategori

- **Master Data → Kadar Emas** — sudah terisi otomatis 24K sampai 12K.
  Nonaktifkan kadar yang tidak dijual, atau sesuaikan persentasenya jika standar toko berbeda.
- **Master Data → Kategori** — sudah ada Cincin, Kalung, Gelang, Anting, Liontin, Logam Mulia.
  Tambahkan jika perlu (mis. Bros, Giwang).
  Kode kategori menjadi awalan SKU otomatis, contoh `RNG-00001`.

## 3. Harga Emas (wajib sebelum jualan)

- **Harga Emas** — isi **harga beli (buyback)** dan **harga jual** per gram untuk setiap kadar yang dipakai.
- Cara cepat: isi harga dasar (100%) lalu klik **"Hitung × persentase kadar"** —
  semua kadar terisi otomatis, periksa lalu **Simpan Harga Baru**.
- Harga lama tidak hilang, tersimpan di **Riwayat Harga**.

> Tanpa harga emas, kasir tidak bisa menghitung harga barang.

## 4. Lokasi / Baki (disarankan)

**Inventory → Lokasi & Baki**, contoh susunan:

```
Baki A        (tipe Baki)
  ├─ A-01     (tipe Slot, induk: Baki A)
  └─ A-02
Etalase Depan (tipe Etalase)
Gudang        (tipe Gudang)
```

Gunanya: mengetahui posisi barang dan melakukan stock opname per baki.

## 5. Produk (model barang)

**Master Data → Produk** — satu produk = satu **model**, misalnya "Cincin Polos 18K" atau "LM Antam 1g".

- Isi: kategori, kadar, berat standar, berat batu (jika ada).
- **Ongkos produksi, harga batu, dan margin** ikut menentukan harga jual:

  ```
  harga jual = berat emas × harga jual/gram kadar + ongkos + harga batu + margin − diskon
  ```

- SKU boleh dikosongkan (dibuat otomatis). Foto opsional (JPG/PNG/WEBP, maks. 2 MB).
- Stok **belum** diinput di sini.

## 6. Stok Awal + Label Barcode

**Inventory → Daftar Stok → + Tambah Stok**:

1. Pilih **produk**, **outlet**, dan **baki**.
2. Isi **berat aktual tiap keping** — satu baris = satu barang fisik.
   Berat batu dan harga modal boleh dikosongkan jika sama dengan data produk.
3. Barang identik (mis. 10 keping LM 1g): gunakan **"tambah … baris sekaligus"**.
4. **Simpan Stok** → klik **Cetak Label Barcode** → tempel label ke barang.

Tips:
- Kerjakan per baki atau per kategori, cetak label per batch agar tidak tertukar.
- Barang lama yang tidak punya model khusus bisa dikelompokkan ke produk umum,
  misalnya "Cincin 18K Umum" — berat dan harga modal tetap diisi per keping.

## 7. Supplier & Customer (bisa menyusul)

- **Master Data → Supplier** — diisi saat akan mencatat pembelian dari supplier.
- **Customer** — tidak perlu diinput di awal; bisa ditambahkan langsung dari layar kasir
  ("+ Customer baru"). Untuk buyback dan tukar tambah, customer **wajib** diisi.

## 8. Akun Staf

**Pengguna → Tambah Pengguna**:

- Isi nama, email, password, pilih **role** (Admin, Manager, Kasir, Gudang).
- **Centang outlet** yang boleh diakses (Owner & Admin otomatis semua outlet).
- Sesuaikan hak akses tiap role di **Pengaturan → Role & Hak Akses** jika perlu.

> Jangan minta staf mendaftar sendiri lewat halaman Daftar — itu akan membuat **toko baru** yang terpisah.

## 9. Uji Coba Transaksi

1. **Kasir (POS)** → scan satu barang → bayar → cetak nota.
2. **Penjualan** → buka transaksi tadi → **Batalkan transaksi** (isi alasan).
   Barang kembali berstatus tersedia.
3. Opsional: coba **Buyback** satu barang lalu batalkan juga.

Jika semua lancar, toko siap dipakai.

---

## Rutinitas Harian

| Kapan | Kegiatan | Menu |
|---|---|---|
| Pagi, sebelum buka | Update harga emas | Harga Emas |
| Saat ada barang datang | Catat pembelian (dari supplier) atau tambah stok | Pembelian / Inventory → + Tambah Stok |
| Sepanjang hari | Penjualan, buyback, tukar tambah | Kasir, Buyback, Tukar Tambah |
| Tutup toko | Cek penjualan & kas per metode | Laporan → Pembayaran & Arus Kas |
| Berkala (mingguan/bulanan) | Stock opname per baki/outlet | Inventory → Stock Opname |
