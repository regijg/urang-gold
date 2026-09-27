import DataTable from "@/components/gold/DataTable";
import PageHeader from "@/components/gold/PageHeader";
import { OpnameCounter, OpnameReviewForm, UnscanButton } from "@/components/gold/inventory/OpnameScreen";
import { formatDateTime, formatGram, formatRupiah } from "@/lib/format";
import { requireAppSession } from "@/server/auth/session";
import { loadPage } from "@/server/page-guard";
import { stockOpnameService, type OpnameItem } from "@/server/services/stock-opname.service";
import { reviewOpnameAction } from "../actions";

const RESULT: Record<string, string> = { MATCH: "Sesuai", WEIGHT_DIFF: "Selisih berat", MISSING: "Tidak ditemukan", UNEXPECTED: "Tidak terduga", SKIPPED: "Dilewati (berubah)" };
const STATUS: Record<string, string> = { OPEN: "Sedang dihitung", SUBMITTED: "Menunggu persetujuan", APPROVED: "Disetujui", CANCELLED: "Dibatalkan" };

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="mt-1 text-lg font-semibold text-gray-900 dark:text-white">{value}</p>
    </div>
  );
}

export default async function OpnameDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireAppSession();
  const can = (p: (typeof session.permissions)[number]) => session.permissions.includes(p);
  const { opname: o, items } = await loadPage(() => stockOpnameService.get(id));
  const counted = items.filter((i) => i.found).length;
  const expected = items.filter((i) => i.in_snapshot).length;
  const closed = o.status === "APPROVED" || o.status === "CANCELLED";

  return (
    <>
      <PageHeader
        title={o.opname_number}
        description={`${o.store?.name ?? ""}${o.location ? ` · ${o.location.code}` : ""} · ${STATUS[o.status]} · mulai ${formatDateTime(o.started_at)}`}
        back={{ href: "/inventory/stock-opname", label: "Stock Opname" }}
      />
      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Stat label="Sistem" value={`${o.system_count} item · ${formatGram(o.system_weight)}`} />
        <Stat label="Terhitung" value={`${counted} / ${expected}`} />
        <Stat label="Fisik" value={o.status === "OPEN" ? "-" : `${o.physical_count} item · ${formatGram(o.physical_weight)}`} />
        <Stat label="Selisih" value={o.status === "OPEN" ? "-" : `${o.diff_count} item · ${formatGram(o.diff_weight)}`} />
        <Stat label="Nilai estimasi" value={o.status === "OPEN" ? "-" : formatRupiah(o.estimated_value)} />
      </div>
      {o.review_notes && <p className="mb-4 text-sm text-gray-500">Catatan review: {o.review_notes}</p>}

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-4">
          {o.status === "OPEN" && can("stock_opname.manage") && <OpnameCounter opnameId={id} canSubmit />}
          <DataTable<OpnameItem>
            rows={items}
            rowKey={(r) => r.id}
            columns={[
              { header: "Barang", cell: (r) => <span><span className="font-mono">{r.inventory?.barcode}</span> · {r.inventory?.name}</span> },
              { header: "Berat sistem", cell: (r) => formatGram(r.system_gross_weight), className: "text-right whitespace-nowrap" },
              { header: "Berat fisik", cell: (r) => (r.found ? formatGram(r.physical_gross_weight) : "-"), className: "text-right whitespace-nowrap" },
              {
                header: "Hasil",
                cell: (r) =>
                  r.result ? RESULT[r.result] : r.found ? (r.in_snapshot ? "Terhitung" : "Tidak terduga") : <span className="text-gray-400">Belum</span>,
              },
              {
                header: "",
                cell: (r) => (o.status === "OPEN" && r.found && can("stock_opname.manage") ? <UnscanButton opnameId={id} inventoryId={r.inventory_id} /> : null),
              },
            ]}
          />
        </div>
        <div>
          {!closed && (can("stock_opname.approve") || can("stock_opname.manage")) && (o.status === "SUBMITTED" || can("stock_opname.manage")) && (
            <OpnameReviewForm
              action={reviewOpnameAction.bind(null, id)}
              canApprove={o.status === "SUBMITTED" && can("stock_opname.approve")}
              canCancel={can("stock_opname.manage")}
            />
          )}
        </div>
      </div>
    </>
  );
}
