import type { Metadata } from "next";
import PageHeader from "@/components/gold/PageHeader";
import BarcodeLabels from "@/components/gold/inventory/BarcodeLabels";
import { formatGram } from "@/lib/format";
import { loadPage } from "@/server/page-guard";
import { inventoryService } from "@/server/services/inventory.service";

export const metadata: Metadata = { title: "Cetak Label | GoldPOS" };

// Prices are intentionally not printed: they follow the daily gold rate.
export default async function LabelsPage({ searchParams }: { searchParams: Promise<{ ids?: string }> }) {
  const { ids } = await searchParams;
  const items = await loadPage(() => inventoryService.getMany((ids ?? "").split(",").filter(Boolean)));

  return (
    <>
      <div className="print:hidden">
        <PageHeader title="Cetak Label Barcode" back={{ href: "/inventory", label: "Inventory" }} />
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-gray-500">Tidak ada barang dipilih.</p>
      ) : (
        <BarcodeLabels
          items={items.map((i) => ({
            id: i.id,
            barcode: i.barcode,
            name: i.name,
            purity: i.purity?.code ?? "",
            weight: formatGram(i.gross_weight),
          }))}
        />
      )}
    </>
  );
}
