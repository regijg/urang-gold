import type { Metadata } from "next";
import Link from "next/link";
import DataTable from "@/components/gold/DataTable";
import PageHeader from "@/components/gold/PageHeader";
import { StartOpnameForm } from "@/components/gold/inventory/OpnameScreen";
import { formatDateTime, formatGram, formatRupiah } from "@/lib/format";
import { requireAppSession } from "@/server/auth/session";
import { loadPage } from "@/server/page-guard";
import { locationService, storeService } from "@/server/services/inventory.service";
import { stockOpnameService, type OpnameRow } from "@/server/services/stock-opname.service";
import { startOpnameAction } from "./actions";

export const metadata: Metadata = { title: "Stock Opname | GoldPOS" };

const OPNAME_STATUS: Record<string, string> = { OPEN: "Sedang dihitung", SUBMITTED: "Menunggu persetujuan", APPROVED: "Disetujui", CANCELLED: "Dibatalkan" };

export default async function StockOpnamePage() {
  const session = await requireAppSession();
  const canManage = session.permissions.includes("stock_opname.manage");
  const opnames = await loadPage(() => stockOpnameService.list());
  const [stores, locations] = canManage
    ? await loadPage(() => Promise.all([storeService.list({ activeOnly: true }), locationService.list({ activeOnly: true })]))
    : [[], []];

  return (
    <>
      <PageHeader title="Stock Opname" description="Hitung fisik stok berdasarkan barcode dan berat." back={{ href: "/inventory", label: "Inventory" }} />
      {canManage && <StartOpnameForm action={startOpnameAction} stores={stores.map((s) => ({ value: s.id, label: s.name }))} locations={locations} />}
      <DataTable<OpnameRow>
        rows={opnames}
        rowKey={(r) => r.id}
        empty="Belum ada stock opname."
        columns={[
          { header: "Nomor", cell: (r) => <Link href={`/inventory/stock-opname/${r.id}`} className="font-mono font-medium text-brand-500 hover:underline">{r.opname_number}</Link> },
          { header: "Mulai", cell: (r) => formatDateTime(r.started_at) },
          { header: "Outlet", cell: (r) => `${r.store?.name ?? "-"}${r.location ? ` · ${r.location.code}` : ""}` },
          { header: "Selisih item", cell: (r) => (r.status === "OPEN" ? "-" : r.diff_count), className: "text-right" },
          { header: "Selisih berat", cell: (r) => (r.status === "OPEN" ? "-" : formatGram(r.diff_weight)), className: "text-right whitespace-nowrap" },
          { header: "Nilai estimasi", cell: (r) => (r.status === "OPEN" ? "-" : formatRupiah(r.estimated_value)), className: "text-right whitespace-nowrap" },
          { header: "Status", cell: (r) => OPNAME_STATUS[r.status] },
        ]}
      />
    </>
  );
}
