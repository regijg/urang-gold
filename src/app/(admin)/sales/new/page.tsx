import type { Metadata } from "next";
import PosScreen from "@/components/gold/pos/PosScreen";
import { loadPage, requirePagePermission } from "@/server/page-guard";
import { storeService } from "@/server/services/inventory.service";

export const metadata: Metadata = { title: "Kasir | GoldPOS" };

export default async function PosPage() {
  const session = await requirePagePermission("pos.use");
  const stores = await loadPage(() => storeService.list({ activeOnly: true }));

  if (stores.length === 0) {
    return <p className="text-sm text-gray-500">Anda belum memiliki akses ke outlet aktif. Hubungi owner.</p>;
  }
  return <PosScreen stores={stores.map((s) => ({ id: s.id, name: s.name }))} canCustomers={session.permissions.includes("customers.manage")} />;
}
