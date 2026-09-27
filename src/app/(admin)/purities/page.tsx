import type { Metadata } from "next";
import Link from "next/link";
import DataTable from "@/components/gold/DataTable";
import ListToolbar from "@/components/gold/ListToolbar";
import PageHeader from "@/components/gold/PageHeader";
import Pagination from "@/components/gold/Pagination";
import StatusBadge from "@/components/gold/StatusBadge";
import { formatPercent } from "@/lib/format";
import { parsePage } from "@/lib/validation/common";
import { requireAppSession } from "@/server/auth/session";
import { loadPage } from "@/server/page-guard";
import { purityService } from "@/server/services/master-data.service";
import type { PurityRow } from "@/server/repositories/master-data.repository";

export const metadata: Metadata = { title: "Kadar Emas | GoldPOS" };

export default async function PuritiesPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  const { q, page } = await searchParams;
  const session = await requireAppSession();
  const canManage = session.permissions.includes("master_data.manage");
  const data = await loadPage(() => purityService.list({ q, page: parsePage(page) }));

  return (
    <>
      <PageHeader
        title="Kadar Emas"
        description="Master kadar dan persentase kemurnian emas milik toko Anda."
        action={canManage ? { href: "/purities/new", label: "Tambah Kadar" } : null}
      />
      <ListToolbar q={q} placeholder="Cari kode atau nama" />
      <DataTable<PurityRow>
        rows={data.rows}
        rowKey={(r) => r.id}
        columns={[
          {
            header: "Kode",
            cell: (r) =>
              canManage ? (
                <Link href={`/purities/${r.id}`} className="font-mono font-medium text-brand-500 hover:underline">{r.code}</Link>
              ) : (
                <span className="font-mono">{r.code}</span>
              ),
          },
          { header: "Nama", cell: (r) => r.name },
          { header: "Kemurnian", cell: (r) => formatPercent(r.percentage), className: "text-right" },
          { header: "Status", cell: (r) => <StatusBadge active={r.is_active} /> },
        ]}
      />
      <Pagination page={data.page} pageSize={data.pageSize} total={data.total} basePath="/purities" params={{ q }} />
    </>
  );
}
