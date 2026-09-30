import type { Metadata } from "next";
import Link from "next/link";
import DataTable from "@/components/gold/DataTable";
import ListToolbar from "@/components/gold/ListToolbar";
import PageHeader from "@/components/gold/PageHeader";
import Pagination from "@/components/gold/Pagination";
import BuybackStockActions from "@/components/gold/inventory/BuybackStockActions";
import { formatDateTime, formatGram, formatRupiah } from "@/lib/format";
import { parsePage } from "@/lib/validation/common";
import { loadPage, requirePagePermission } from "@/server/page-guard";
import { inventoryService, locationService } from "@/server/services/inventory.service";
import { purityService } from "@/server/services/master-data.service";
import type { InventoryRow } from "@/server/repositories/inventory.repository";
import { changeStatusAction, resellBuybackAction } from "../../inventory/actions";

export const metadata: Metadata = { title: "Barang Hasil Buyback | UrangGold" };

export default async function BuybackStockPage({ searchParams }: { searchParams: Promise<{ q?: string; purity?: string; page?: string }> }) {
  const sp = await searchParams;
  await requirePagePermission("inventory.manage");
  const [data, purities, locations] = await loadPage(() =>
    Promise.all([
      inventoryService.list({ q: sp.q, status: "BUYBACK", purityId: sp.purity, page: parsePage(sp.page) }),
      purityService.list({ pageSize: 500 }),
      locationService.list({ activeOnly: true }),
    ])
  );

  return (
    <>
      <PageHeader title="Barang Hasil Buyback" description="Emas yang dibeli dari customer. Pajang lagi untuk dijual, atau tandai dilebur." back={{ href: "/buybacks", label: "Buyback" }} />
      <div className="mb-4 grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
          <p className="text-sm text-gray-500">Jumlah barang</p>
          <p className="mt-1 text-2xl font-semibold text-gray-900 dark:text-white">{data.summary.count.toLocaleString("id-ID")}</p>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
          <p className="text-sm text-gray-500">Total berat emas</p>
          <p className="mt-1 text-2xl font-semibold text-gray-900 dark:text-white">{formatGram(data.summary.goldWeight)}</p>
        </div>
      </div>
      <ListToolbar
        q={sp.q}
        placeholder="Cari barcode atau nama"
        filters={[{ name: "purity", value: sp.purity, allLabel: "Semua kadar", options: purities.rows.map((p) => ({ value: p.id, label: p.code })) }]}
      />
      <DataTable<InventoryRow>
        rows={data.rows}
        rowKey={(r) => r.id}
        empty="Tidak ada barang hasil buyback."
        columns={[
          {
            header: "Barang",
            cell: (r) => (
              <div>
                <Link href={`/inventory/${r.id}`} className="font-medium text-brand-500 hover:underline">{r.name}</Link>
                <p className="font-mono text-xs text-gray-500">{r.barcode} · {formatDateTime(r.received_at)}</p>
              </div>
            ),
          },
          { header: "Kadar", cell: (r) => r.purity?.code ?? "-" },
          { header: "Berat emas", cell: (r) => formatGram(r.gold_weight), className: "text-right whitespace-nowrap" },
          { header: "Harga beli", cell: (r) => formatRupiah(r.cost_price), className: "text-right whitespace-nowrap" },
          {
            key: "act",
            header: "",
            cell: (r) => (
              <BuybackStockActions
                resellAction={resellBuybackAction.bind(null, r.id)}
                meltAction={changeStatusAction.bind(null, r.id)}
                locations={locations.filter((l) => l.store_id === r.store_id)}
              />
            ),
            className: "text-right",
          },
        ]}
      />
      <Pagination page={data.page} pageSize={data.pageSize} total={data.total} basePath="/buybacks/stock" params={{ q: sp.q, purity: sp.purity }} />
    </>
  );
}
