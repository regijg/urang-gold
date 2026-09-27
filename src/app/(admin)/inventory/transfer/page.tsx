import type { Metadata } from "next";
import PageHeader from "@/components/gold/PageHeader";
import { BulkTransferForm } from "@/components/gold/inventory/PieceActions";
import { loadPage, requirePagePermission } from "@/server/page-guard";
import { locationService, storeService } from "@/server/services/inventory.service";
import { transferBulkAction } from "../actions";

export const metadata: Metadata = { title: "Transfer Stok | GoldPOS" };

export default async function TransferPage() {
  await requirePagePermission("stock_transfer.manage");
  const [stores, locations] = await loadPage(() => Promise.all([storeService.list({ activeOnly: true }), locationService.list({ activeOnly: true })]));
  return (
    <>
      <PageHeader title="Transfer Stok" description="Pindahkan banyak barang sekaligus dengan scan barcode." back={{ href: "/inventory", label: "Inventory" }} />
      <BulkTransferForm action={transferBulkAction} stores={stores.map((s) => ({ value: s.id, label: s.name }))} locations={locations} />
    </>
  );
}
