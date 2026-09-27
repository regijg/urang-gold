import type { Metadata } from "next";
import { notFound } from "next/navigation";
import PrintButton from "@/components/gold/pos/PrintButton";
import ReceiptView from "@/components/gold/pos/ReceiptView";
import { formatRupiah } from "@/lib/format";
import { dbRupiah } from "@/lib/validation/common";
import { buybackService } from "@/server/services/buyback.service";
import { salesService } from "@/server/services/sales.service";
import { tradeInService } from "@/server/services/trade-in.service";

export const metadata: Metadata = { title: "E-Nota", robots: { index: false, follow: false } };

// Public e-nota: accessible by anyone holding the random token (sent to the customer).
export default async function PublicReceiptPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const sale = await salesService.receipt(token).catch(() => null);
  const buyback = sale ? null : await buybackService.receipt(token).catch(() => null);
  const tradeIn = sale || buyback ? null : await tradeInService.receipt(token).catch(() => null);
  if (!sale && !buyback && !tradeIn) notFound();

  const balance = tradeIn ? BigInt(dbRupiah(tradeIn.balance)) : BigInt(0);

  return (
    <main className="min-h-screen bg-gray-100 px-4 py-8">
      <div className="mx-auto max-w-2xl space-y-4">
        {sale && <ReceiptView receipt={sale} format="a4" />}
        {buyback && <ReceiptView receipt={buyback} format="a4" />}
        {tradeIn && (
          <>
            <div className="rounded bg-white p-4 text-center text-black">
              <p className="font-bold">TUKAR TAMBAH {tradeIn.trade_in_number}</p>
              <p className="text-sm">
                Barang lama {formatRupiah(tradeIn.trade_in_value)} · Barang baru {formatRupiah(tradeIn.sale_total)}
              </p>
              <p className="mt-1 font-semibold">
                {balance > BigInt(0) ? "Dibayar customer" : balance < BigInt(0) ? "Dibayar toko" : "Tanpa selisih"} {formatRupiah(dbRupiah(tradeIn.balance).replace("-", ""))}
              </p>
            </div>
            <ReceiptView receipt={tradeIn.sale} format="a4" />
            <ReceiptView receipt={tradeIn.buyback} format="a4" />
          </>
        )}
        <div className="text-center">
          <PrintButton />
        </div>
      </div>
    </main>
  );
}
