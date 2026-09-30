import type { Metadata } from "next";
import Link from "next/link";
import DataTable from "@/components/gold/DataTable";
import ListToolbar from "@/components/gold/ListToolbar";
import PageHeader from "@/components/gold/PageHeader";
import Pagination from "@/components/gold/Pagination";
import StatusBadge from "@/components/gold/StatusBadge";
import { parsePage } from "@/lib/validation/common";
import { requireAppSession } from "@/server/auth/session";
import { loadPage } from "@/server/page-guard";
import { supplierService } from "@/server/services/master-data.service";
import type { SupplierRow } from "@/server/repositories/master-data.repository";

export const metadata: Metadata = { title: "Supplier | UrangGold" };

export default async function SuppliersPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  const { q, page } = await searchParams;
  const session = await requireAppSession();
  const canManage = session.permissions.includes("master_data.manage");
  const data = await loadPage(() => supplierService.list({ q, page: parsePage(page) }));

  return (
    <>
      <PageHeader
        title="Supplier"
        description="Pemasok barang emas dan perhiasan."
        action={canManage ? { href: "/suppliers/new", label: "Tambah Supplier" } : null}
      />
      <ListToolbar q={q} placeholder="Cari nama, kontak, atau nomor HP" />
      <DataTable<SupplierRow>
        rows={data.rows}
        rowKey={(r) => r.id}
        columns={[
          {
            header: "Nama",
            cell: (r) =>
              canManage ? (
                <Link href={`/suppliers/${r.id}`} className="font-medium text-brand-500 hover:underline">{r.name}</Link>
              ) : (
                r.name
              ),
          },
          { header: "Kontak", cell: (r) => r.contact_person ?? "-" },
          { header: "Nomor HP", cell: (r) => r.phone ?? "-" },
          { header: "Status", cell: (r) => <StatusBadge active={r.is_active} /> },
        ]}
      />
      <Pagination page={data.page} pageSize={data.pageSize} total={data.total} basePath="/suppliers" params={{ q }} />
    </>
  );
}
