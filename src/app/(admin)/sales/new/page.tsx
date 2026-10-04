import type { Metadata } from "next";
import PosScreen from "@/components/gold/pos/PosScreen";
import { loadPage, requirePagePermission } from "@/server/page-guard";
import { cashService } from "@/server/services/cash.service";
import { storeService } from "@/server/services/inventory.service";

export const metadata: Metadata = { title: "Kasir | UrangGold" };

export default async function PosPage() {
  const session = await requirePagePermission("pos.use");
  const stores = await loadPage(() => storeService.list({ activeOnly: true }));

  if (stores.length === 0) {
    return <p className="text-sm text-gray-500">Anda belum memiliki akses ke outlet aktif. Hubungi owner.</p>;
  }
  const cashSessions = await loadPage(() => cashService.openForStores(stores.map((s) => s.id)));
  return (
    <PosScreen
      stores={stores.map((s) => ({ id: s.id, name: s.name }))}
      canCustomers={session.permissions.includes("customers.manage")}
      cashSessions={cashSessions}
      canManageCash={session.permissions.includes("cash.manage")}
    />
  );
}
