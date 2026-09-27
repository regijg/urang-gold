import PageHeader from "@/components/gold/PageHeader";
import LocationForm from "@/components/gold/inventory/LocationForm";
import { loadPage, requirePagePermission } from "@/server/page-guard";
import { locationService, storeService } from "@/server/services/inventory.service";
import { saveLocationAction } from "../../actions";

export default async function NewLocationPage() {
  await requirePagePermission("inventory.manage");
  const [stores, locations] = await loadPage(() => Promise.all([storeService.list({ activeOnly: true }), locationService.list()]));
  return (
    <>
      <PageHeader title="Tambah Lokasi" back={{ href: "/inventory/locations", label: "Lokasi & Baki" }} />
      <LocationForm
        action={saveLocationAction.bind(null, null)}
        stores={stores.map((s) => ({ value: s.id, label: s.name }))}
        locations={locations}
      />
    </>
  );
}
