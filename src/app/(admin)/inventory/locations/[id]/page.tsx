import DeleteButton from "@/components/gold/DeleteButton";
import PageHeader from "@/components/gold/PageHeader";
import LocationForm from "@/components/gold/inventory/LocationForm";
import { loadPage, requirePagePermission } from "@/server/page-guard";
import { locationService, storeService } from "@/server/services/inventory.service";
import { deleteLocationAction, saveLocationAction } from "../../actions";

export default async function EditLocationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requirePagePermission("inventory.manage");
  const [location, stores, locations] = await loadPage(() =>
    Promise.all([locationService.get(id), storeService.list({ activeOnly: true }), locationService.list()])
  );
  return (
    <>
      <PageHeader title={`Ubah Lokasi: ${location.code}`} back={{ href: "/inventory/locations", label: "Lokasi & Baki" }} />
      <div className="space-y-6">
        <LocationForm
          action={saveLocationAction.bind(null, id)}
          stores={stores.map((s) => ({ value: s.id, label: s.name }))}
          locations={locations}
          initial={location}
        />
        <DeleteButton
          action={deleteLocationAction.bind(null, id)}
          confirmText={`Hapus lokasi "${location.code}"? Lokasi yang masih berisi barang tidak bisa dihapus.`}
        />
      </div>
    </>
  );
}
