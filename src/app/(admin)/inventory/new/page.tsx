import PageHeader from "@/components/gold/PageHeader";
import ReceiveForm from "@/components/gold/inventory/ReceiveForm";
import { loadPage, requirePagePermission } from "@/server/page-guard";
import { locationService, storeService } from "@/server/services/inventory.service";
import { productService } from "@/server/services/product.service";
import { receiveStockAction, searchReceiveProductsAction } from "../actions";
import { toReceiveProduct } from "@/lib/product-pick";
import { isUuid } from "@/lib/validation/common";

export default async function ReceiveStockPage({ searchParams }: { searchParams: Promise<{ product?: string }> }) {
  const { product } = await searchParams;
  await requirePagePermission("inventory.manage");
  const [initial, picked, stores, locations] = await loadPage(() =>
    Promise.all([
      productService.search("", 8),
      isUuid(product) ? productService.get(product!).catch(() => null) : Promise.resolve(null),
      storeService.list({ activeOnly: true }),
      locationService.list({ activeOnly: true }),
    ])
  );

  return (
    <>
      <PageHeader
        title="Tambah Stok"
        description="Catat barang fisik yang masuk ke toko (stok awal, titipan). Barang dari supplier dicatat lewat menu Pembelian."
        back={{ href: "/inventory", label: "Daftar Stok" }}
      />
      <ReceiveForm
        action={receiveStockAction}
        searchAction={searchReceiveProductsAction}
        initialProducts={initial.map(toReceiveProduct)}
        defaultProduct={picked ? toReceiveProduct(picked) : null}
        stores={stores.map((s) => ({ value: s.id, label: s.name }))}
        locations={locations}
      />
    </>
  );
}
