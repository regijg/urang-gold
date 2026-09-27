-- ================================================================
-- HAPUS POS_ORDERS + KEMBALIKAN STOK BAHAN BAKU
-- ================================================================
-- Relasi:
--   pos_orders
--     └── pos_order_items (ON DELETE CASCADE)
--           └── pos_product_ingredients (product_id → stock_id, qty/unit)
--                 └── pos_stocks (quantity dikurangi saat order dibuat)
--
-- PENTING: Jalankan SELALU sebagai satu blok BEGIN…COMMIT.
--          Jangan pisah UPDATE dan DELETE — stock tidak akan kembali
--          kalau order_items sudah terhapus duluan.
-- ================================================================


-- ================================================================
-- LANGKAH 0 — PREVIEW (tidak ada perubahan data, jalankan dulu)
-- ================================================================
SELECT
  s.id,
  s.name                                       AS bahan_baku,
  s.unit,
  s.quantity                                   AS stok_sekarang,
  SUM(pi.quantity * oi.quantity)               AS akan_dikembalikan,
  s.quantity + SUM(pi.quantity * oi.quantity)  AS stok_setelah_restore
FROM pos_order_items          oi
JOIN pos_product_ingredients  pi ON pi.product_id = oi.product_id
JOIN pos_stocks               s  ON s.id           = pi.stock_id
JOIN pos_orders               o  ON o.id           = oi.order_id
-- WHERE o.id IN (1, 2, 3)
-- WHERE o.created_at < '2026-06-01'
GROUP BY s.id, s.name, s.unit, s.quantity
ORDER BY s.name;


-- ================================================================
-- LANGKAH 1 — EKSEKUSI (pilih salah satu varian)
-- ================================================================

-- ── VARIAN A: Hapus SEMUA order ──────────────────────────────────
BEGIN;

  UPDATE pos_stocks s
  SET quantity = s.quantity + restore.total_restore, updated_at = NOW()
  FROM (
    SELECT pi.stock_id, SUM(pi.quantity * oi.quantity) AS total_restore
    FROM pos_order_items         oi
    JOIN pos_product_ingredients pi ON pi.product_id = oi.product_id
    GROUP BY pi.stock_id
  ) restore
  WHERE s.id = restore.stock_id;

  DELETE FROM pos_orders;  -- pos_order_items ikut terhapus via CASCADE

COMMIT;


-- ── VARIAN B: Hapus by ID ─────────────────────────────────────────
-- BEGIN;
--   UPDATE pos_stocks s
--   SET quantity = s.quantity + restore.total_restore, updated_at = NOW()
--   FROM (
--     SELECT pi.stock_id, SUM(pi.quantity * oi.quantity) AS total_restore
--     FROM pos_order_items         oi
--     JOIN pos_product_ingredients pi ON pi.product_id = oi.product_id
--     WHERE oi.order_id IN (1, 2, 3)   -- ← ganti ID
--     GROUP BY pi.stock_id
--   ) restore
--   WHERE s.id = restore.stock_id;
--   DELETE FROM pos_orders WHERE id IN (1, 2, 3);
-- COMMIT;


-- ── VARIAN C: Hapus by tanggal ────────────────────────────────────
-- BEGIN;
--   UPDATE pos_stocks s
--   SET quantity = s.quantity + restore.total_restore, updated_at = NOW()
--   FROM (
--     SELECT pi.stock_id, SUM(pi.quantity * oi.quantity) AS total_restore
--     FROM pos_order_items         oi
--     JOIN pos_product_ingredients pi ON pi.product_id = oi.product_id
--     JOIN pos_orders              o  ON o.id = oi.order_id
--     WHERE o.created_at < '2026-06-01'  -- ← ganti tanggal
--     GROUP BY pi.stock_id
--   ) restore
--   WHERE s.id = restore.stock_id;
--   DELETE FROM pos_orders WHERE created_at < '2026-06-01';
-- COMMIT;


-- ================================================================
-- LANGKAH 2 — VERIFIKASI
-- ================================================================
SELECT id, name, unit, quantity, updated_at FROM pos_stocks ORDER BY name;
SELECT COUNT(*) AS sisa_order       FROM pos_orders;
SELECT COUNT(*) AS sisa_order_items FROM pos_order_items;


-- ================================================================
-- DARURAT: order_items sudah terhapus sebelum stock sempat direstore
-- ================================================================
-- Rekonstruksi dari total pembelian - pemakaian manual.
-- Akurat hanya kalau semua transaksi tercatat di pos_stock_purchases
-- dan pos_stock_usages. Konsumsi dari order yang hilang tidak bisa
-- dihitung ulang — perlu koreksi manual setelahnya.
--
-- BEGIN;
--   UPDATE pos_stocks s
--   SET quantity = COALESCE(net.sisa, 0), updated_at = NOW()
--   FROM (
--     SELECT
--       s.id AS stock_id,
--       COALESCE(SUM(sp.quantity), 0) - COALESCE(SUM(su.quantity), 0) AS sisa
--     FROM pos_stocks       s
--     LEFT JOIN pos_stock_purchases sp ON sp.stock_id = s.id
--     LEFT JOIN pos_stock_usages    su ON su.stock_id = s.id
--     GROUP BY s.id
--   ) net
--   WHERE s.id = net.stock_id;
-- COMMIT;


Alur yang benar setiap kali mau hapus order:

Jalankan Langkah 0 dulu → cek preview stok yang akan kembali
Jalankan Langkah 1 (varian sesuai kebutuhan) sebagai satu blok
Jalankan Langkah 2 → verifikasi hasil

------------------------------------------------------------------------------------------------
 
Jika tabel sudah kosong — reset ke 1:


ALTER SEQUENCE pos_orders_id_seq      RESTART WITH 1;
ALTER SEQUENCE pos_order_items_id_seq RESTART WITH 1;

------------------------------------------------------------------------------------------------

Jika tabel masih punya sebagian data — reset ke max ID + 1 (aman):


SELECT setval('pos_orders_id_seq',      COALESCE(MAX(id), 0) + 1, false) FROM pos_orders;
SELECT setval('pos_order_items_id_seq', COALESCE(MAX(id), 0) + 1, false) FROM pos_order_items;