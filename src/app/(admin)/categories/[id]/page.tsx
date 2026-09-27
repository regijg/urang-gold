import DeleteButton from "@/components/gold/DeleteButton";
import PageHeader from "@/components/gold/PageHeader";
import CategoryForm from "@/components/gold/master/CategoryForm";
import { loadPage, requirePagePermission } from "@/server/page-guard";
import { categoryService } from "@/server/services/master-data.service";
import { deleteCategoryAction, saveCategoryAction } from "../actions";

export default async function EditCategoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requirePagePermission("master_data.manage");
  const category = await loadPage(() => categoryService.get(id));

  return (
    <>
      <PageHeader title={`Ubah Kategori: ${category.name}`} back={{ href: "/categories", label: "Kategori" }} />
      <div className="space-y-6">
        <CategoryForm action={saveCategoryAction.bind(null, id)} initial={category} />
        <DeleteButton
          action={deleteCategoryAction.bind(null, id)}
          confirmText={`Hapus kategori "${category.name}"? Kategori yang sudah dipakai produk tidak bisa dihapus.`}
        />
      </div>
    </>
  );
}
