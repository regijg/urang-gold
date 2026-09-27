import type { Metadata } from "next";
import PageHeader from "@/components/gold/PageHeader";
import TradeInForm from "@/components/gold/pos/TradeInForm";
import { loadPage, requirePagePermission } from "@/server/page-guard";
import { goldRateService } from "@/server/services/gold-rate.service";
import { storeService } from "@/server/services/inventory.service";
import { categoryService } from "@/server/services/master-data.service";

export const metadata: Metadata = { title: "Tukar Tambah | GoldPOS" };

export default async function NewTradeInPage() {
  const session = await requirePagePermission("trade_ins.manage");
  const [stores, categories, rates] = await loadPage(() =>
    Promise.all([storeService.list({ activeOnly: true }), categoryService.list({ activeOnly: true, pageSize: 500 }), goldRateService.current()])
  );
  return (
    <>
      <PageHeader title="Tukar Tambah" description="Customer menukar emas lama dengan barang baru." back={{ href: "/trade-ins", label: "Tukar Tambah" }} />
      <TradeInForm
        stores={stores.map((s) => ({ id: s.id, name: s.name }))}
        categories={categories.rows.map((c) => ({ id: c.id, name: c.name }))}
        purities={rates.map((r) => ({ purity_id: r.purity_id, code: r.code, buy_price: r.buy_price }))}
        canOverridePrice={session.permissions.includes("gold_rates.manage")}
      />
    </>
  );
}
