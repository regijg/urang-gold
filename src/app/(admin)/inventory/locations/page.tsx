import type { Metadata } from "next";
import Link from "next/link";
import DataTable from "@/components/gold/DataTable";
import ListToolbar from "@/components/gold/ListToolbar";
import PageHeader from "@/components/gold/PageHeader";
import StatusBadge from "@/components/gold/StatusBadge";
import { LOCATION_TYPE_LABELS } from "@/lib/validation/inventory";
import { requireAppSession } from "@/server/auth/session";
import { loadPage } from "@/server/page-guard";
import { locationService, storeService } from "@/server/services/inventory.service";
import type { LocationRow } from "@/server/repositories/location.repository";

export const metadata: Metadata = { title: "Lokasi & Baki | GoldPOS" };

export default async function LocationsPage({ searchParams }: { searchParams: Promise<{ store?: string }> }) {
  const { store } = await searchParams;
  const session = await requireAppSession();
  const canManage = session.permissions.includes("inventory.manage");
  const [stores, locations] = await loadPage(() => Promise.all([storeService.list(), locationService.list({ storeId: store })]));

  return (
    <>
      <PageHeader
        title="Lokasi & Baki"
        description="Tempat penyimpanan barang di setiap outlet."
        back={{ href: "/inventory", label: "Inventory" }}
        action={canManage ? { href: "/inventory/locations/new", label: "Tambah Lokasi" } : null}
      />
      <ListToolbar
        showSearch={false}
        filters={[{ name: "store", value: store, allLabel: "Semua outlet", options: stores.map((s) => ({ value: s.id, label: s.name })) }]}
      />
      <DataTable<LocationRow>
        rows={locations}
        rowKey={(r) => r.id}
        empty="Belum ada lokasi."
        columns={[
          {
            header: "Kode",
            cell: (r) =>
              canManage ? (
                <Link href={`/inventory/locations/${r.id}`} className="font-mono font-medium text-brand-500 hover:underline">
                  {r.code}
                </Link>
              ) : (
                <span className="font-mono">{r.code}</span>
              ),
          },
          { header: "Nama", cell: (r) => r.name },
          { header: "Tipe", cell: (r) => LOCATION_TYPE_LABELS[r.type] },
          { header: "Induk", cell: (r) => r.parent?.code ?? "-" },
          { header: "Outlet", cell: (r) => r.store?.name ?? "-" },
          {
            header: "Stok",
            cell: (r) => (
              <Link href={`/inventory?location=${r.id}`} className="text-xs text-brand-500 hover:underline">
                Lihat
              </Link>
            ),
          },
          { header: "Status", cell: (r) => <StatusBadge active={r.is_active} /> },
        ]}
      />
    </>
  );
}
