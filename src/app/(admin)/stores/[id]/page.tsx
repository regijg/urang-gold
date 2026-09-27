import PageHeader from "@/components/gold/PageHeader";
import StoreForm from "@/components/gold/inventory/StoreForm";
import { loadPage, requirePagePermission } from "@/server/page-guard";
import { storeService } from "@/server/services/inventory.service";
import { saveStoreAction } from "../actions";

// Outlets are deactivated, not deleted (stock and transactions reference them).
export default async function EditStorePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requirePagePermission("stores.manage");
  const store = await loadPage(() => storeService.get(id));
  return (
    <>
      <PageHeader title={`Ubah Outlet: ${store.name}`} back={{ href: "/stores", label: "Outlet" }} />
      <StoreForm action={saveStoreAction.bind(null, id)} initial={store} />
    </>
  );
}
