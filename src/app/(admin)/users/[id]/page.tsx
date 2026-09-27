import PageHeader from "@/components/gold/PageHeader";
import StaffForm from "@/components/gold/StaffForm";
import { loadPage, requirePagePermission } from "@/server/page-guard";
import { storeService } from "@/server/services/inventory.service";
import { usersService } from "@/server/services/users.service";
import { saveStaffAction } from "../actions";

export default async function EditUserPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requirePagePermission("users.manage");
  const [user, roles, stores] = await loadPage(() => Promise.all([usersService.get(id), usersService.roles(), storeService.list({ activeOnly: true })]));
  return (
    <>
      <PageHeader title={`Ubah Pengguna: ${user.full_name}`} back={{ href: "/users", label: "Pengguna" }} />
      <StaffForm
        action={saveStaffAction.bind(null, id)}
        roles={roles}
        stores={stores.map((s) => ({ id: s.id, name: s.name }))}
        initial={user}
        isSelf={user.id === session.userId}
      />
    </>
  );
}
