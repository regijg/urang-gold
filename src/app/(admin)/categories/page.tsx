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
import { categoryService } from "@/server/services/master-data.service";
import type { CategoryRow } from "@/server/repositories/master-data.repository";

export const metadata: Metadata = { title: "Kategori | GoldPOS" };

export default async function CategoriesPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  const { q, page } = await searchParams;
  const session = await requireAppSession();
  const canManage = session.permissions.includes("master_data.manage");
  const data = await loadPage(() => categoryService.list({ q, page: parsePage(page) }));

  return (
    <>
      <PageHeader
        title="Kategori"
        description="Kelompok produk, misalnya cincin, kalung, gelang."
        action={canManage ? { href: "/categories/new", label: "Tambah Kategori" } : null}
      />
      <ListToolbar q={q} placeholder="Cari nama atau kode" />
      <DataTable<CategoryRow>
        rows={data.rows}
        rowKey={(r) => r.id}
        columns={[
          { header: "Kode", cell: (r) => <span className="font-mono">{r.code}</span> },
          {
            header: "Nama",
            cell: (r) =>
              canManage ? (
                <Link href={`/categories/${r.id}`} className="font-medium text-brand-500 hover:underline">{r.name}</Link>
              ) : (
                r.name
              ),
          },
          { header: "Urutan", cell: (r) => r.sort_order },
          { header: "Status", cell: (r) => <StatusBadge active={r.is_active} /> },
        ]}
      />
      <Pagination page={data.page} pageSize={data.pageSize} total={data.total} basePath="/categories" params={{ q }} />
    </>
  );
}
