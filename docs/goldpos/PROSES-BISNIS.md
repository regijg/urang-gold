# GoldPOS — Proses Bisnis Aplikasi Toko Emas

GoldPOS adalah aplikasi kasir dan pengelolaan stok yang dibuat khusus untuk **toko emas dan perhiasan**.
Dokumen ini menjelaskan bagaimana pekerjaan sehari-hari di toko emas berjalan di dalam GoldPOS —
dari harga emas pagi hari sampai laporan tutup toko.

---

## 1. Masalah yang Diselesaikan

Toko emas tidak bisa memakai aplikasi kasir biasa, karena:

| Kebutuhan toko emas | Cara GoldPOS menanganinya |
|---|---|
| Harga berubah setiap hari mengikuti harga emas | Harga jual dihitung otomatis dari **harga emas hari ini × berat emas** barang |
| Setiap perhiasan beratnya berbeda | Setiap barang dicatat **per keping** dengan berat aktual dan barcode sendiri |
| Ada kadar 24K, 22K, 18K, dst. | Master **kadar emas** yang bisa diatur sendiri oleh toko |
| Toko juga membeli emas dari customer | Modul **buyback** dengan harga beli resmi dan potongan |
| Customer sering tukar emas lama dengan yang baru | Modul **tukar tambah** — satu transaksi, selisih dihitung otomatis |
| Stok dihitung dalam gram, bukan hanya jumlah | **Stock opname** berdasarkan berat, lengkap dengan selisih gram dan nilainya |
| Owner perlu mengontrol kasir | **Hak akses per role**, riwayat semua perubahan, pembatalan transaksi hanya oleh atasan |
| Toko punya beberapa cabang | **Multi-outlet**: stok, transaksi, dan akses staf per outlet, bisa transfer antar outlet |

---

## 2. Siapa Memakai Apa

| Peran | Tugas utama di GoldPOS |
|---|---|
| **Owner** | Mengatur harga emas, melihat semua laporan dan keuntungan, mengatur staf dan hak akses, menyetujui stock opname |
| **Admin** | Mengelola data produk, stok, transaksi, dan laporan |
| **Manager** | Mengawasi penjualan dan buyback, membatalkan transaksi yang salah, menyetujui stock opname |
| **Kasir** | Melayani penjualan, buyback, tukar tambah, dan data customer |
| **Gudang** | Menerima barang, memindahkan stok antar baki/outlet, menghitung stock opname |

Hak akses tiap peran bisa disesuaikan oleh owner (misalnya kasir tidak boleh buyback).
Hak yang sensitif — mengatur staf dan pengaturan toko — hanya dimiliki owner.

---

## 3. Gambaran Alur Barang dan Uang

```
                 ┌──────────────┐
  Supplier ────► │  PEMBELIAN   │──┐
                 └──────────────┘  │
                 ┌──────────────┐  │     ┌─────────────────┐     ┌──────────────┐
  Customer ────► │   BUYBACK    │──┼───► │  STOK (per keping│────►│  PENJUALAN   │────► Customer
  (jual emas)    └──────────────┘  │     │  berat & barcode)│     │  (Kasir/POS) │
                 ┌──────────────┐  │     └─────────────────┘     └──────────────┘
  Stok awal ───► │ STOK MASUK   │──┘        │        ▲
                 └──────────────┘           │        │ reparasi / siap jual
                                            ▼        │
                                  transfer baki/outlet, reparasi, lebur,
                                  stock opname (hitung fisik)
```

Setiap perpindahan barang — masuk, terjual, dibeli kembali, dipindah, direparasi, dilebur, hilang —
**selalu tercatat** sebagai riwayat mutasi. Tidak ada stok yang berubah tanpa jejak.

---

## 4. Proses Harian

### 4.1 Pagi: Update Harga Emas

1. Owner membuka menu **Harga Emas**.
2. Mengisi **harga jual** dan **harga beli (buyback)** per gram untuk setiap kadar.
   Bisa cukup mengisi harga 24K lalu sistem menghitung kadar lain sesuai persentasenya.
3. Harga langsung berlaku di kasir. Harga lama tetap tersimpan sebagai riwayat.

> Contoh: harga 24K Rp 2.350.000/gram → 18K (75%) otomatis Rp 1.762.500/gram.

### 4.2 Penjualan di Kasir

1. Kasir **scan barcode** barang (atau cari nama barang).
2. Sistem menampilkan harga berdasarkan **berat emas barang itu** dan harga emas hari ini:

   ```
   Harga = berat emas × harga/gram kadar + ongkos + harga batu + margin − diskon
   ```

   Contoh: cincin 18K, berat emas 3,21 gram
   3,21 × Rp 1.762.500 = Rp 5.657.625 + ongkos, batu, margin = harga jual.
3. Kasir memilih customer (opsional), memberi diskon jika diizinkan.
4. Pembayaran bisa **dipisah** ke beberapa metode: tunai, transfer, QRIS, kartu debit, kartu kredit.
   Kembalian hanya dari tunai.
5. Nota terbit dengan nomor **INV-tanggal-urutan**, bisa dicetak (A4 / printer thermal 58 mm / 80 mm)
   atau dikirim lewat **WhatsApp** berupa link e-nota.
6. Barang otomatis berstatus **terjual** dan tidak bisa dijual dua kali.

Pengaman:
- Jika harga emas diubah saat kasir sedang melayani, sistem meminta kasir mengonfirmasi harga terbaru.
- Harga dan total selalu dihitung ulang oleh sistem, tidak bisa diubah manual oleh kasir.

### 4.3 Buyback (Toko Membeli Emas dari Customer)

1. Kasir memilih/menambah **data customer** (wajib, untuk keamanan asal-usul barang).
2. Mengisi barang: nama, kategori, kadar, berat, berat batu.
   Jika barang dulu dibeli di toko ini, cukup **scan barcode lamanya**.
3. Harga per gram otomatis mengikuti **harga buyback resmi** hari ini.
   Kasir bisa memberi potongan (misalnya karena rusak). Harga di atas harga resmi hanya boleh oleh owner.
4. Sistem menghitung:

   ```
   Nilai = berat emas × harga buyback/gram − potongan
   ```

   Contoh: 3,21 gram × Rp 1.650.000 − Rp 100.000 = **Rp 5.196.500**
5. Toko membayar customer (tunai/transfer), nota buyback terbit (**BB-tanggal-urutan**).
6. Barang masuk stok dengan status **buyback**, lalu bisa diproses:
   **siap dijual kembali**, **direparasi**, atau **dilebur**.

### 4.4 Tukar Tambah

Customer membawa emas lama dan mengambil barang baru dalam **satu transaksi**:

1. Kasir mengisi barang lama (seperti buyback) dan scan barang baru (seperti penjualan).
2. Sistem menghitung selisih:

   | Rincian | Nilai |
   |---|---|
   | Nilai barang lama | Rp 5.200.000 |
   | Harga barang baru | Rp 12.000.000 |
   | **Customer membayar** | **Rp 6.800.000** |

   Jika barang lama lebih mahal, sistem menghitung berapa yang harus dibayar toko ke customer.
3. Nota penjualan dan nota pembelian terbit bersamaan, semuanya tercatat sebagai satu transaksi tukar tambah.

### 4.5 Pembatalan Transaksi

- Transaksi yang salah dibatalkan oleh **manager/owner** (bukan kasir), wajib dengan alasan.
- Barang otomatis kembali tersedia, pembayaran tercatat sebagai pengembalian dana.
- Transaksi tidak pernah dihapus — tetap terlihat dengan status **Dibatalkan** beserta alasannya.

### 4.6 Tutup Toko

- **Laporan → Pembayaran & Arus Kas**: total uang per metode (tunai, QRIS, transfer, dll.)
  untuk dicocokkan dengan laci kas dan mutasi rekening.
- **Dashboard**: penjualan, buyback, emas terjual (gram), estimasi laba hari ini.

---

## 5. Proses Stok

### 5.1 Barang Masuk

| Asal barang | Menu | Keterangan |
|---|---|---|
| Stok awal / titipan | Inventory → + Tambah Stok | Input berat tiap keping, cetak label barcode |
| Pembelian dari supplier | Pembelian | Catat supplier, no. invoice, harga modal + ongkos; hutang ke supplier bisa dicicil |
| Buyback / tukar tambah | Buyback, Tukar Tambah | Masuk otomatis dari transaksi |

Setiap keping mendapat barcode unik (contoh **GOLD-000001**) yang dicetak di label.

### 5.2 Lokasi & Perpindahan

- Barang disimpan di **baki / etalase / gudang** di setiap outlet.
- Perpindahan antar baki atau antar outlet dilakukan dengan **scan barcode** di menu Transfer.

### 5.3 Reparasi, Lebur, Rusak, Hilang

- Barang bisa diubah statusnya: **reparasi → kembali tersedia** (berat baru bisa dicatat),
  **dilebur**, **rusak**, atau **hilang**.
- Status rusak, hilang, dan dilebur wajib disertai alasan.

### 5.4 Stock Opname (Hitung Fisik)

1. Petugas gudang memulai stock opname untuk satu outlet atau satu baki.
   Sistem mencatat daftar barang yang **seharusnya** ada beserta beratnya.
2. Petugas **scan setiap barang** dan (opsional) menimbang ulang.
3. Setelah selesai, sistem menampilkan hasil:

   | | Jumlah | Berat |
   |---|---|---|
   | Sistem | 120 keping | 78,52 gram |
   | Fisik | 119 keping | 78,47 gram |
   | **Selisih** | **−1 keping** | **−0,05 gram** |
   | Nilai estimasi selisih | | berdasarkan harga buyback hari ini |

4. **Owner/manager menyetujui** — baru setelah itu stok disesuaikan otomatis
   (barang tidak ditemukan menjadi *hilang*, berat dikoreksi).
   Barang yang terjual selama penghitungan tidak ikut diubah.

---

## 6. Laporan untuk Owner

Semua laporan bisa difilter per periode (hari ini, 7 hari, 30 hari, bulan ini, rentang tanggal)
dan per outlet, serta di-export ke **CSV (Excel)** atau disimpan sebagai **PDF**.

| Laporan | Isi |
|---|---|
| Laba / Rugi | Penjualan, diskon, harga pokok, **laba kotor** |
| Penjualan | Rincian barang terjual, harga, modal, laba per barang |
| Buyback | Barang yang dibeli dari customer, berat, nilai |
| Pembelian | Pembelian dari supplier dan status pembayarannya |
| Stok | Jumlah, berat emas, nilai modal, dan nilai jual per kadar/kategori |
| Mutasi | Semua perpindahan barang |
| Stock Opname | Riwayat hitung fisik dan selisihnya |
| Pembayaran & Arus Kas | Uang masuk/keluar per metode pembayaran |
| Customer | Customer dengan transaksi terbanyak |

Dashboard owner menampilkan ringkasan: penjualan, buyback, pembelian, estimasi laba,
emas terjual, emas dibeli, total berat stok, dan nilai inventory, lengkap dengan grafik.

---

## 7. Katalog Online & WhatsApp

- Setiap outlet bisa memiliki **halaman katalog publik** yang menampilkan perhiasan yang benar-benar tersedia,
  lengkap dengan foto, kadar, berat, dan harga mengikuti harga emas hari ini.
- Calon pembeli menekan tombol **"Tanya via WhatsApp"** — pesan otomatis berisi nama dan kode barang
  langsung terkirim ke WhatsApp toko.
- Katalog hanya aktif jika owner menyalakannya. Harga modal dan data customer tidak pernah ditampilkan.

---

## 8. Kontrol & Keamanan

| Kontrol | Manfaat bagi owner |
|---|---|
| Harga dihitung sistem | Kasir tidak bisa mengubah harga seenaknya |
| Buyback di atas harga resmi hanya oleh owner | Mencegah pembelian terlalu mahal |
| Pembatalan hanya oleh manager/owner + alasan | Mencegah transaksi fiktif atau dihapus |
| Setiap barang punya riwayat mutasi | Asal-usul dan pergerakan barang bisa ditelusuri |
| Catatan aktivitas (audit log) | Siapa login, siapa mengubah harga, produk, stok, hak akses — tercatat |
| Akses per outlet | Staf hanya melihat outlet tempat ia bekerja |
| Data antar toko terpisah total | Satu toko tidak bisa melihat data toko lain |
| Stock opname dengan persetujuan | Penyesuaian stok tidak bisa dilakukan diam-diam |

---

## 9. Teknis Singkat

- Berbasis web — dibuka dari browser di komputer, laptop, tablet, atau HP. Bisa di-install seperti aplikasi (PWA).
- Mendukung scanner barcode dan printer thermal 58 mm / 80 mm.
- Semua data tersimpan di server (cloud); transaksi membutuhkan koneksi internet agar selalu tervalidasi.
- Bahasa Indonesia, mata uang Rupiah, berat dalam gram.

---

## 10. Istilah

| Istilah | Arti |
|---|---|
| Kadar | Kemurnian emas, mis. 24K (99,99%), 18K (75%) |
| Berat emas | Berat total dikurangi berat batu |
| Ongkos | Biaya pembuatan perhiasan yang ditambahkan ke harga jual |
| Buyback | Toko membeli emas/perhiasan dari customer |
| Tukar tambah | Customer menukar emas lama dengan barang baru dan membayar selisihnya |
| Stock opname | Penghitungan fisik stok dibandingkan dengan catatan sistem |
| Baki | Tempat penyimpanan/display perhiasan di etalase |
| Outlet | Cabang / lokasi toko |
