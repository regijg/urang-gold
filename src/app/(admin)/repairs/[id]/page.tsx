import DataTable from "@/components/gold/DataTable";
import DocPaymentForm from "@/components/gold/DocPaymentForm";
import PageHeader from "@/components/gold/PageHeader";
import PrintButton from "@/components/gold/pos/PrintButton";
import { RepairPickupForm, RepairStatusForm } from "@/components/gold/repairs/RepairForms";
import { formatDateOnly, formatDateTime, formatGram, formatRupiah } from "@/lib/format";
import { PAYMENT_LABELS } from "@/lib/payments";
import { REPAIR_STATUS_LABELS } from "@/lib/validation/operations";
import { subRupiah } from "@/lib/validation/sales";
import { waLink } from "@/lib/whatsapp";
import { requireAppSession } from "@/server/auth/session";
import { loadPage, requirePagePermission } from "@/server/page-guard";
import { repairService, type RepairDetail } from "@/server/services/repair.service";
import { cancelRepairAction, payRepairAction, pickupRepairAction, repairStatusAction } from "../actions";
import { REPAIR_BADGE } from "@/components/gold/repairs/badge";

type Payment = RepairDetail["payments"][number];

export default async function RepairDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requirePagePermission("repairs.manage");
  const session = await requireAppSession();
  const r = await loadPage(() => repairService.get(id));
  const active = r.status !== "PICKED_UP" && r.status !== "CANCELLED";
  const cost = r.final_cost ?? r.estimated_cost;
  const netPaid = subRupiah(r.paid_total, r.refund_total);

  const readyText = [
    `*${session.tenant.name}*`,
    `Halo ${r.customer?.name ?? ""}, servis ${r.repair_number} sudah *siap diambil*.`,
    "",
    `Barang: ${r.item_description}`,
    `Servis: ${r.service_type}`,
    `Biaya: ${formatRupiah(cost)}`,
    `Sudah dibayar: ${formatRupiah(netPaid)}`,
    "",
    "Terima kasih 🙏",
  ].join("\n");

  return (
    <>
      <div className="print:hidden">
        <PageHeader title={r.repair_number} description={`${formatDateTime(r.created_at)} · ${r.customer?.name ?? ""}`} back={{ href: "/repairs", label: "Servis" }} />
      </div>
      {r.status === "CANCELLED" && (
        <div className="mb-4 rounded-lg border border-error-200 bg-error-50 px-4 py-3 text-sm text-error-700 print:hidden">
          Dibatalkan — {r.cancel_reason}. Dikembalikan {formatRupiah(r.refund_total)}.
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          {/* printable receipt (tanda terima) */}
          <div className="rounded-2xl border border-gray-200 bg-white p-5 text-sm text-gray-800 dark:border-gray-800 dark:bg-gray-900 dark:text-white/90 print:border-0 print:p-0 print:text-black">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-base font-bold">{session.tenant.name}</p>
                <p className="text-gray-500">{r.store?.name} · Tanda terima servis</p>
              </div>
              <div className="text-right">
                <p className="font-mono font-semibold">{r.repair_number}</p>
                <span className={`mt-1 inline-block rounded-full px-2.5 py-0.5 text-xs font-medium print:hidden ${REPAIR_BADGE[r.status]}`}>{REPAIR_STATUS_LABELS[r.status]}</span>
              </div>
            </div>
            <dl className="mt-4 grid gap-x-6 gap-y-2 sm:grid-cols-2">
              <div><dt className="text-xs text-gray-500">Customer</dt><dd className="font-medium">{r.customer?.name}{r.customer?.phone ? ` · ${r.customer.phone}` : ""}</dd></div>
              <div><dt className="text-xs text-gray-500">Diterima</dt><dd className="font-medium">{formatDateTime(r.created_at)}</dd></div>
              <div><dt className="text-xs text-gray-500">Barang</dt><dd className="font-medium">{r.item_description}</dd></div>
              <div><dt className="text-xs text-gray-500">Jenis servis</dt><dd className="font-medium">{r.service_type}</dd></div>
              <div><dt className="text-xs text-gray-500">Berat saat diterima</dt><dd className="font-medium">{r.weight_in ? formatGram(r.weight_in) : "-"}</dd></div>
              <div><dt className="text-xs text-gray-500">Janji selesai</dt><dd className="font-medium">{r.due_date ? formatDateOnly(r.due_date) : "-"}</dd></div>
              <div><dt className="text-xs text-gray-500">{r.final_cost ? "Biaya" : "Perkiraan biaya"}</dt><dd className="font-medium">{formatRupiah(cost)}</dd></div>
              <div><dt className="text-xs text-gray-500">Sudah dibayar</dt><dd className="font-medium">{formatRupiah(netPaid)}</dd></div>
            </dl>
            {r.notes && <p className="mt-3 text-gray-600 dark:text-gray-300 print:text-black">Catatan: {r.notes}</p>}
            <p className="mt-4 text-xs text-gray-500">Bawa tanda terima ini saat mengambil barang.</p>
            <div className="mt-4 flex flex-wrap gap-2 print:hidden">
              <PrintButton />
              {r.customer?.phone && r.status === "READY" && (
                <a href={waLink(r.customer.phone, readyText)} target="_blank" rel="noreferrer" className="rounded-lg border border-success-300 px-3 py-2 text-success-700 dark:text-success-400">
                  Kabari customer via WhatsApp
                </a>
              )}
            </div>
          </div>

          <div className="print:hidden">
            <DataTable<Payment>
              rows={r.payments}
              rowKey={(p) => p.id}
              empty="Belum ada pembayaran."
              columns={[
                { header: "Waktu", cell: (p) => formatDateTime(p.paid_at) },
                { header: "Metode", cell: (p) => PAYMENT_LABELS[p.method] ?? p.method },
                { header: "Referensi", cell: (p) => p.reference ?? "-" },
                { header: "Nominal", cell: (p) => (p.direction === "OUT" ? <span className="text-error-600">refund -{formatRupiah(p.amount)}</span> : formatRupiah(p.amount)), className: "text-right whitespace-nowrap" },
              ]}
            />
          </div>
        </div>

        {active && (
          <div className="space-y-4 print:hidden">
            <RepairPickupForm action={pickupRepairAction.bind(null, id)} paid={netPaid} defaultCost={cost} />
            <RepairStatusForm action={repairStatusAction.bind(null, id)} status={r.status} finalCost={r.final_cost ?? ""} />
            <DocPaymentForm action={payRepairAction.bind(null, id)} title="Terima pembayaran / DP" submitLabel="Catat Pembayaran" />
            <DocPaymentForm
              action={cancelRepairAction.bind(null, id)}
              title="Batalkan servis"
              hint={`Isi nominal yang dikembalikan (maks. ${formatRupiah(netPaid)}), kosongkan jika tidak ada.`}
              submitLabel="Batalkan Servis"
              amountLabel="Dikembalikan"
              withReason
              danger
              confirmText="Batalkan servis ini?"
              methods={["CASH", "BANK_TRANSFER"]}
            />
          </div>
        )}
      </div>
    </>
  );
}
