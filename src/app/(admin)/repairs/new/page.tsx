import type { Metadata } from "next";
import PageHeader from "@/components/gold/PageHeader";
import { NewRepairForm } from "@/components/gold/repairs/RepairForms";
import { todayWib } from "@/lib/date-range";
import { loadPage, requirePagePermission } from "@/server/page-guard";
import { storeService } from "@/server/services/inventory.service";

export const metadata: Metadata = { title: "Terima Servis | UrangGold" };

export default async function NewRepairPage() {
  await requirePagePermission("repairs.manage");
  const stores = await loadPage(() => storeService.list({ activeOnly: true }));
  return (
    <>
      <PageHeader title="Terima Servis" description="Catat perhiasan customer yang dititipkan untuk diperbaiki." back={{ href: "/repairs", label: "Servis" }} />
      <NewRepairForm stores={stores.map((s) => ({ id: s.id, name: s.name }))} today={todayWib()} />
    </>
  );
}
