import DeleteButton from "@/components/gold/DeleteButton";
import PageHeader from "@/components/gold/PageHeader";
import PurityForm from "@/components/gold/master/PurityForm";
import { loadPage, requirePagePermission } from "@/server/page-guard";
import { purityService } from "@/server/services/master-data.service";
import { deletePurityAction, savePurityAction } from "../actions";

export default async function EditPurityPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requirePagePermission("master_data.manage");
  const purity = await loadPage(() => purityService.get(id));

  return (
    <>
      <PageHeader title={`Ubah Kadar: ${purity.code}`} back={{ href: "/purities", label: "Kadar Emas" }} />
      <div className="space-y-6">
        <PurityForm action={savePurityAction.bind(null, id)} initial={purity} />
        <DeleteButton
          action={deletePurityAction.bind(null, id)}
          confirmText={`Hapus kadar "${purity.code}"? Kadar yang sudah dipakai produk tidak bisa dihapus.`}
        />
      </div>
    </>
  );
}
