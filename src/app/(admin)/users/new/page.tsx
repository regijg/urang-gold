import PageHeader from "@/components/gold/PageHeader";
import StaffForm from "@/components/gold/StaffForm";
import { loadPage, requirePagePermission } from "@/server/page-guard";
import { storeService } from "@/server/services/inventory.service";
import { usersService } from "@/server/services/users.service";
import { saveStaffAction } from "../actions";

export default async function NewUserPage() {
  await requirePagePermission("users.manage");
  const [roles, stores] = await loadPage(() => Promise.all([usersService.roles(), storeService.list({ activeOnly: true })]));
  return (
    <>
      <PageHeader title="Tambah Pengguna" back={{ href: "/users", label: "Pengguna" }} />
      <StaffForm action={saveStaffAction.bind(null, null)} roles={roles} stores={stores.map((s) => ({ id: s.id, name: s.name }))} />
    </>
  );
}
