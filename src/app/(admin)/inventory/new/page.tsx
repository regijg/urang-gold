import PageHeader from "@/components/gold/PageHeader";
import ReceiveForm from "@/components/gold/inventory/ReceiveForm";
import { loadPage, requirePagePermission } from "@/server/page-guard";
import { locationService, storeService } from "@/server/services/inventory.service";
import { productService } from "@/server/services/product.service";
import { receiveStockAction } from "../actions";

export default async function ReceiveStockPage({ searchParams }: { searchParams: Promise<{ product?: string }> }) {
  const { product } = await searchParams;
  await requirePagePermission("inventory.manage");
  const [products, stores, locations] = await loadPage(() =>
    Promise.all([
      productService.list({ status: "active", page: 1, pageSize: 500 }),
      storeService.list({ activeOnly: true }),
      locationService.list({ activeOnly: true }),
    ])
  );

  return (
    <>
      <PageHeader title="Stok Masuk" description="Input stok awal atau barang masuk (non-pembelian supplier)." back={{ href: "/inventory", label: "Inventory" }} />
      <ReceiveForm
        action={receiveStockAction}
        products={products.rows.map((p) => ({ value: p.id, label: `${p.sku} — ${p.name} (${p.purity?.code ?? "-"})` }))}
        stores={stores.map((s) => ({ value: s.id, label: s.name }))}
        locations={locations}
        defaultProductId={product}
      />
    </>
  );
}
