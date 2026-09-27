import PageHeader from "@/components/gold/PageHeader";
import ProductForm from "@/components/gold/master/ProductForm";
import { loadPage, requirePagePermission } from "@/server/page-guard";
import { loadProductFormOptions } from "@/server/services/product-options";
import { saveProductAction } from "../actions";

export default async function NewProductPage() {
  await requirePagePermission("master_data.manage");
  const { categories, purities } = await loadPage(() => loadProductFormOptions());

  return (
    <>
      <PageHeader title="Tambah Produk" back={{ href: "/products", label: "Produk" }} />
      <ProductForm action={saveProductAction.bind(null, null)} categories={categories} purities={purities} />
    </>
  );
}
