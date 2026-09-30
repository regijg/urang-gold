import type { Metadata } from "next";
import PageHeader from "@/components/gold/PageHeader";
import BuybackForm from "@/components/gold/pos/BuybackForm";
import { loadPage, requirePagePermission } from "@/server/page-guard";
import { goldRateService } from "@/server/services/gold-rate.service";
import { storeService } from "@/server/services/inventory.service";
import { categoryService } from "@/server/services/master-data.service";

export const metadata: Metadata = { title: "Buyback Baru | UrangGold" };

export default async function NewBuybackPage() {
  const session = await requirePagePermission("buybacks.manage");
  const [stores, categories, rates] = await loadPage(() =>
    Promise.all([storeService.list({ activeOnly: true }), categoryService.list({ activeOnly: true, pageSize: 500 }), goldRateService.current()])
  );
  return (
    <>
      <PageHeader title="Buyback" description="Customer menjual emas/perhiasan ke toko." back={{ href: "/buybacks", label: "Buyback" }} />
      <BuybackForm
        stores={stores.map((s) => ({ id: s.id, name: s.name }))}
        categories={categories.rows.map((c) => ({ id: c.id, name: c.name }))}
        purities={rates.map((r) => ({ purity_id: r.purity_id, code: r.code, buy_price: r.buy_price }))}
        canOverridePrice={session.permissions.includes("gold_rates.manage")}
      />
    </>
  );
}
