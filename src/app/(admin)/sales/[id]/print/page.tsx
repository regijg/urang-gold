import { notFound } from "next/navigation";
import PrintButton from "@/components/gold/pos/PrintButton";
import ReceiptView, { type ReceiptFormat } from "@/components/gold/pos/ReceiptView";
import { loadPage } from "@/server/page-guard";
import { salesService } from "@/server/services/sales.service";

export default async function PrintSalePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ format?: string }> }) {
  const { id } = await params;
  const { format } = await searchParams;
  const fmt: ReceiptFormat = format === "a4" || format === "58" ? format : "80";
  const sale = await loadPage(() => salesService.get(id)); // RLS-checked access first
  const receipt = await loadPage(() => salesService.receipt(sale.public_token));
  if (!receipt) notFound();

  return (
    <div className="space-y-4">
      <div className="print:hidden">
        <PrintButton auto />
      </div>
      <ReceiptView receipt={receipt} format={fmt} />
    </div>
  );
}
