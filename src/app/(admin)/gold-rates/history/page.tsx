import type { Metadata } from "next";
import DataTable from "@/components/gold/DataTable";
import ListToolbar from "@/components/gold/ListToolbar";
import PageHeader from "@/components/gold/PageHeader";
import Pagination from "@/components/gold/Pagination";
import { formatDateTime, formatRupiah } from "@/lib/format";
import { parsePage } from "@/lib/validation/common";
import { loadPage } from "@/server/page-guard";
import { goldRateService } from "@/server/services/gold-rate.service";
import type { RateHistoryRow } from "@/server/repositories/gold-rate.repository";

export const metadata: Metadata = { title: "Riwayat Harga Emas | GoldPOS" };

export default async function GoldRateHistoryPage({ searchParams }: { searchParams: Promise<{ purity?: string; page?: string }> }) {
  const { purity, page } = await searchParams;
  const [history, current] = await loadPage(() =>
    Promise.all([goldRateService.history({ purityId: purity, page: parsePage(page) }), goldRateService.current()])
  );

  return (
    <>
      <PageHeader title="Riwayat Harga Emas" back={{ href: "/gold-rates", label: "Harga Emas" }} />
      <ListToolbar
        filters={[{ name: "purity", value: purity, allLabel: "Semua kadar", options: current.map((p) => ({ value: p.purity_id, label: p.code })) }]}
        showSearch={false}
      />
      <DataTable<RateHistoryRow>
        rows={history.rows}
        rowKey={(r) => r.id}
        empty="Belum ada riwayat harga."
        columns={[
          { header: "Berlaku sejak", cell: (r) => formatDateTime(r.effective_at) },
          { header: "Kadar", cell: (r) => r.purity?.code ?? "-" },
          { header: "Beli / gram", cell: (r) => formatRupiah(r.buy_price), className: "text-right" },
          { header: "Jual / gram", cell: (r) => formatRupiah(r.sell_price), className: "text-right" },
          { header: "Diubah oleh", cell: (r) => r.creator?.full_name ?? "-" },
        ]}
      />
      <Pagination page={history.page} pageSize={history.pageSize} total={history.total} basePath="/gold-rates/history" params={{ purity }} />
    </>
  );
}
