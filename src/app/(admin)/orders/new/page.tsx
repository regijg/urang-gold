import type { Metadata } from "next";
import PageHeader from "@/components/gold/PageHeader";
import OrderForm from "@/components/gold/orders/OrderForm";
import { todayWib } from "@/lib/date-range";
import { loadPage, requirePagePermission } from "@/server/page-guard";
import { storeService } from "@/server/services/inventory.service";

export const metadata: Metadata = { title: "Pesanan Baru | UrangGold" };

export default async function NewOrderPage() {
  await requirePagePermission("orders.manage");
  const stores = await loadPage(() => storeService.list({ activeOnly: true }));
  return (
    <>
      <PageHeader title="Pesanan Baru" description="Scan barang yang dipesan, pilih customer, lalu terima DP." back={{ href: "/orders", label: "Pesanan & DP" }} />
      <OrderForm stores={stores.map((s) => ({ id: s.id, name: s.name }))} today={todayWib()} />
    </>
  );
}
