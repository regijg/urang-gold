# MASTER PROMPT — GOLDPOS

## 1. ROLE

Kamu adalah senior full-stack engineer dan software architect.

Saya ingin membangun aplikasi SaaS untuk manajemen toko emas/perhiasan bernama sementara **GoldPOS**.

Aplikasi harus dibuat dari nol menggunakan:

* Next.js
* TypeScript
* Supabase
* PostgreSQL
* Supabase Auth
* Supabase Storage
* Tailwind CSS
* PWA

Target aplikasi:

* Toko emas kecil dan menengah
* Bisa digunakan oleh satu toko maupun multi-outlet
* Bisa dikembangkan menjadi SaaS multi-tenant
* Fokus pada inventory emas/perhiasan, penjualan, buyback, trade-in, harga emas, stock opname, kasir, dan laporan

---

# 2. ATURAN PENTING

Jangan langsung membuat seluruh aplikasi sekaligus.

Bangun aplikasi secara bertahap dan terstruktur.

Sebelum coding:

1. Inspect environment/project.
2. Jelaskan struktur project yang akan dibuat.
3. Tentukan arsitektur database.
4. Tentukan hubungan antar tabel.
5. Tentukan authentication dan tenant isolation.
6. Tentukan route aplikasi.
7. Tentukan permission/role.
8. Baru mulai implementasi.

Jangan mengganti teknologi utama tanpa alasan yang kuat.

Jangan menggunakan backend terpisah jika Supabase sudah cukup.

Jangan menggunakan mock database untuk fitur production.

Gunakan Supabase/PostgreSQL sebagai source of truth.

Jangan membuat business logic penting hanya di frontend.

Semua transaksi penting harus divalidasi di server/database.

Gunakan database transaction/RPC jika sebuah transaksi mengubah beberapa tabel sekaligus.

---

# 3. PRODUCT VISION

GoldPOS adalah SaaS khusus toko emas.

Masalah utama yang ingin diselesaikan:

* Stok perhiasan berdasarkan berat dan kadar
* Harga emas yang berubah
* Penjualan berdasarkan harga emas
* Buyback emas/perhiasan
* Trade-in
* Stock opname berdasarkan gram
* Perpindahan stok antar lokasi/baki
* Barcode barang
* Riwayat harga
* Laporan penjualan
* Laporan buyback
* Laporan stok
* Katalog online
* E-nota
* Multi-user
* Multi-outlet
* Multi-tenant

Aplikasi harus sederhana digunakan kasir tetapi tetap memiliki kontrol yang kuat untuk owner.

---

# 4. MULTI-TENANT

Aplikasi harus dirancang sebagai SaaS multi-tenant.

Struktur:

Tenant
↓
Stores / Outlets
↓
Users
↓
Products
↓
Inventory
↓
Transactions

Setiap tenant hanya boleh melihat data tenant miliknya.

Jangan mengandalkan filter frontend untuk keamanan.

Gunakan Supabase Row Level Security (RLS).

Semua tabel bisnis harus memiliki:

tenant_id

Jika data berhubungan dengan outlet, gunakan:

store_id

Contoh:

tenant_id
store_id
product_id

---

# 5. USER ROLE

Minimal role:

OWNER
ADMIN
MANAGER
CASHIER
WAREHOUSE

Permission harus berbeda.

OWNER:

* Semua akses

ADMIN:

* Master data
* Inventory
* Transaksi
* Laporan

MANAGER:

* Penjualan
* Buyback
* Inventory
* Laporan

CASHIER:

* POS
* Penjualan
* Buyback
* Customer
* E-nota

WAREHOUSE:

* Inventory
* Stock opname
* Mutasi stok
* Transfer stok

Jangan hanya menyembunyikan menu.

Authorization juga harus divalidasi di server/database.

---

# 6. DATABASE DESIGN

Gunakan prefix:

gold_

Contoh:

gold_tenants
gold_stores
gold_users
gold_roles
gold_categories
gold_products
gold_product_variants
gold_gold_rates
gold_inventory
gold_inventory_movements
gold_locations
gold_stock_opnames
gold_customers
gold_suppliers
gold_sales
gold_sale_items
gold_buybacks
gold_buyback_items
gold_trade_ins
gold_purchase_orders
gold_purchase_order_items
gold_payments
gold_expenses

Nama tabel boleh disesuaikan jika ada rancangan yang lebih baik, tetapi gunakan naming convention yang konsisten.

---

# 7. GOLD PRODUCT

Produk emas tidak boleh diperlakukan seperti inventory retail biasa.

Setiap item dapat memiliki:

* SKU
* Barcode
* Nama
* Kategori
* Kadar
* Berat
* Berat emas
* Berat batu
* Jenis batu
* Harga modal
* Harga jual
* Ongkos
* Margin
* Foto
* Lokasi
* Status

Contoh:

Cincin Berlian

SKU:
RNG-00123

Kadar:
18K

Persentase:
75%

Berat:
3.21 gram

Berat batu:
0.10 gram

Berat emas:
3.11 gram

Harga jual:
Rp 8.500.000

Status:

AVAILABLE

---

# 8. GOLD PURITY

Buat master kadar emas.

Contoh:

24K
99.99%

23K
95.83%

22K
91.67%

21K
87.50%

20K
83.33%

18K
75.00%

17K
70.83%

16K
66.67%

15K
62.50%

14K
58.33%

13K
54.17%

12K
50.00%

Nilai harus configurable oleh tenant.

Jangan hardcode nilai kadar di frontend.

---

# 9. GOLD PRICE

Buat modul harga emas.

gold_gold_rates

Field minimal:

id
tenant_id
purity_id
buy_price
sell_price
effective_at
created_by
created_at

Owner dapat menentukan harga emas.

Contoh:

24K:

BUY:
Rp 2.200.000

SELL:
Rp 2.350.000

18K:

BUY:
Rp 1.650.000

SELL:
Rp 1.762.500

Simpan history perubahan harga.

Jangan overwrite history lama.

---

# 10. PRICE CALCULATION

Harga produk harus dapat menggunakan formula.

Contoh:

Berat emas:

3.21 gram

Kadar:

75%

Harga emas:

Rp 2.350.000

Nilai emas:

3.21 × 75% × 2.350.000

Kemudian:

nilai emas
+
ongkos produksi
+
batu
+
margin
------

diskon

=

harga jual

Formula harus berada di service/business logic.

Jangan membuat perhitungan penting hanya di React component.

---

# 11. INVENTORY

Inventory harus mendukung:

* Berat
* Jumlah item
* Kadar
* Lokasi
* Status
* Barcode
* SKU
* Serial/item number

Status:

AVAILABLE
SOLD
BUYBACK
RESERVED
REPAIR
MELTED
DAMAGED
LOST

Setiap perubahan stok harus menghasilkan inventory movement.

Jangan mengubah stok tanpa mencatat movement.

---

# 12. INVENTORY MOVEMENT

Jenis movement:

PURCHASE
SALE
BUYBACK
TRADE_IN
TRANSFER
ADJUSTMENT
STOCK_OPNAME
REPAIR_OUT
REPAIR_IN
MELT
RETURN

Simpan:

* quantity
* weight
* before_weight
* after_weight
* reference_type
* reference_id
* user
* timestamp

Tujuan:

Owner harus dapat melakukan audit trail.

---

# 13. LOCATION / BAKI

Buat lokasi penyimpanan.

Contoh:

Outlet Jakarta

Baki A
A-01
A-02
A-03

Baki B
B-01
B-02

Gudang
G-01

Produk harus dapat dipindahkan:

Baki A-01
→
Baki B-03

Transfer harus menghasilkan movement.

---

# 14. STOCK OPNAME

Stock opname harus mendukung:

System:

78.52 gram

Physical:

78.47 gram

Difference:

-0.05 gram

Tampilkan:

* Selisih gram
* Selisih jumlah item
* Nilai estimasi
* User
* Waktu
* Approval

Owner/manager dapat approve adjustment.

---

# 15. POS SALES

Buat halaman POS.

Kasir dapat:

* Search produk
* Scan barcode
* Tambah produk
* Ubah quantity jika diperbolehkan
* Diskon
* Customer
* Pembayaran
* Cetak/kirim nota

Contoh:

Cincin 18K
3.21 gram

Harga:
Rp 8.500.000

Diskon:
Rp 250.000

Total:
Rp 8.250.000

---

# 16. PAYMENT

Support:

CASH
BANK_TRANSFER
QRIS
DEBIT_CARD
CREDIT_CARD

Buat payment abstraction agar provider pembayaran dapat ditambahkan kemudian.

Jangan mengunci architecture ke satu payment provider.

---

# 17. BUYBACK

Ini adalah salah satu modul utama.

Kasir dapat membuat transaksi:

Customer menjual emas/perhiasan kepada toko.

Input:

* Customer
* Produk
* Kadar
* Berat
* Harga buyback
* Potongan
* Total
* Payment method

Contoh:

18K

3.21 gram

Buyback:

Rp 1.650.000 / gram

Gross:

3.21 × 1.650.000

Potongan:

Rp 100.000

Net:

Gross - Potongan

Setelah transaksi:

Inventory movement:

BUYBACK

Barang masuk ke inventory.

Status awal:

BUYBACK

Kemudian dapat diproses:

AVAILABLE
REPAIR
MELTED

---

# 18. TRADE-IN

Support transaksi:

Customer membawa barang lama.

Barang lama:

BUYBACK VALUE
Rp 5.200.000

Barang baru:

Rp 12.000.000

Customer membayar:

Rp 6.800.000

Satu transaksi dapat memiliki:

buyback item
+
sale item
+
payment

Semua harus tercatat dalam audit trail.

---

# 19. PURCHASE FROM SUPPLIER

Owner dapat mencatat pembelian barang dari supplier.

Data:

Supplier
Invoice
Tanggal
Produk
Kadar
Berat
Harga modal
Ongkos
Total

Setelah purchase:

inventory bertambah.

---

# 20. CUSTOMER

Customer:

* Nama
* Nomor HP
* Email optional
* Alamat optional
* Catatan
* Transaction history

Customer dapat melihat:

* Penjualan
* Buyback
* Trade-in
* Total transaksi

---

# 21. BARCODE

Setiap item dapat memiliki barcode.

Format contoh:

GOLD-000001

Barcode harus unik dalam tenant.

POS harus dapat mencari barang menggunakan barcode.

---

# 22. PRODUCT PHOTO

Gunakan Supabase Storage.

Bucket:

gold-products

Support:

* Upload
* Replace
* Delete
* Preview

Jangan menyimpan binary image langsung di PostgreSQL.

Simpan URL/path storage di database.

---

# 23. DASHBOARD

Dashboard OWNER menampilkan:

Today's Sales
Today's Buyback
Today's Purchase
Estimated Profit
Gold Sold
Gold Buyback
Total Inventory Weight
Inventory Value

Charts:

Sales
Buyback
Purchase
Inventory

Filter:

Today
7 Days
30 Days
This Month
Custom Date Range

---

# 24. REPORT

Minimal:

Sales Report
Buyback Report
Purchase Report
Inventory Report
Inventory Movement
Stock Opname
Profit/Loss
Payment Report
Cash Flow
Customer Report

Export:

CSV
PDF

---

# 25. ONLINE CATALOG

Buat public catalog.

Contoh:

/store/[slug]

Customer dapat:

* Melihat toko
* Melihat harga emas
* Melihat produk
* Filter kategori
* Melihat foto
* Melihat berat
* Melihat kadar
* Melihat harga
* Contact WhatsApp

Jangan membuat marketplace.

Fokus:

Catalog → WhatsApp.

---

# 26. E-NOTA

Setiap transaksi memiliki invoice.

Format:

INV-20260927-000001

Nota harus menampilkan:

Nama toko
Alamat
Nomor invoice
Tanggal
Kasir
Customer
Produk
Kadar
Berat
Harga
Diskon
Total
Payment method

Siapkan desain untuk:

A4
Thermal printer 58mm
Thermal printer 80mm

---

# 27. AUDIT LOG

Semua aktivitas penting dicatat.

Contoh:

LOGIN
CREATE_PRODUCT
UPDATE_PRODUCT
DELETE_PRODUCT
CHANGE_GOLD_PRICE
SALE
BUYBACK
TRADE_IN
PURCHASE
TRANSFER_STOCK
STOCK_OPNAME
ADJUSTMENT
REFUND

Audit log minimal:

user_id
tenant_id
action
entity_type
entity_id
old_data
new_data
created_at

---

# 28. SECURITY

Gunakan:

Supabase Auth

Row Level Security.

Tenant isolation harus ketat.

User tidak boleh:

* Membaca tenant lain
* Mengubah tenant lain
* Mengakses outlet yang tidak memiliki permission

Validasi server-side.

Jangan percaya:

tenant_id
user_id
price
total
discount

yang dikirim langsung dari browser.

Server/database harus melakukan validasi ulang.

---

# 29. DATABASE RULE

Gunakan migration.

Jangan melakukan perubahan schema manual yang tidak terdokumentasi.

Setiap perubahan database harus menghasilkan migration.

Gunakan foreign key.

Gunakan index untuk:

tenant_id
store_id
barcode
sku
created_at
status

Gunakan numeric/decimal untuk:

gram
harga
nilai transaksi

Jangan menggunakan floating point untuk nilai uang atau berat emas.

---

# 30. ROUTING

Gunakan struktur seperti:

/login

/dashboard

/products
/products/new
/products/[id]

/inventory
/inventory/movements
/inventory/stock-opname

/gold-rates

/sales
/sales/new
/sales/[id]

/buybacks
/buybacks/new
/buybacks/[id]

/trade-ins
/trade-ins/new

/purchases

/customers

/suppliers

/stores

/users

/reports

/settings

/store/[slug]

Sesuaikan jika architecture membutuhkan struktur berbeda.

---

# 31. UI/UX

UI harus modern tetapi sederhana.

Target pengguna:

Kasir toko emas.

Jangan membuat UI terlalu kompleks.

Desktop:

Sidebar
Topbar
Dashboard
Content

Mobile:

Responsive.

POS harus nyaman digunakan di tablet.

Gunakan Bahasa Indonesia untuk UI.

Currency:

IDR / Rupiah.

Weight:

gram.

Format:

Rp 8.500.000
3,21 gram

---

# 32. DESIGN PRINCIPLE

Gunakan design system yang konsisten.

Jangan mengubah style secara sembarangan ketika mengerjakan modul baru.

Component reusable:

Button
Input
Select
Modal
Drawer
Table
DataTable
Badge
Card
Dialog
Form
CurrencyInput
WeightInput
BarcodeInput
DatePicker

---

# 33. ARCHITECTURE

Gunakan separation:

UI
↓
Server Action / Route Handler
↓
Service
↓
Repository / Supabase
↓
PostgreSQL

Business logic jangan diletakkan di:

React component
Page component

Gunakan service layer untuk:

Price calculation
Sale
Buyback
Trade-in
Inventory movement
Stock opname

---

# 34. ERROR HANDLING

Gunakan response yang konsisten.

Contoh:

{
"success": true,
"message": "Transaksi berhasil",
"data": {}
}

Error:

{
"success": false,
"message": "Stok tidak mencukupi",
"code": "INSUFFICIENT_STOCK"
}

Jangan expose error database mentah kepada user.

---

# 35. TRANSACTION INTEGRITY

Transaksi penjualan harus atomic.

Contoh:

SALE

1. Validate product
2. Validate stock
3. Calculate price
4. Create sale
5. Create sale items
6. Create payment
7. Update inventory
8. Create inventory movement
9. Create audit log

Jika salah satu gagal:

ROLLBACK.

Hal yang sama berlaku untuk:

BUYBACK
TRADE-IN
PURCHASE
STOCK TRANSFER
STOCK ADJUSTMENT

---

# 36. TESTING

Minimal:

Unit test:

Price calculation
Gold purity calculation
Buyback calculation
Discount calculation

Integration test:

Sale
Buyback
Trade-in
Inventory movement
Stock opname

Security test:

Tenant isolation
Role permissions
RLS

---

# 37. DEVELOPMENT PHASE

Jangan implementasikan semua sekaligus.

PHASE 1:

Project setup
Supabase
Authentication
Tenant
Store
User
Role
RLS
Dashboard skeleton

PHASE 2:

Master data

Categories
Gold purity
Products
Customers
Suppliers

PHASE 3:

Gold price

Gold rate
Price calculation
Price history

PHASE 4:

Inventory

Inventory
Location
Baki
Movement
Barcode

PHASE 5:

POS

Sales
Payment
Invoice
E-nota

PHASE 6:

Buyback

Buyback
Inventory integration
Payment

PHASE 7:

Trade-in

Buyback + Sale

PHASE 8:

Purchase

Supplier
Purchase
Inventory

PHASE 9:

Stock opname

Physical count
Difference
Approval
Adjustment

PHASE 10:

Reports

Sales
Buyback
Inventory
Profit
Cashflow

PHASE 11:

Online catalog

Public store
Product catalog
WhatsApp

PHASE 12:

PWA
Performance
Security hardening
Production deployment

---

# 38. CLAUDE CODE WORKFLOW

Untuk setiap phase:

1. Inspect existing project.
2. Buat implementation plan.
3. Jelaskan file yang akan dibuat/diubah.
4. Implement.
5. Run type checking.
6. Run lint.
7. Run tests.
8. Fix errors.
9. Verify database migration.
10. Review security.
11. Berikan summary perubahan.

Jangan melanjutkan phase berikutnya sebelum phase saat ini stabil.

Jika menemukan masalah architecture:

STOP.

Jelaskan masalahnya.

Jangan melakukan rewrite besar-besaran tanpa persetujuan.

---

# 39. IMPORTANT

Saya lebih memilih:

SIMPLE
STABLE
MAINTAINABLE

daripada:

COMPLEX
OVERENGINEERED

Aplikasi harus bisa berjalan dengan biaya rendah menggunakan:

Vercel
+
Supabase

Jangan menambahkan Redis, Kafka, Kubernetes, microservices, atau infrastructure kompleks kecuali benar-benar diperlukan.

---

# 40. FIRST TASK

Untuk sekarang JANGAN membuat semua modul.

Mulai dari:

1. Inspect environment.
2. Setup Next.js jika project belum ada.
3. Setup TypeScript.
4. Setup Tailwind.
5. Setup Supabase.
6. Buat environment variables.
7. Buat database migration awal.
8. Buat:

gold_tenants
gold_stores
gold_users
gold_roles

9. Implement authentication.
10. Implement tenant isolation.
11. Implement RLS.
12. Buat dashboard dasar.
13. Jalankan typecheck.
14. Jalankan lint.
15. Jalankan tests.

Setelah selesai, berhenti.

Jangan mengerjakan PHASE 2 sampai saya memberikan instruksi berikutnya.

---

# 41. FINAL REQUIREMENT

Sebelum melakukan coding, inspect repository/project yang tersedia.

Jika project masih kosong, buat architecture dari awal.

Jika sudah ada project, jangan overwrite atau rewrite bagian yang tidak diperlukan.

Prioritaskan:

correctness
security
database integrity
tenant isolation
maintainability
performance

di atas jumlah fitur.

Mulai sekarang dengan **PHASE 1**.
