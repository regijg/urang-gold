import Link from "next/link";
import PageHeader from "@/components/gold/PageHeader";
import VoidSaleForm from "@/components/gold/pos/VoidSaleForm";
import { formatDateTime, formatRupiah } from "@/lib/format";
import { dbRupiah } from "@/lib/validation/common";
import { requireAppSession } from "@/server/auth/session";
import { loadPage } from "@/server/page-guard";
import { tradeInService } from "@/server/services/trade-in.service";
import { voidTradeInAction } from "../actions";

export default async function TradeInDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireAppSession();
  const ti = await loadPage(() => tradeInService.get(id));
  const b = BigInt(dbRupiah(ti.balance));

  return (
    <>
      <PageHeader title={ti.trade_in_number} description={`${formatDateTime(ti.created_at)} · ${ti.customer?.name ?? ""}`} back={{ href: "/trade-ins", label: "Tukar Tambah" }} />
      {ti.status === "VOIDED" && (
        <div className="mb-4 rounded-lg border border-error-200 bg-error-50 px-4 py-3 text-sm text-error-700">Dibatalkan — {ti.void_reason}</div>
      )}
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="rounded-2xl border border-gray-200 bg-white p-5 text-sm dark:border-gray-800 dark:bg-gray-900">
          <dl className="space-y-2">
            <div className="flex justify-between"><dt className="text-gray-500">Nilai barang lama (buyback)</dt><dd className="font-medium text-gray-800 dark:text-white/90"><Link href={`/buybacks/${ti.buyback_id}`} className="text-brand-500 hover:underline">{formatRupiah(ti.trade_in_value)}</Link></dd></div>
            <div className="flex justify-between"><dt className="text-gray-500">Harga barang baru (penjualan)</dt><dd className="font-medium text-gray-800 dark:text-white/90"><Link href={`/sales/${ti.sale_id}`} className="text-brand-500 hover:underline">{formatRupiah(ti.sale_total)}</Link></dd></div>
            <div className="flex justify-between text-base font-semibold text-gray-900 dark:text-white">
              <dt>{b > BigInt(0) ? "Dibayar customer" : b < BigInt(0) ? "Dibayar toko" : "Selisih"}</dt>
              <dd>{formatRupiah(ti.balance.replace("-", ""))}</dd>
            </div>
          </dl>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link href={`/nota/${ti.public_token}`} target="_blank" className="rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-700 dark:text-gray-300">E-nota publik</Link>
            <Link href={`/sales/${ti.sale_id}/print?format=80`} target="_blank" className="rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-700 dark:text-gray-300">Cetak nota jual</Link>
            <Link href={`/buybacks/${ti.buyback_id}/print?format=80`} target="_blank" className="rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-700 dark:text-gray-300">Cetak nota beli</Link>
          </div>
        </div>
        {session.permissions.includes("sales.void") && ti.status === "COMPLETED" && <VoidSaleForm action={voidTradeInAction.bind(null, id)} />}
      </div>
    </>
  );
}
