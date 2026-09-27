import type { Metadata } from "next";
import Link from "next/link";
import DataTable from "@/components/gold/DataTable";
import PageHeader from "@/components/gold/PageHeader";
import RangeFilter from "@/components/gold/RangeFilter";
import DailyChart from "@/components/gold/charts/DailyChart";
import PrintButton from "@/components/gold/pos/PrintButton";
import { resolveRange } from "@/lib/date-range";
import { formatGram, formatRupiah } from "@/lib/format";
import { PAYMENT_LABELS } from "@/lib/payments";
import { dbRupiah } from "@/lib/validation/common";
import { MOVEMENT_LABELS } from "@/lib/validation/inventory";
import { subRupiah } from "@/lib/validation/sales";
import { loadPage, requirePagePermission } from "@/server/page-guard";
import { storeService } from "@/server/services/inventory.service";
import { reportService, type CustomerReportRow, type DailyRow, type InventoryReportRow, type PaymentReportRow } from "@/server/services/report.service";

export const metadata: Metadata = { title: "Laporan | GoldPOS" };

const TABS = [
  { key: "summary", label: "Laba/Rugi & Ringkasan" },
  { key: "sales", label: "Penjualan" },
  { key: "buybacks", label: "Buyback" },
  { key: "purchases", label: "Pembelian" },
  { key: "inventory", label: "Stok" },
  { key: "movements", label: "Mutasi" },
  { key: "opname", label: "Stock Opname" },
  { key: "payments", label: "Pembayaran & Arus Kas" },
  { key: "customers", label: "Customer" },
] as const;
type Tab = (typeof TABS)[number]["key"];

type Search = { tab?: string; range?: string; from?: string; to?: string; store?: string };
type Row = Record<string, unknown>;
const one = (v: unknown) => (Array.isArray(v) ? v[0] : v) as Row | undefined;

function Line({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`flex justify-between py-1.5 ${strong ? "border-t border-gray-200 font-semibold text-gray-900 dark:border-gray-700 dark:text-white" : ""}`}>
      <dt className={strong ? "" : "text-gray-500"}>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

export default async function ReportsPage({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  await requirePagePermission("reports.view");
  const tab: Tab = (TABS.find((t) => t.key === sp.tab)?.key ?? "summary") as Tab;
  const range = resolveRange(sp);
  const stores = await loadPage(() => storeService.list());
  const qs = new URLSearchParams(Object.entries({ range: range.preset, from: range.fromDate, to: range.toDate, store: sp.store ?? "" }).filter(([, v]) => v)).toString();
  const csvKind = tab === "summary" ? "daily" : tab;

  return (
    <>
      <PageHeader title="Laporan" description={`Periode ${range.fromDate} s/d ${range.toDate}`} />
      <nav className="mb-4 flex flex-wrap gap-2 print:hidden">
        {TABS.map((t) => (
          <Link key={t.key} href={`/reports?tab=${t.key}&${qs}`} className={`rounded-lg px-3 py-1.5 text-sm ${tab === t.key ? "bg-brand-500 text-white" : "border border-gray-300 text-gray-700 dark:border-gray-700 dark:text-gray-300"}`}>
            {t.label}
          </Link>
        ))}
      </nav>
      <RangeFilter range={range} stores={stores} store={sp.store} hidden={{ tab }} />
      <div className="mb-4 flex gap-2 print:hidden">
        <a href={`/api/reports/${csvKind}?${qs}`} className="rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:text-gray-300">
          Export CSV
        </a>
        <PrintButton />
        <span className="self-center text-xs text-gray-500">Gunakan &quot;Simpan sebagai PDF&quot; pada dialog cetak untuk PDF.</span>
      </div>

      {tab === "summary" && <SummaryTab range={range} store={sp.store} />}
      {tab === "inventory" && <InventoryTab store={sp.store} />}
      {tab === "payments" && <PaymentsTab range={range} store={sp.store} />}
      {tab === "customers" && <CustomersTab range={range} />}
      {(tab === "sales" || tab === "buybacks" || tab === "purchases" || tab === "movements" || tab === "opname") && <DetailTab kind={tab} range={range} store={sp.store} />}
    </>
  );
}

async function SummaryTab({ range, store }: { range: ReturnType<typeof resolveRange>; store?: string }) {
  const [s, daily] = await loadPage(() => Promise.all([reportService.summary(range, store), reportService.daily(range, store)]));
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="rounded-2xl border border-gray-200 bg-white p-5 text-sm dark:border-gray-800 dark:bg-gray-900">
        <h2 className="mb-2 font-semibold text-gray-900 dark:text-white">Laba / Rugi</h2>
        <dl>
          <Line label={`Penjualan (${s.sales_count} transaksi, setelah diskon)`} value={formatRupiah(s.sales_total)} />
          <Line label="Diskon diberikan" value={formatRupiah(s.sales_discount)} />
          <Line label="Harga pokok penjualan (HPP)" value={`-${formatRupiah(s.sales_cost)}`} />
          <Line label="Laba kotor" value={formatRupiah(s.gross_profit)} strong />
        </dl>
        <p className="mt-2 text-xs text-gray-400">Biaya operasional belum termasuk (modul biaya belum tersedia).</p>
      </div>
      <div className="rounded-2xl border border-gray-200 bg-white p-5 text-sm dark:border-gray-800 dark:bg-gray-900">
        <h2 className="mb-2 font-semibold text-gray-900 dark:text-white">Aktivitas & Stok</h2>
        <dl>
          <Line label="Emas terjual" value={formatGram(s.sales_gold_weight)} />
          <Line label={`Buyback (${s.buyback_count} transaksi)`} value={`${formatRupiah(s.buyback_total)} · ${formatGram(s.buyback_gold_weight)}`} />
          <Line label={`Pembelian supplier (${s.purchase_count})`} value={formatRupiah(s.purchase_total)} />
          <Line label={`Stok saat ini (${s.inventory_count} keping)`} value={formatGram(s.inventory_gold_weight)} />
          <Line label="Nilai stok (modal / jual)" value={`${formatRupiah(s.inventory_cost_value)} / ${formatRupiah(s.inventory_market_value)}`} />
          <Line label="Arus kas bersih" value={formatRupiah(subRupiah(s.cash_in, s.cash_out))} strong />
        </dl>
      </div>
      <div className="rounded-2xl border border-gray-200 bg-white p-5 lg:col-span-2 dark:border-gray-800 dark:bg-gray-900">
        <DailyChart rows={daily} />
      </div>
      <div className="lg:col-span-2">
        <DataTable<DailyRow>
          rows={daily}
          rowKey={(r) => r.day}
          columns={[
            { header: "Tanggal", cell: (r) => r.day },
            { header: "Penjualan", cell: (r) => formatRupiah(r.sales_total), className: "text-right" },
            { header: "Transaksi", cell: (r) => r.sales_count, className: "text-right" },
            { header: "Emas terjual", cell: (r) => formatGram(r.gold_sold), className: "text-right" },
            { header: "Buyback", cell: (r) => formatRupiah(r.buyback_total), className: "text-right" },
            { header: "Pembelian", cell: (r) => formatRupiah(r.purchase_total), className: "text-right" },
          ]}
        />
      </div>
    </div>
  );
}

async function InventoryTab({ store }: { store?: string }) {
  const rows = await loadPage(() => reportService.inventory(store));
  return (
    <DataTable<InventoryReportRow>
      rows={rows}
      rowKey={(r) => `${r.purity_code}-${r.category_name}`}
      empty="Tidak ada stok."
      columns={[
        { header: "Kadar", cell: (r) => r.purity_code },
        { header: "Kategori", cell: (r) => r.category_name },
        { header: "Jumlah", cell: (r) => r.item_count, className: "text-right" },
        { header: "Berat emas", cell: (r) => formatGram(r.gold_weight), className: "text-right" },
        { header: "Nilai modal", cell: (r) => formatRupiah(r.cost_value), className: "text-right" },
        { header: "Nilai jual (harga hari ini)", cell: (r) => formatRupiah(r.market_value), className: "text-right" },
      ]}
    />
  );
}

async function PaymentsTab({ range, store }: { range: ReturnType<typeof resolveRange>; store?: string }) {
  const rows = await loadPage(() => reportService.payments(range, store));
  return (
    <>
      <DataTable<PaymentReportRow>
        rows={rows}
        rowKey={(r) => r.method}
        empty="Tidak ada pembayaran."
        columns={[
          { header: "Metode", cell: (r) => PAYMENT_LABELS[r.method] ?? r.method },
          { header: "Masuk", cell: (r) => formatRupiah(r.amount_in), className: "text-right" },
          { header: "Keluar", cell: (r) => formatRupiah(r.amount_out), className: "text-right" },
          { header: "Bersih (arus kas)", cell: (r) => formatRupiah(r.net), className: "text-right font-medium" },
          { header: "Transaksi", cell: (r) => r.tx_count, className: "text-right" },
        ]}
      />
      <p className="mt-2 text-xs text-gray-500">Tukar Tambah adalah kredit non-tunai (masuk di penjualan, keluar di buyback) dan selalu bersih nol.</p>
    </>
  );
}

async function CustomersTab({ range }: { range: ReturnType<typeof resolveRange> }) {
  const rows = await loadPage(() => reportService.customers(range));
  return (
    <DataTable<CustomerReportRow>
      rows={rows}
      rowKey={(r) => r.customer_id}
      empty="Tidak ada transaksi customer."
      columns={[
        { header: "Customer", cell: (r) => <Link href={`/customers/${r.customer_id}`} className="text-brand-500 hover:underline">{r.name}</Link> },
        { header: "No. HP", cell: (r) => r.phone ?? "-" },
        { header: "Beli", cell: (r) => `${r.sales_count}× · ${formatRupiah(r.sales_total)}`, className: "text-right" },
        { header: "Buyback", cell: (r) => `${r.buyback_count}× · ${formatRupiah(r.buyback_total)}`, className: "text-right" },
      ]}
    />
  );
}

async function DetailTab({ kind, range, store }: { kind: "sales" | "buybacks" | "purchases" | "movements" | "opname"; range: ReturnType<typeof resolveRange>; store?: string }) {
  const rows = await loadPage(() => reportService.detail(kind, range, store));
  const shown = rows.slice(0, 500);
  const key = (r: Row, i: number) => `${i}`;
  const table = (() => {
    switch (kind) {
      case "sales":
        return (
          <DataTable<Row>
            rows={shown}
            rowKey={(r) => key(r, shown.indexOf(r))}
            columns={[
              { header: "Invoice", cell: (r) => String(one(r.sale)?.invoice_number ?? "") },
              { header: "Barang", cell: (r) => `${r.barcode} · ${r.name}` },
              { header: "Berat emas", cell: (r) => formatGram(r.gold_weight as string), className: "text-right" },
              { header: "Jumlah", cell: (r) => formatRupiah(r.price as string), className: "text-right" },
              { header: "Modal", cell: (r) => formatRupiah(r.cost_price as string), className: "text-right" },
              { header: "Laba", cell: (r) => formatRupiah(subRupiah(dbRupiah(r.price as string), dbRupiah(r.cost_price as string))), className: "text-right" },
            ]}
          />
        );
      case "buybacks":
        return (
          <DataTable<Row>
            rows={shown}
            rowKey={(r) => key(r, shown.indexOf(r))}
            columns={[
              { header: "Nomor", cell: (r) => String(one(r.buyback)?.buyback_number ?? "") },
              { header: "Customer", cell: (r) => String(one(one(r.buyback)?.customer)?.name ?? "-") },
              { header: "Barang", cell: (r) => `${r.name} (${r.purity_code})` },
              { header: "Berat emas", cell: (r) => formatGram(r.gold_weight as string), className: "text-right" },
              { header: "Neto", cell: (r) => formatRupiah(r.net_amount as string), className: "text-right" },
            ]}
          />
        );
      case "purchases":
        return (
          <DataTable<Row>
            rows={shown}
            rowKey={(r) => key(r, shown.indexOf(r))}
            columns={[
              { header: "Nomor", cell: (r) => String(r.purchase_number) },
              { header: "Tanggal", cell: (r) => String(r.purchase_date) },
              { header: "Supplier", cell: (r) => String(one(r.supplier)?.name ?? "-") },
              { header: "Total", cell: (r) => formatRupiah(r.total as string), className: "text-right" },
              { header: "Dibayar", cell: (r) => formatRupiah(r.paid_total as string), className: "text-right" },
              { header: "Status", cell: (r) => `${r.status} / ${r.payment_status}` },
            ]}
          />
        );
      case "movements":
        return (
          <DataTable<Row>
            rows={shown}
            rowKey={(r) => key(r, shown.indexOf(r))}
            columns={[
              { header: "Waktu", cell: (r) => String(r.created_at).slice(0, 16).replace("T", " ") },
              { header: "Jenis", cell: (r) => MOVEMENT_LABELS[r.movement_type as string] ?? String(r.movement_type) },
              { header: "Barang", cell: (r) => `${one(r.inventory)?.barcode ?? ""} · ${one(r.inventory)?.name ?? ""}` },
              { header: "Qty", cell: (r) => String(r.quantity), className: "text-right" },
              { header: "Berat emas", cell: (r) => formatGram(r.weight as string), className: "text-right" },
            ]}
          />
        );
      case "opname":
        return (
          <DataTable<Row>
            rows={shown}
            rowKey={(r) => key(r, shown.indexOf(r))}
            columns={[
              { header: "Nomor", cell: (r) => String(r.opname_number) },
              { header: "Outlet", cell: (r) => String(one(r.store)?.name ?? "-") },
              { header: "Status", cell: (r) => String(r.status) },
              { header: "Selisih item", cell: (r) => String(r.diff_count), className: "text-right" },
              { header: "Selisih berat", cell: (r) => formatGram(r.diff_weight as string), className: "text-right" },
              { header: "Nilai estimasi", cell: (r) => formatRupiah(r.estimated_value as string), className: "text-right" },
            ]}
          />
        );
    }
  })();
  return (
    <>
      {table}
      {rows.length > shown.length && <p className="mt-2 text-xs text-gray-500">Menampilkan 500 dari {rows.length} baris. Gunakan Export CSV untuk data lengkap.</p>}
    </>
  );
}
