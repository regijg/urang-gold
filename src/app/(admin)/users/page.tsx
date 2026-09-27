import type { Metadata } from "next";
import Link from "next/link";
import DataTable from "@/components/gold/DataTable";
import PageHeader from "@/components/gold/PageHeader";
import StatusBadge from "@/components/gold/StatusBadge";
import { loadPage, requirePagePermission } from "@/server/page-guard";
import { storeService } from "@/server/services/inventory.service";
import { usersService, type StaffRow } from "@/server/services/users.service";

export const metadata: Metadata = { title: "Pengguna | GoldPOS" };

export default async function UsersPage() {
  await requirePagePermission("users.manage");
  const [users, stores] = await loadPage(() => Promise.all([usersService.list(), storeService.list()]));
  const storeName = new Map(stores.map((s) => [s.id, s.name]));

  return (
    <>
      <PageHeader title="Pengguna" description="Akun staf, role, dan akses outlet." action={{ href: "/users/new", label: "Tambah Pengguna" }} />
      <DataTable<StaffRow>
        rows={users}
        rowKey={(r) => r.id}
        columns={[
          { header: "Nama", cell: (r) => <Link href={`/users/${r.id}`} className="font-medium text-brand-500 hover:underline">{r.full_name}</Link> },
          { header: "Email", cell: (r) => r.email },
          { header: "Role", cell: (r) => r.role?.name ?? r.role_code },
          {
            header: "Outlet",
            cell: (r) => (r.role_code === "OWNER" || r.role_code === "ADMIN" ? "Semua" : r.stores.map((s) => storeName.get(s.store_id) ?? "-").join(", ") || "-"),
          },
          { header: "Status", cell: (r) => <StatusBadge active={r.is_active} /> },
        ]}
      />
    </>
  );
}
