import PageHeader from "@/components/gold/PageHeader";
import PrintButton from "@/components/gold/pos/PrintButton";
import { CashMovementForm, CloseCashForm } from "@/components/gold/cash/CashForms";
import { formatDateTime, formatRupiah } from "@/lib/format";
import { loadPage, requirePagePermission } from "@/server/page-guard";
import { cashService } from "@/server/services/cash.service";
import { cashMovementAction, closeCashAction } from "../actions";

const SOURCES: { key: string; label: string; in: string; out: string }[] = [
  { key: "SALE", label: "Penjualan", in: "Tunai diterima", out: "Kembalian & refund" },
  { key: "ORDER", label: "Pesanan & DP", in: "DP / pelunasan", out: "Refund DP" },
  { key: "REPAIR", label: "Servis", in: "Pembayaran servis", out: "Refund servis" },
  { key: "BUYBACK", label: "Buyback", in: "Refund buyback", out: "Dibayar ke customer" },
  { key: "PURCHASE", label: "Pembelian supplier", in: "Refund", out: "Dibayar ke supplier" },
  { key: "EXPENSE", label: "Biaya operasional", in: "Biaya dibatalkan", out: "Biaya" },
  { key: "OTHER", label: "Lainnya", in: "Masuk", out: "Keluar" },
];

function Row({ label, value, sign, strong }: { label: string; value: string; sign?: "+" | "-"; strong?: boolean }) {
  return (
    <div className={`flex justify-between py-1.5 ${strong ? "border-t border-gray-200 pt-2 text-base font-semibold text-gray-900 dark:border-gray-700 dark:text-white" : ""}`}>
      <dt className={strong ? "" : "text-gray-500"}>{label}</dt>
      <dd className={strong ? "" : `font-medium ${sign === "-" ? "text-error-600 dark:text-error-400" : "text-gray-800 dark:text-white/90"}`}>
        {sign ?? ""}
        {formatRupiah(value)}
      </dd>
    </div>
  );
}

export default async function CashDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requirePagePermission("cash.manage");
  const { session: s, movements, totals } = await loadPage(() => cashService.get(id));
  const open = s.status === "OPEN";

  return (
    <>
      <PageHeader
        title={`Kas ${s.store?.name ?? ""}`}
        description={`${s.session_number} · dibuka ${formatDateTime(s.opened_at)}${s.closed_at ? ` · ditutup ${formatDateTime(s.closed_at)}` : ""}`}
        back={{ href: "/cash", label: "Kas Harian" }}
      />
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-4">
          <div className="rounded-2xl border border-gray-200 bg-white p-5 text-sm dark:border-gray-800 dark:bg-gray-900">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="font-semibold text-gray-900 dark:text-white">Rincian uang tunai · {s.session_number}</h2>
              <span className="print:hidden">
                <PrintButton />
              </span>
            </div>
            <dl>
              <Row label="Modal awal" value={totals.opening} sign="+" />
              {SOURCES.flatMap((src) => {
                const t = totals.sources[src.key];
                if (!t) return [];
                return [
                  t.in !== "0" ? <Row key={`${src.key}-in`} label={`${src.label} — ${src.in}`} value={t.in} sign="+" /> : null,
                  t.out !== "0" ? <Row key={`${src.key}-out`} label={`${src.label} — ${src.out}`} value={t.out} sign="-" /> : null,
                ];
              })}
              {totals.movements_in !== "0" && <Row label="Uang masuk manual" value={totals.movements_in} sign="+" />}
              {totals.movements_out !== "0" && <Row label="Uang keluar manual" value={totals.movements_out} sign="-" />}
              <Row label="Seharusnya ada di laci" value={totals.expected} strong />
              {!open && s.counted_amount !== null && (
                <>
                  <Row label="Hasil hitung" value={s.counted_amount} />
                  <div className="flex justify-between py-1.5 font-semibold">
                    <dt className="text-gray-500">Selisih</dt>
                    <dd className={s.difference === "0" ? "text-success-600" : "text-warning-600"}>
                      {s.difference === "0" ? "Cocok" : s.difference?.startsWith("-") ? `Kurang ${formatRupiah(s.difference.slice(1))}` : `Lebih ${formatRupiah(s.difference ?? "0")}`}
                    </dd>
                  </div>
                </>
              )}
            </dl>
            <p className="mt-3 text-xs text-gray-500">Hanya pembayaran tunai. Transfer, QRIS, dan kartu tidak masuk laci.</p>
            {s.close_notes && <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">Catatan tutup: {s.close_notes}</p>}
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-5 text-sm dark:border-gray-800 dark:bg-gray-900">
            <h2 className="mb-2 font-semibold text-gray-900 dark:text-white">Uang masuk / keluar manual</h2>
            {movements.length === 0 ? (
              <p className="text-gray-500">Belum ada.</p>
            ) : (
              <ul className="divide-y divide-gray-100 dark:divide-gray-800">
                {movements.map((m) => (
                  <li key={m.id} className="flex justify-between gap-3 py-2">
                    <span>
                      <span className="text-gray-800 dark:text-white/90">{m.reason}</span>
                      <span className="block text-xs text-gray-500">{formatDateTime(m.created_at)}</span>
                    </span>
                    <span className={`font-medium ${m.direction === "OUT" ? "text-error-600 dark:text-error-400" : "text-success-600"}`}>
                      {m.direction === "OUT" ? "-" : "+"}
                      {formatRupiah(m.amount)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {open && (
          <div className="space-y-4 print:hidden">
            <CashMovementForm action={cashMovementAction.bind(null, id)} />
            <CloseCashForm action={closeCashAction.bind(null, id)} expected={totals.expected} />
          </div>
        )}
      </div>
    </>
  );
}
