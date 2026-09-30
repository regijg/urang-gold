import type { Metadata } from "next";
import Link from "next/link";
import DataTable from "@/components/gold/DataTable";
import ListToolbar from "@/components/gold/ListToolbar";
import PageHeader from "@/components/gold/PageHeader";
import Pagination from "@/components/gold/Pagination";
import PieceStatusBadge from "@/components/gold/PieceStatusBadge";
import { LabelPrintBar, LabelRowCheckbox, LabelSelectAll } from "@/components/gold/inventory/LabelSelection";
import { formatGram, formatRupiah } from "@/lib/format";
import { parsePage } from "@/lib/validation/common";
import { PIECE_STATUSES, STATUS_LABELS } from "@/lib/validation/inventory";
import { requireAppSession } from "@/server/auth/session";
import { loadPage } from "@/server/page-guard";
import { inventoryService, storeService } from "@/server/services/inventory.service";
import { categoryService, purityService } from "@/server/services/master-data.service";
import type { InventoryRow } from "@/server/repositories/inventory.repository";

export const metadata: Metadata = { title: "Inventory | UrangGold" };

type Search = { q?: string; page?: string; store?: string; location?: string; status?: string; category?: string; purity?: string };

export default async function InventoryPage({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  const session = await requireAppSession();
  const can = (p: Parameters<typeof session.permissions.includes>[0]) => session.permissions.includes(p);

  const [data, stores, categories, purities] = await loadPage(() =>
    Promise.all([
      inventoryService.list({
        q: sp.q,
        page: parsePage(sp.page),
        storeId: sp.store,
        locationId: sp.location,
        status: sp.status ?? "AVAILABLE",
        categoryId: sp.category,
        purityId: sp.purity,
      }),
      storeService.list(),
      categoryService.list({ pageSize: 500 }),
      purityService.list({ pageSize: 500 }),
    ])
  );
  const status = sp.status ?? "AVAILABLE";

  return (
    <>
      <PageHeader
        title="Inventory"
        description="Stok fisik per keping."
        action={can("inventory.manage") ? { href: "/inventory/new", label: "+ Tambah Stok" } : null}
      />
      <div className="mb-4 flex flex-wrap gap-4 text-sm">
        {can("inventory.view") && <Link href="/inventory/movements" className="font-medium text-brand-500 hover:underline">Riwayat Mutasi</Link>}
        {can("stock_transfer.manage") && <Link href="/inventory/transfer" className="font-medium text-brand-500 hover:underline">Transfer Stok</Link>}
        <Link href="/inventory/locations" className="font-medium text-brand-500 hover:underline">Lokasi & Baki</Link>
        <Link href="/inventory/stock-opname" className="font-medium text-brand-500 hover:underline">Stock Opname</Link>
      </div>

      <div className="mb-4 grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
          <p className="text-sm text-gray-500">Jumlah keping</p>
          <p className="mt-2 text-2xl font-semibold text-gray-900 dark:text-white">{data.summary.count.toLocaleString("id-ID")}</p>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
          <p className="text-sm text-gray-500">Total berat emas</p>
          <p className="mt-2 text-2xl font-semibold text-gray-900 dark:text-white">{formatGram(data.summary.goldWeight)}</p>
        </div>
      </div>

      <ListToolbar
        q={sp.q}
        placeholder="Cari barcode, nama, atau no. seri"
        hidden={{ location: sp.location }}
        filters={[
          { name: "status", value: status, allLabel: "Semua status", options: PIECE_STATUSES.map((s) => ({ value: s, label: STATUS_LABELS[s] })) },
          { name: "store", value: sp.store, allLabel: "Semua outlet", options: stores.map((s) => ({ value: s.id, label: s.name })) },
          { name: "category", value: sp.category, allLabel: "Semua kategori", options: categories.rows.map((c) => ({ value: c.id, label: c.name })) },
          { name: "purity", value: sp.purity, allLabel: "Semua kadar", options: purities.rows.map((p) => ({ value: p.id, label: p.code })) },
        ]}
      />

      <DataTable<InventoryRow>
        rows={data.rows}
        rowKey={(r) => r.id}
        empty="Tidak ada barang untuk filter ini."
        columns={[
          { key: "select", header: <LabelSelectAll />, cell: (r) => <LabelRowCheckbox id={r.id} label={r.barcode} />, className: "w-8 print:hidden" },
          {
            header: "Barang",
            cell: (r) => (
              <div>
                <Link href={`/inventory/${r.id}`} className="font-medium text-brand-500 hover:underline">{r.name}</Link>
                <p className="font-mono text-xs text-gray-500">
                  {r.barcode}
                  {r.product && <span className="ml-2 font-sans text-gray-400">· SKU {r.product.sku}</span>}
                </p>
              </div>
            ),
          },
          { header: "Kadar", cell: (r) => r.purity?.code ?? "-" },
          { header: "Berat", cell: (r) => formatGram(r.gross_weight), className: "text-right whitespace-nowrap" },
          { header: "Berat Emas", cell: (r) => formatGram(r.gold_weight), className: "text-right whitespace-nowrap" },
          {
            header: "Harga Jual",
            cell: (r) => {
              const p = data.prices.get(r.id);
              return p ? formatRupiah(p) : <span className="text-xs text-gray-400">-</span>;
            },
            className: "text-right whitespace-nowrap",
          },
          { header: "Lokasi", cell: (r) => `${r.store?.name ?? "-"}${r.location ? ` · ${r.location.code}` : ""}` },
          { header: "Status", cell: (r) => <PieceStatusBadge status={r.status} /> },
        ]}
      />
      <LabelPrintBar />
      <Pagination
        page={data.page}
        pageSize={data.pageSize}
        total={data.total}
        basePath="/inventory"
        params={{ q: sp.q, store: sp.store, location: sp.location, status, category: sp.category, purity: sp.purity }}
      />
    </>
  );
}
