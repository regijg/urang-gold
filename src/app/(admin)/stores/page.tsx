import type { Metadata } from "next";
import Link from "next/link";
import DataTable from "@/components/gold/DataTable";
import PageHeader from "@/components/gold/PageHeader";
import StatusBadge from "@/components/gold/StatusBadge";
import { loadPage, requirePagePermission } from "@/server/page-guard";
import { storeService } from "@/server/services/inventory.service";
import type { StoreRow } from "@/server/repositories/store.repository";

export const metadata: Metadata = { title: "Outlet | GoldPOS" };

export default async function StoresPage() {
  await requirePagePermission("stores.manage");
  const stores = await loadPage(() => storeService.list());
  return (
    <>
      <PageHeader title="Outlet" description="Cabang / outlet toko Anda." action={{ href: "/stores/new", label: "Tambah Outlet" }} />
      <DataTable<StoreRow>
        rows={stores}
        rowKey={(r) => r.id}
        columns={[
          { header: "Kode", cell: (r) => <span className="font-mono">{r.code}</span> },
          { header: "Nama", cell: (r) => <Link href={`/stores/${r.id}`} className="font-medium text-brand-500 hover:underline">{r.name}</Link> },
          { header: "Alamat", cell: (r) => r.address ?? "-" },
          {
            header: "Katalog",
            cell: (r) =>
              r.catalog_enabled ? (
                <Link href={`/store/${r.slug}`} className="text-xs text-brand-500 hover:underline" target="_blank">
                  /store/{r.slug}
                </Link>
              ) : (
                <span className="text-xs text-gray-400">Nonaktif</span>
              ),
          },
          { header: "Status", cell: (r) => <StatusBadge active={r.is_active} /> },
        ]}
      />
    </>
  );
}
