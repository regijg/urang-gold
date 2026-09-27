import { notFound } from "next/navigation";
import PrintButton from "@/components/gold/pos/PrintButton";
import ReceiptView, { type ReceiptFormat } from "@/components/gold/pos/ReceiptView";
import { loadPage } from "@/server/page-guard";
import { buybackService } from "@/server/services/buyback.service";

export default async function PrintBuybackPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ format?: string }> }) {
  const { id } = await params;
  const { format } = await searchParams;
  const fmt: ReceiptFormat = format === "a4" || format === "58" ? format : "80";
  const bb = await loadPage(() => buybackService.get(id));
  const receipt = await loadPage(() => buybackService.receipt(bb.public_token));
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
