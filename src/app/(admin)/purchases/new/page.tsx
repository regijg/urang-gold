import type { Metadata } from "next";
import PageHeader from "@/components/gold/PageHeader";
import PurchaseForm from "@/components/gold/PurchaseForm";
import { todayJakarta } from "@/lib/validation/purchase";
import { loadPage, requirePagePermission } from "@/server/page-guard";
import { locationService, storeService } from "@/server/services/inventory.service";
import { supplierService } from "@/server/services/master-data.service";
import { productService } from "@/server/services/product.service";

export const metadata: Metadata = { title: "Pembelian Baru | UrangGold" };

export default async function NewPurchasePage() {
  await requirePagePermission("purchases.manage");
  const [suppliers, products, stores, locations] = await loadPage(() =>
    Promise.all([
      supplierService.list({ activeOnly: true, pageSize: 500 }),
      productService.list({ status: "active", page: 1, pageSize: 500 }),
      storeService.list({ activeOnly: true }),
      locationService.list({ activeOnly: true }),
    ])
  );
  return (
    <>
      <PageHeader title="Pembelian dari Supplier" description="Barang yang diterima langsung masuk inventory." back={{ href: "/purchases", label: "Pembelian" }} />
      <PurchaseForm
        suppliers={suppliers.rows.map((s) => ({ value: s.id, label: s.name }))}
        products={products.rows.map((p) => ({
          value: p.id,
          label: `${p.sku} — ${p.name} (${p.purity?.code ?? "-"})`,
          grossWeight: p.gross_weight,
          stoneWeight: p.stone_weight,
          costPrice: p.cost_price,
          laborCost: p.labor_cost,
        }))}
        stores={stores.map((s) => ({ value: s.id, label: s.name }))}
        locations={locations}
        today={todayJakarta()}
      />
    </>
  );
}
