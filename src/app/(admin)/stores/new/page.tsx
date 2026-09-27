import PageHeader from "@/components/gold/PageHeader";
import StoreForm from "@/components/gold/inventory/StoreForm";
import { requirePagePermission } from "@/server/page-guard";
import { saveStoreAction } from "../actions";

export default async function NewStorePage() {
  await requirePagePermission("stores.manage");
  return (
    <>
      <PageHeader title="Tambah Outlet" back={{ href: "/stores", label: "Outlet" }} />
      <StoreForm action={saveStoreAction.bind(null, null)} />
    </>
  );
}
