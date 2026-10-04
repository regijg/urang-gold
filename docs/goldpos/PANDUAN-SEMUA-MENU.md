# Panduan Semua Menu UrangGold

Panduan ini menjelaskan **setiap menu di sidebar**: untuk apa, siapa yang memakai, dan bagaimana alur bisnisnya.
Urutannya mengikuti urutan menu di aplikasi. Untuk gambaran besar lihat [PROSES-BISNIS.md](PROSES-BISNIS.md).

> Menu yang tampil di sidebar mengikuti **hak akses** akun. Kalau suatu menu tidak muncul, akunmu belum diberi izin.
> Hak akses tiap peran diatur owner di **Pengaturan**.

---

## Peta Menu

| # | Menu | Alamat | Izin (permission) | Singkatnya |
|---|---|---|---|---|
| 1 | Dashboard | `/dashboard` | `dashboard.view` | Ringkasan hari ini |
| 2 | Kasir (POS) | `/sales/new` | `pos.use` | Jual barang ke customer |
| 3 | Kas Harian | `/cash` | `cash.manage` | Buka dan tutup uang di laci |
| 4 | Penjualan | `/sales` | `sales.manage` | Riwayat transaksi jual |
| 5 | Buyback | `/buybacks` | `buybacks.manage` | Toko membeli emas dari customer |
| 6 | Tukar Tambah | `/trade-ins` | `trade_ins.manage` | Tukar emas lama dengan barang baru |
| 7 | Pesanan & DP | `/orders` | `orders.manage` | Barang disisihkan dengan uang muka |
| 8 | Servis | `/repairs` | `repairs.manage` | Perbaikan perhiasan milik customer |
| 9 | Master Data | `/products`, `/categories`, `/purities`, `/suppliers` | `master_data.manage` | Data dasar barang dan supplier |
| 10 | Harga Emas | `/gold-rates` | `gold_rates.manage` | Harga jual dan beli per gram |
| 11 | Inventory | `/inventory` | `inventory.view` dan lainnya | Stok fisik per keping |
| 12 | Pembelian | `/purchases` | `purchases.manage` | Beli barang dari supplier |
| 13 | Biaya Operasional | `/expenses` | `expenses.manage` | Pengeluaran toko |
| 14 | Laporan | `/reports` | `reports.view` | Laba rugi dan laporan lain |
| 15 | Customer | `/customers` | `customers.manage` | Data pelanggan |
| 16 | Pengguna | `/users` | `users.manage` | Akun staf |
| 17 | Outlet | `/stores` | `stores.manage` | Cabang toko |
| 18 | Pengaturan | `/settings` | `tenant.manage` | Profil toko dan hak akses |
| (khusus) | Platform | `/platform` | email di `PLATFORM_ADMIN_EMAILS` | Konsol pemilik aplikasi: kelola toko pelanggan |

---

## Urutan Setup Pertama Kali

Kerjakan berurutan, karena menu di bawah bergantung pada yang di atasnya:

```
1. Pengaturan  → isi profil toko
2. Outlet      → buat cabang/toko
3. Pengguna    → buat akun staf + pilih role dan akses outlet
4. Master Data → Kadar Emas → Kategori → Supplier → Produk
5. Inventory   → Lokasi & Baki, lalu Tambah Stok (stok awal) atau Pembelian
6. Harga Emas  → isi harga hari ini (wajib sebelum jual)
7. Kas Harian  → buka kas
8. Kasir       → mulai jual
```

---

## 1. Dashboard

**Untuk apa:** halaman pertama setelah login. Melihat kondisi toko hari ini dalam sekali pandang.

**Isi:**
- Ringkasan angka: penjualan, buyback, pembelian, estimasi laba, emas terjual (gram), emas dibeli, berat stok, dan nilai inventory, lengkap dengan grafik.
- Filter periode dan outlet (hari ini, 7 hari, 30 hari, bulan ini, rentang tanggal).
- **Tombol pintas** ke pekerjaan yang sering dipakai: Kasir, Buyback, Tukar Tambah, Tambah Stok, Stock Opname, Harga Emas (hanya yang kamu punya izinnya).

**Notifikasi (ikon lonceng di header)** menampilkan pengingat otomatis:
- "Harga emas belum diperbarui hari ini"
- Stock opname yang menunggu persetujuan
- "X pembelian belum lunas" (hutang ke supplier)

---

## 2. Kasir (POS)

**Untuk apa:** menjual barang ke customer. Ini menu yang paling sering dipakai kasir.

**Alur:**
0. Kalau kas outlet belum terbuka, isi **modal kas awal** di dialog **Buka Kas** yang muncul otomatis. Setelah kas terbuka, bar hijau "Kas terbuka" tampil di atas layar Kasir.
1. **Scan barcode** barang, atau cari nama barangnya.
2. Sistem menghitung harga: `berat emas × harga/gram kadar + ongkos + harga batu + margin − diskon`.
3. Pilih customer (opsional) dan beri diskon kalau diizinkan.
4. **Pembayaran** boleh dipisah ke beberapa metode: tunai, transfer, QRIS, kartu debit, kartu kredit. Kembalian hanya dari tunai.
5. Nota terbit dengan nomor **INV-tanggal-urutan**. Bisa dicetak (A4, thermal 58 atau 80 mm) atau dikirim lewat WhatsApp sebagai link e-nota.
6. Barang otomatis berstatus **Terjual** dan tidak bisa dijual dua kali.

**Pengaman:**
- Harga selalu dihitung ulang oleh sistem, kasir tidak bisa mengetik harga sendiri.
- Kalau harga emas diubah saat kasir sedang melayani, kasir diminta mengonfirmasi harga terbaru.
- **Kas outlet harus sudah dibuka.** Kalau belum, layar Kasir menampilkan dialog **Buka Kas** (isi modal awal) dan penjualan tidak bisa dilakukan sebelum kas dibuka. Server juga menolak transaksi tanpa kas terbuka.
- Barang hanya bisa dijual kalau berstatus **Tersedia** di outlet yang sama.
- Harga emas untuk kadar barang itu harus sudah diisi di menu Harga Emas.

---

## 3. Kas Harian

**Untuk apa:** mengontrol **uang tunai di laci**. Membuka kas saat toko buka dan menutupnya saat tutup, supaya selisih uang langsung ketahuan.

**Alur:**
1. **Buka kas:** isi **modal awal di laci**. Bisa dari menu Kas Harian, atau langsung dari dialog **Buka Kas** yang muncul otomatis di layar **Kasir, Buyback, dan Tukar Tambah** kalau kas outlet belum terbuka. Setiap outlet hanya boleh punya **satu kas yang terbuka** sekaligus. Nomor sesi dibuat otomatis.
2. **Selama toko buka:** semua transaksi tunai (penjualan, buyback, biaya, DP, servis) otomatis masuk hitungan. Kalau ada uang keluar-masuk di luar transaksi, catat manual lewat **Kas masuk/keluar**: tambah modal, setor ke bank, ambil untuk belanja. Keterangan wajib diisi.
3. **Tutup kas:** hitung uang fisik di laci lalu isi jumlahnya. Sistem membandingkan dengan jumlah yang **seharusnya** ada:

   ```
   Seharusnya = modal awal + tunai masuk − tunai keluar (+/− kas manual)
   ```
4. Kalau uang fisik **tidak sama** dengan seharusnya, **catatan wajib diisi** untuk menjelaskan selisihnya.
5. Riwayat semua sesi kas tersimpan (nomor, jam buka/tutup, seharusnya, dihitung, selisih).

**Kas wajib terbuka untuk:** Kasir (penjualan), **Buyback**, dan **Tukar Tambah**, karena ketiganya memindahkan uang tunai. Pesanan & DP, Servis, Pembelian, dan Biaya Operasional **tidak** diblokir, jadi admin atau manager tetap bisa mencatatnya tanpa membuka kas.

**Di layar Kasir/Buyback/Tukar Tambah:** selama kas terbuka tampil bar hijau berisi nomor sesi, jam buka, modal awal, dan tautan **Tutup Kas** (hanya untuk akun yang punya izin Kas Harian). Akun tanpa izin Kas Harian tidak bisa membuka kas sendiri dan diminta meminta akun lain yang berizin.

---

## 4. Penjualan

**Untuk apa:** **riwayat** transaksi penjualan. Untuk membuat transaksi baru pakai Kasir.

**Isi dan fungsi:**
- Daftar penjualan dengan filter status (**Selesai** atau **Dibatalkan**), periode, dan pencarian.
- Buka satu transaksi untuk melihat barang, pembayaran, dan **cetak ulang nota** atau kirim e-nota.
- **Pembatalan (void)** hanya oleh manager/owner (`sales.void`) dengan **alasan wajib**. Barang kembali tersedia dan pembayaran dicatat sebagai pengembalian dana. Transaksi tidak dihapus dan tetap tampil sebagai Dibatalkan.

---

## 5. Buyback

**Untuk apa:** toko **membeli emas atau perhiasan dari customer**. Ada dua sub-menu.

### 5a. Transaksi Buyback (`/buybacks`)

**Alur:**
1. Pilih atau tambah **data customer** (wajib, supaya asal barang tercatat).
2. Isi barang: nama, kategori, kadar, berat, berat batu. Kalau barang dulu dibeli di toko ini, cukup **scan barcode lamanya**.
3. Harga per gram otomatis mengikuti **harga buyback resmi** hari ini. Kasir boleh memberi **potongan** (mis. barang rusak). Harga di atas harga resmi hanya boleh owner.
4. Hitungan: `nilai = berat emas × harga buyback/gram − potongan`.
5. Toko membayar customer (tunai atau transfer). Nota buyback terbit dengan nomor **BB-tanggal-urutan**.
6. Barang masuk stok dengan status **Buyback**.

Pembatalan juga hanya oleh manager/owner dengan alasan.

### 5b. Barang Hasil Buyback (`/buybacks/stock`)

**Untuk apa:** mengolah barang hasil buyback. Pilihannya:
- **Pajang lagi untuk dijual:** isi ongkos, harga batu, dan margin supaya barang punya harga jual, pilih lokasi, lalu berstatus **Tersedia**.
- **Reparasi, atau tandai Dilebur** kalau tidak dijual lagi.

---

## 6. Tukar Tambah

**Untuk apa:** customer menukar emas lama dengan barang baru dalam **satu transaksi**.

**Alur:**
1. Isi **barang lama** (seperti buyback) dan scan **barang baru** (seperti penjualan).
2. Sistem menghitung selisih:

   | Rincian | Contoh |
   |---|---|
   | Nilai barang lama | Rp 5.200.000 |
   | Harga barang baru | Rp 12.000.000 |
   | **Customer membayar** | **Rp 6.800.000** |

   Kalau barang lama lebih mahal, sistem menghitung berapa yang dibayar toko ke customer.
3. Nota penjualan dan nota pembelian terbit bersamaan, tercatat sebagai satu transaksi tukar tambah.

---

## 7. Pesanan & DP

**Untuk apa:** customer **memesan barang yang sudah ada di toko dan membayar uang muka (DP)**. Barang disisihkan dan **harganya dikunci** walaupun harga emas berubah.

**Alur:**
1. **Pesanan Baru:** scan barang yang dipesan, pilih customer, tentukan rencana tanggal diambil, terima DP.
2. Barang berstatus **Dipesan**, jadi tidak bisa dijual ke orang lain. Status pesanan: **Berjalan**.
3. Customer boleh **menambah cicilan DP** selama pesanan berjalan. Pembayaran tidak boleh melebihi total.
4. **Saat diambil:** bayar sisanya. Pesanan otomatis menjadi **penjualan biasa** dengan harga yang dikunci tadi, dan status pesanan **Selesai**. Pembayaran DP ikut dipindahkan ke penjualan itu.
5. **Kalau batal:** wajib isi alasan. Barang kembali ke etalase. Toko menentukan berapa DP yang **dikembalikan** (tidak boleh lebih dari yang dibayar). **Sisanya menjadi pendapatan toko (DP hangus)** dan ikut dihitung di laba bersih.

---

## 8. Servis

**Untuk apa:** menerima **perhiasan milik customer** untuk diperbaiki: patri, cuci, ukir, ganti batu. Barang ini **bukan stok toko**.

**Alur:**
1. **Terima Servis:** isi customer, deskripsi barang, jenis servis, berat saat diterima, perkiraan biaya, janji selesai. DP boleh diterima di awal.
2. Status berjalan: **Diterima → Dikerjakan → Siap diambil → Sudah diambil** (atau **Dibatalkan**).
3. Customer bisa menambah pembayaran selama proses.
4. **Saat diambil:** isi **biaya akhir**, terima sisa pembayaran. Pendapatan servis ikut ke laporan laba bersih.
5. Kalau dibatalkan: alasan wajib, dan pengembalian DP dicatat.

Filter bawaan "Belum diambil" membantu melihat barang yang masih dititipkan.

---

## 9. Master Data

**Untuk apa:** data dasar yang dipakai semua menu lain. Isi sekali, dipakai berulang.

| Sub-menu | Isi | Contoh |
|---|---|---|
| **Kadar Emas** | Kemurnian emas dan persentasenya | 24K = 99,99%, 22K = 91,6%, 18K = 75% |
| **Kategori** | Kelompok produk | Cincin, kalung, gelang, anting |
| **Supplier** | Pemasok barang | PT Mulia Emas |
| **Produk** | Jenis barang: SKU, nama, kategori, kadar, berat standar, berat batu, harga modal, ongkos (total atau per gram), harga batu, margin, foto | CIN-001, Cincin Polos 22K |

**Catatan:**
- **Urutan membuat:** Kadar → Kategori → Supplier → Produk.
- Produk adalah **jenis barang**, bukan barang per keping. Barang per keping lahir saat Pembelian atau Tambah Stok.
- Data yang sudah dipakai sebaiknya dinonaktifkan, bukan dihapus.
- Produk menyimpan nilai standar (berat, harga modal, ongkos) yang **otomatis terisi** saat memilih produk di form Pembelian.

---

## 10. Harga Emas

**Untuk apa:** menentukan **harga jual** dan **harga beli (buyback)** per gram untuk tiap kadar. Semua harga di kasir dan buyback dihitung dari sini.

**Alur harian (pagi hari):**
1. Buka menu Harga Emas.
2. Isi harga jual dan harga beli per gram. Cukup isi 24K, lalu kadar lain dihitung sesuai persentasenya (contoh: 24K Rp 2.350.000/gram → 18K otomatis Rp 1.762.500/gram).
3. Simpan. Harga langsung berlaku di kasir.
4. Harga lama tidak hilang, tersimpan di **Riwayat Harga Emas** (`/gold-rates/history`).

**Penting:** kalau harga belum diisi untuk suatu kadar, kasir tidak bisa menjual barang kadar itu. Jika lupa memperbarui hari ini, muncul peringatan di notifikasi.

---

## 11. Inventory

**Untuk apa:** stok fisik **per keping** (nama, barcode, berat, kadar, lokasi, status). Tempat menambah stok, memindahkan barang, mencetak label, menghitung fisik, dan melihat riwayat setiap perubahan stok.

### Sub-menu

| Sub-menu | Alamat | Fungsi |
|---|---|---|
| **Daftar Stok** | `/inventory` | Lihat dan filter stok (status, outlet, kategori, kadar). Klik satu keping untuk detail, ubah status, atau edit. Tombol **+ Tambah Stok** ada di sini |
| **Tambah Stok** | `/inventory/new` | Catat barang fisik yang masuk **tanpa supplier**: stok awal, titipan |
| **Transfer** | `/inventory/transfer` | Pindah banyak barang sekaligus antar lokasi atau outlet dengan **scan barcode** |
| **Mutasi** | `/inventory/movements` | Catatan semua perubahan stok (siapa, kapan, kenapa) |
| **Stock Opname** | `/inventory/stock-opname` | Hitung fisik berdasarkan barcode dan berat, cocokkan dengan sistem |
| **Lokasi & Baki** | `/inventory/locations` | Kelola tempat penyimpanan per outlet: Baki, Slot, Etalase, Gudang |
| Cetak Label Barcode | `/inventory/labels` | Cetak label untuk ditempel di barang (dibuka dari detail barang atau detail pembelian) |

### Status barang

| Status | Arti | Bisa dijual di kasir? |
|---|---|---|
| **Tersedia** | Ada di toko dan siap dijual | Ya |
| **Terjual** | Sudah dibeli customer | Tidak (final) |
| **Buyback** | Dibeli kembali dari customer, belum dijual lagi | Setelah diset Tersedia |
| **Dipesan** | Ditahan untuk pesanan (DP) | Tidak |
| **Reparasi** | Sedang diservis | Tidak |
| **Rusak** | Rusak | Tidak |
| **Hilang** | Tidak ditemukan | Tidak |
| **Dilebur** | Sudah dilebur | Tidak (final) |
| **Batal** | Buyback dibatalkan | Tidak (final) |

Perubahan status manual yang diizinkan:

```
TERSEDIA ─► Reparasi / Dilebur / Rusak / Hilang
BUYBACK  ─► Tersedia / Reparasi / Dilebur / Rusak / Hilang
RUSAK    ─► Tersedia / Reparasi / Dilebur / Hilang
REPARASI ─► Tersedia / Rusak / Dilebur / Hilang
HILANG   ─► Tersedia (kalau ketemu lagi)
TERJUAL, DIPESAN, DILEBUR, BATAL ─► tidak bisa diubah manual
```

Status Rusak, Hilang, dan Dilebur wajib disertai alasan.

### Alur stok: dari masuk sampai keluar

```
 ┌────────────── BARANG MASUK ──────────────┐
 │ Pembelian (supplier)                     │
 │ Tambah Stok (stok awal / titipan)        │──► TERSEDIA + barcode unik
 │ Buyback / Tukar Tambah (otomatis)        │
 └──────────────────────────────────────────┘
                     │
        cetak label ─┤─ simpan di baki / etalase / gudang
                     │
     ┌───────────────┼──────────────────────────┐
     ▼               ▼                          ▼
  DIJUAL         DIPINDAH                  BERMASALAH
  di Kasir       (Transfer, scan           Reparasi → kembali Tersedia
  → TERJUAL      barcode)                  Rusak / Hilang / Dilebur
                                           (wajib alasan)
                     │
        Berkala: STOCK OPNAME (hitung fisik vs sistem)
                     │
        Semua perubahan tercatat di MUTASI
```

### Stock opname (hitung fisik)

1. Petugas memulai opname untuk satu outlet atau satu baki. Sistem menyimpan daftar barang yang **seharusnya** ada.
2. Petugas **scan tiap barang** dan, kalau perlu, menimbang ulang.
3. Setelah selesai, hasil dikirim. Sistem menampilkan **selisih** jumlah keping, berat, dan nilai estimasi.
4. **Owner/manager menyetujui.** Baru setelah itu stok disesuaikan otomatis: barang yang tidak ditemukan menjadi *Hilang* dan berat dikoreksi. Kalau ditolak, stok tidak berubah. Opname yang menunggu persetujuan muncul di notifikasi.

---

## 12. Pembelian

**Untuk apa:**
- Mencatat barang yang **dibeli dari supplier** dan langsung memasukkannya ke stok.
- Menyimpan **harga modal** dan **ongkos** tiap keping sebagai dasar hitungan margin dan laba.
- Mencatat **hutang ke supplier**: bayar lunas, sebagian, atau belum bayar, lalu dilunasi belakangan.
- Menyediakan jejak audit: tiap pembelian punya nomor, dan kesalahan **dibatalkan (void)**, bukan dihapus.

### Data yang harus ada dulu

| Data | Wajib? | Dibuat di |
|---|---|---|
| **Produk** (aktif) | Ya, dropdown hanya menampilkan produk aktif | Master Data → Produk |
| **Supplier** | Ya ("Pilih supplier" kalau kosong) | Master Data → Supplier |
| **Outlet** | Ya | Outlet |
| **Lokasi / baki** | Tidak, boleh "Tanpa lokasi" | Inventory → Lokasi & Baki |

### Alur

```
1. Barang datang dari supplier
        │
2. Pembelian → "Pembelian Baru"
        │   isi: supplier, no. invoice supplier, tanggal, outlet, lokasi
        │   isi tiap keping: pilih produk (berat, batu, harga modal, ongkos
        │   terisi otomatis dari produk, bisa diedit), no. seri
        │
3. Isi pembayaran (opsional): lunas / sebagian (DP) / kosong = hutang
        │
4. Simpan
        │   ▸ nomor pembelian dibuat
        │   ▸ tiap baris menjadi 1 keping TERSEDIA + barcode unik
        │   ▸ status bayar: BELUM LUNAS / SEBAGIAN / LUNAS
        │
5. Cetak label barcode dan tempel di barang
        │
6. Kalau belum lunas: muncul pengingat "X pembelian belum lunas" di notifikasi.
   Buka detail pembelian → "Bayar" untuk mencicil atau melunasi.
```

### Aturan penting

- **Satu baris = satu keping.** Beli 5 cincin berarti 5 baris (tombol "Duplikat baris" mempercepat).
- **Berat dan harga modal wajib diisi.** Berat batu kosong berarti mengikuti produk.
- Harga modal dan ongkos dalam rupiah bulat.
- **Pembatalan (void)** hanya bisa selama semua keping dari pembelian itu **masih Tersedia**. Alasan wajib, dan barisnya tetap tampil sebagai riwayat.
- Pembayaran ke supplier boleh dicicil beberapa kali sampai lunas.

> **Contoh:** toko beli 3 cincin 22K dari PT Mulia Emas, invoice `INV-8841`, total Rp 12.600.000, DP Rp 5.000.000 via transfer. Hasilnya: 3 keping Tersedia, status pembelian **Sebagian**, sisa hutang Rp 7.600.000. Dua minggu kemudian dilunasi dari detail pembelian, status jadi **Lunas**.

### Pembelian atau Tambah Stok: pakai yang mana?

| Situasi | Pakai | Kenapa |
|---|---|---|
| Beli dari supplier, ada invoice dan hutang | **Pembelian** | Modal, supplier, dan hutang tercatat dan ikut ke laporan |
| Pertama kali pakai aplikasi, barang sudah ada di etalase | **Tambah Stok** | Tidak ada transaksi supplier |
| Barang titipan | **Tambah Stok** | Tidak dibeli lewat supplier |
| Barang dari customer | **Buyback / Tukar Tambah** | Masuk otomatis dari transaksi itu |

### Wajib diisi sebelum menjual?

Yang wajib adalah **barangnya sudah ada di Inventory dengan status Tersedia** di outlet yang sama dengan kasir. Tidak harus lewat Pembelian: Tambah Stok juga cukup. Kalau hanya mau mencoba kasir, Tambah Stok paling cepat karena tidak butuh supplier.

### Kesalahan umum

| Masalah | Penyebab | Solusi |
|---|---|---|
| Dropdown produk kosong di form Pembelian | Belum ada produk aktif | Buat produk di Master Data |
| Tidak bisa simpan, "Pilih supplier" | Supplier belum dibuat atau dipilih | Buat di Master Data → Supplier |
| Barang tidak muncul di kasir | Status bukan Tersedia, atau beda outlet | Cek di Daftar Stok, ubah status atau transfer |
| Pembelian tidak bisa dibatalkan | Ada keping yang sudah terjual atau berubah status | Tidak bisa void, tangani lewat retur atau penyesuaian |
| Stok sistem beda dengan fisik | Salah catat atau barang hilang | Lakukan Stock Opname lalu minta persetujuan owner |
| Hutang supplier tidak terlihat | Pembayaran dikosongkan lalu lupa | Filter status **Belum lunas** di halaman Pembelian |

---

## 13. Biaya Operasional

**Untuk apa:** mencatat **pengeluaran toko** yang bukan pembelian barang: gaji, sewa, listrik, dan sebagainya. Dihitung sebagai pengurang di **laba bersih**.

**Alur:**
1. Isi form **Catat biaya**: kategori, nominal, keterangan, tanggal, dibayar dengan apa, dan outlet.
2. Kategori: Gaji & bonus, Sewa tempat, Listrik & air, Internet & pulsa, Transport & kirim, Perlengkapan toko, Perawatan & perbaikan, Pajak & retribusi, Konsumsi, Lainnya.
3. Biaya yang dibayar **tunai** ikut mengurangi uang di laci pada Kas Harian.
4. Daftar biaya bisa difilter periode (bawaan bulan ini) dan kategori, dengan total periode di atasnya.
5. Biaya yang salah dibatalkan lewat tombol **Batalkan** dengan alasan. Barisnya dicoret, tidak dihapus.

**Catatan:** untuk gaji, nama karyawan ditulis di kolom **Keterangan** (contoh: `Gaji Budi - Oktober 2026`). Belum ada data karyawan terpisah.

---

## 14. Laporan

**Untuk apa:** owner dan manager melihat **kinerja dan keuntungan** toko. Tiap laporan bisa difilter periode dan outlet, serta diekspor ke **CSV (Excel)** atau disimpan sebagai **PDF**.

| Tab | Isi |
|---|---|
| **Laba/Rugi & Ringkasan** | Penjualan, diskon, harga pokok, **laba kotor**, biaya operasional per kategori, pendapatan servis dan DP hangus, hingga **laba bersih** |
| **Penjualan** | Rincian barang terjual: harga, modal, laba per barang |
| **Buyback** | Barang yang dibeli dari customer: berat dan nilai |
| **Tukar Tambah** | Tiap transaksi tukar tambah: nilai barang lama, harga barang baru, dan selisih (minus berarti toko membayar customer) |
| **Pesanan & DP** | Pesanan berjalan dengan sisa tagihan dan DP yang sudah masuk, serta pesanan yang dibatalkan beserta **DP hangus** (pendapatan toko) |
| **Servis** | Servis diterima, yang belum diambil, yang sudah diambil, dan **pendapatan servis** (angkanya sama dengan yang masuk ke Laba Bersih) |
| **Pembelian** | Pembelian dari supplier dan status pembayarannya |
| **Biaya** | Daftar biaya operasional satu per satu (tanggal, kategori, metode bayar, nominal, yang dibatalkan beserta alasannya) dan totalnya |
| **Kas Harian** | Semua sesi kas: modal awal, seharusnya, dihitung, dan **selisih** (Cocok / Kurang / Lebih) per sesi, siapa yang membuka, serta total selisih periode |
| **Stok** | Jumlah, berat emas, nilai modal, dan nilai jual per kadar/kategori |
| **Mutasi** | Semua perpindahan barang |
| **Stock Opname** | Riwayat hitung fisik dan selisihnya |
| **Pembayaran & Arus Kas** | Uang masuk dan keluar per metode, untuk dicocokkan dengan laci kas dan mutasi rekening |
| **Customer** | Customer dengan transaksi terbanyak (ikut filter outlet) |

Tiap tab memiliki kartu ringkasan di atas tabel. Nomor dokumen (kas, pesanan, servis, tukar tambah) bisa diklik untuk membuka detailnya. Tombol **Export CSV** tersedia di semua tab. Di tab Laba/Rugi ada dua ekspor: **Laba/Rugi** (angka laba rugi beserta rincian biaya) dan **harian** (tabel per tanggal). Untuk PDF, tekan **Cetak / Simpan PDF** lalu pilih "Simpan sebagai PDF" di dialog cetak browser. Hasil cetaknya sudah dirapikan: kop laporan (nama toko, jenis laporan, periode, outlet, waktu data dan siapa yang mencetak), kartu ringkasan, tabel dengan judul kolom yang berulang di tiap halaman, kertas A4 landscape, serta kolom tanda tangan (Dibuat, Diperiksa, Disetujui) di akhir. Tampilan otomatis memakai warna terang walau aplikasi sedang di mode gelap, dan nama file PDF-nya otomatis berisi jenis laporan, periode, dan nama toko.

**Rutinitas tutup toko:** buka tab *Pembayaran & Arus Kas*, cocokkan dengan uang di laci (tutup di **Kas Harian**), lalu lihat ringkasan di Dashboard.

---

## 15. Customer

**Untuk apa:** data pelanggan toko (nama, kontak, dan seterusnya).

**Fungsi:**
- Tambah dan ubah customer.
- Di halaman customer terlihat ringkasan **total transaksi, total pembelian, dan total buyback** serta riwayat transaksinya.
- Data customer dipilih di Kasir, Buyback, Tukar Tambah, Pesanan, dan Servis. **Buyback mewajibkan customer** supaya asal barang tercatat.

---

## 16. Pengguna

**Untuk apa:** mengelola **akun staf** yang boleh memakai aplikasi. Hanya owner.

**Isi form:** nama, email, nomor HP, **role**, **akses outlet**, dan status aktif.

**Peran bawaan:**

| Role | Tugas utama |
|---|---|
| **Owner** | Semua akses: harga emas, laporan, staf, pengaturan, persetujuan opname |
| **Admin** | Mengelola produk, stok, transaksi, dan laporan |
| **Manager** | Mengawasi penjualan dan buyback, membatalkan transaksi, menyetujui opname |
| **Kasir** | Penjualan, buyback, tukar tambah, kas, pesanan, servis, customer |
| **Gudang** | Menerima barang, transfer stok, menghitung stock opname |

**Akses outlet:** staf hanya melihat dan mengubah data di outlet yang diberikan kepadanya. Nonaktifkan akun, jangan hapus, saat staf berhenti.

---

## 17. Outlet

**Untuk apa:** mengelola **cabang atau lokasi toko**. Stok, transaksi, kas, dan akses staf semuanya terikat ke outlet.

**Catatan:**
- Toko dengan satu cabang cukup satu outlet. Pilihan outlet di form otomatis tersembunyi.
- Dengan beberapa outlet, barang bisa dipindah antar outlet lewat **Inventory → Transfer**.
- Katalog online per outlet (kalau diaktifkan) menampilkan perhiasan yang tersedia, dengan tombol "Tanya via WhatsApp".

---

## 18. Pengaturan

**Untuk apa:** pengaturan toko. Hanya owner.

- **Profil toko:** nama toko/usaha (muncul di nota).
- **Hak akses tiap role** (matriks): centang apa yang boleh dilakukan Admin, Manager, Kasir, dan Gudang. Hak sensitif (mengatur staf dan pengaturan toko) hanya dimiliki owner dan tidak bisa dibagikan.

---

## Platform (khusus pemilik aplikasi UrangGold)

**Untuk apa:** mengelola **toko-toko pelanggan** yang memakai UrangGold. Menu ini **tidak muncul di sidebar** toko mana pun. Hanya akun yang emailnya terdaftar di `PLATFORM_ADMIN_EMAILS` yang bisa membukanya, dan akun itu otomatis masuk ke `/platform` saat login.

**Pendaftaran mandiri ditutup.** Siapa pun tidak bisa membuat toko sendiri. Calon pelanggan menghubungi pemilik aplikasi, lalu pemilik membuat tokonya di sini.

**Alur:**
1. Pelanggan menghubungi pemilik aplikasi dan menyepakati paket serta pembayaran.
2. Pemilik membuka `/platform` → **+ Toko Baru**: isi nama usaha, outlet pertama, paket, serta nama, email, dan password owner toko.
3. Email dan password diberikan ke pelanggan. Pelanggan login di `/login` dan mulai dari [Urutan Setup Pertama Kali](#urutan-setup-pertama-kali).
4. Di daftar toko, pemilik memantau pemakaian (outlet, pengguna, transaksi, omzet, terakhir menjual).
5. Pelanggan tidak membayar: **Tangguhkan** tokonya. Semua penggunanya langsung tidak bisa masuk, data tetap aman, dan bisa **Aktifkan** lagi setelah membayar.

Perubahan **Paket** (Gratis / Starter / Pro) saat ini hanya pencatatan dan belum membatasi fitur.

---

## Alur Besar: Dari Barang Masuk sampai Uang Masuk

```
                 SUPPLIER                       CUSTOMER
                    │                              │
               Pembelian                  Buyback / Tukar Tambah
                    │                              │
 Tambah Stok ───────┼──────────────┬───────────────┘
 (stok awal)        ▼              ▼
              ┌──────────────────────────┐
              │  INVENTORY (per keping)  │◄── Transfer, Opname, Lokasi
              └──────────────────────────┘
                    │ Tersedia
        ┌───────────┼──────────────┐
        ▼           ▼              ▼
     KASIR      PESANAN & DP    SERVIS (barang customer, bukan stok)
        │           │ diambil        │
        └───────────┴────────► PENJUALAN ─► nota
                                   │
   Semua uang masuk/keluar ────────┴──► KAS HARIAN (laci) + LAPORAN
   Biaya Operasional ─────────────────► mengurangi laba bersih
   Harga Emas (tiap pagi) ────────────► menentukan harga jual & buyback
```

---

## Jadwal Rutin yang Disarankan

| Kapan | Lakukan |
|---|---|
| **Pagi, sebelum buka** | Update **Harga Emas**, lalu **buka Kas Harian** |
| **Sepanjang hari** | Kasir, Buyback, Tukar Tambah, Pesanan, Servis |
| **Barang datang** | **Pembelian** (dari supplier) atau **Tambah Stok**, lalu cetak label barcode |
| **Ada pengeluaran** | **Biaya Operasional** |
| **Tutup toko** | **Tutup Kas Harian**, cek tab Pembayaran & Arus Kas di Laporan |
| **Berkala** (mis. bulanan) | **Stock Opname**, cek Pembelian yang belum lunas, lihat Laba/Rugi di Laporan |
