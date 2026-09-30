import type { Metadata } from "next";
import Link from "next/link";
import DataTable from "@/components/gold/DataTable";
import ListToolbar from "@/components/gold/ListToolbar";
import PageHeader from "@/components/gold/PageHeader";
import Pagination from "@/components/gold/Pagination";
import StatusBadge from "@/components/gold/StatusBadge";
import { parsePage } from "@/lib/validation/common";
import { loadPage } from "@/server/page-guard";
import { customerService } from "@/server/services/master-data.service";
import type { CustomerRow } from "@/server/repositories/master-data.repository";

export const metadata: Metadata = { title: "Customer | UrangGold" };

// Reading customers already requires customers.manage (enforced in the service + RLS),
// so anyone who can see this page may also add/edit.
export default async function CustomersPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  const { q, page } = await searchParams;
  const data = await loadPage(() => customerService.list({ q, page: parsePage(page) }));

  return (
    <>
      <PageHeader title="Customer" description="Data pelanggan toko." action={{ href: "/customers/new", label: "Tambah Customer" }} />
      <ListToolbar q={q} placeholder="Cari nama, nomor HP, atau email" />
      <DataTable<CustomerRow>
        rows={data.rows}
        rowKey={(r) => r.id}
        columns={[
          {
            header: "Nama",
            cell: (r) => (
              <Link href={`/customers/${r.id}`} className="font-medium text-brand-500 hover:underline">{r.name}</Link>
            ),
          },
          { header: "Nomor HP", cell: (r) => r.phone ?? "-" },
          { header: "Email", cell: (r) => r.email ?? "-" },
          { header: "Status", cell: (r) => <StatusBadge active={r.is_active} /> },
        ]}
      />
      <Pagination page={data.page} pageSize={data.pageSize} total={data.total} basePath="/customers" params={{ q }} />
    </>
  );
}
