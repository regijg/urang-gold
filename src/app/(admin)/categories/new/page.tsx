import PageHeader from "@/components/gold/PageHeader";
import CategoryForm from "@/components/gold/master/CategoryForm";
import { requirePagePermission } from "@/server/page-guard";
import { saveCategoryAction } from "../actions";

export default async function NewCategoryPage() {
  await requirePagePermission("master_data.manage");
  return (
    <>
      <PageHeader title="Tambah Kategori" back={{ href: "/categories", label: "Kategori" }} />
      <CategoryForm action={saveCategoryAction.bind(null, null)} />
    </>
  );
}
