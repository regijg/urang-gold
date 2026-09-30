import type { Metadata } from "next";
import Link from "next/link";
import DataTable from "@/components/gold/DataTable";
import ListToolbar from "@/components/gold/ListToolbar";
import PageHeader from "@/components/gold/PageHeader";
import Pagination from "@/components/gold/Pagination";
import { formatDateOnly, formatDateTime, formatRupiah } from "@/lib/format";
import { parsePage } from "@/lib/validation/common";
import { REPAIR_STATUS_LABELS } from "@/lib/validation/operations";
import { loadPage, requirePagePermission } from "@/server/page-guard";
import { repairService, type RepairRow } from "@/server/services/repair.service";
import { REPAIR_BADGE } from "@/components/gold/repairs/badge";

export const metadata: Metadata = { title: "Servis | UrangGold" };

export default async function RepairsPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string; page?: string }> }) {
  const sp = await searchParams;
  await requirePagePermission("repairs.manage");
  const status = sp.status ?? "ACTIVE";
  const data = await loadPage(() => repairService.list({ q: sp.q, status, page: parsePage(sp.page) }));

  return (
    <>
      <PageHeader title="Servis" description="Perhiasan customer yang diperbaiki: patri, cuci, ukir, ganti batu." action={{ href: "/repairs/new", label: "+ Terima Servis" }} />
      <ListToolbar
        q={sp.q}
        placeholder="Cari nomor servis atau barang"
        filters={[
          {
            name: "status",
            value: status,
            allLabel: "Semua status",
            options: [{ value: "ACTIVE", label: "Belum diambil" }, ...Object.entries(REPAIR_STATUS_LABELS).map(([value, label]) => ({ value, label }))],
          },
        ]}
      />
      <DataTable<RepairRow>
        rows={data.rows}
        rowKey={(r) => r.id}
        empty="Tidak ada servis untuk filter ini."
        columns={[
          {
            header: "Servis",
            cell: (r) => (
              <div>
                <Link href={`/repairs/${r.id}`} className="font-mono font-medium text-brand-500 hover:underline">{r.repair_number}</Link>
                <p className="text-xs text-gray-500">{formatDateTime(r.created_at)}</p>
              </div>
            ),
          },
          {
            header: "Barang",
            cell: (r) => (
              <div>
                <p className="text-gray-800 dark:text-white/90">{r.item_description}</p>
                <p className="text-xs text-gray-500">{r.service_type}</p>
              </div>
            ),
          },
          { header: "Customer", cell: (r) => r.customer?.name ?? "-" },
          { header: "Janji", cell: (r) => (r.due_date ? formatDateOnly(r.due_date) : "-"), className: "whitespace-nowrap" },
          { header: "Biaya", cell: (r) => formatRupiah(r.final_cost ?? r.estimated_cost), className: "text-right whitespace-nowrap" },
          { header: "Status", cell: (r) => <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${REPAIR_BADGE[r.status]}`}>{REPAIR_STATUS_LABELS[r.status]}</span> },
        ]}
      />
      <Pagination page={data.page} pageSize={data.pageSize} total={data.total} basePath="/repairs" params={{ q: sp.q, status }} />
    </>
  );
}
