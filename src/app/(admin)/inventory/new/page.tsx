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
      <PageHeader
        title="Tambah Stok"
        description="Catat barang fisik yang masuk ke toko (stok awal, titipan). Barang dari supplier dicatat lewat menu Pembelian."
        back={{ href: "/inventory", label: "Daftar Stok" }}
      />
      <ReceiveForm
        action={receiveStockAction}
        products={products.rows.map((p) => ({
          id: p.id,
          sku: p.sku,
          name: p.name,
          category: p.category?.name ?? "-",
          purity: p.purity?.code ?? "-",
          gross_weight: String(p.gross_weight),
          stone_weight: String(p.stone_weight),
          cost_price: String(p.cost_price),
          labor_cost: String(p.labor_cost),
          stone_price: String(p.stone_price),
          margin_amount: String(p.margin_amount),
        }))}
        stores={stores.map((s) => ({ value: s.id, label: s.name }))}
        locations={locations}
        defaultProductId={product}
      />
    </>
  );
}
