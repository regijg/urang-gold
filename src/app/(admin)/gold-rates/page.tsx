import type { Metadata } from "next";
import Link from "next/link";
import DataTable from "@/components/gold/DataTable";
import GoldRatesForm from "@/components/gold/GoldRatesForm";
import PageHeader from "@/components/gold/PageHeader";
import { formatDateTime, formatPercent, formatRupiah } from "@/lib/format";
import { requireAppSession } from "@/server/auth/session";
import { loadPage } from "@/server/page-guard";
import { goldRateService } from "@/server/services/gold-rate.service";
import type { CurrentRateRow } from "@/server/repositories/gold-rate.repository";
import { updateGoldRatesAction } from "./actions";

export const metadata: Metadata = { title: "Harga Emas | UrangGold" };

export default async function GoldRatesPage() {
  const session = await requireAppSession();
  const canManage = session.permissions.includes("gold_rates.manage");
  const rows = await loadPage(() => goldRateService.current());

  return (
    <>
      <PageHeader title="Harga Emas" description="Harga beli (buyback) dan harga jual per gram untuk setiap kadar." />
      <div className="mb-4">
        <Link href="/gold-rates/history" className="text-sm font-medium text-brand-500 hover:underline">
          Lihat riwayat harga →
        </Link>
      </div>
      {canManage ? (
        <GoldRatesForm rows={rows} action={updateGoldRatesAction} />
      ) : (
        <DataTable<CurrentRateRow>
          rows={rows}
          rowKey={(r) => r.purity_id}
          columns={[
            { header: "Kadar", cell: (r) => `${r.code} (${formatPercent(r.percentage)})` },
            { header: "Beli / gram", cell: (r) => (r.buy_price ? formatRupiah(r.buy_price) : "-"), className: "text-right" },
            { header: "Jual / gram", cell: (r) => (r.sell_price ? formatRupiah(r.sell_price) : "-"), className: "text-right" },
            { header: "Berlaku sejak", cell: (r) => (r.effective_at ? formatDateTime(r.effective_at) : "-") },
          ]}
        />
      )}
    </>
  );
}
