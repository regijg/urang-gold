import React from "react";
import { formatDateTime, formatGram, formatRupiah } from "@/lib/format";
import { PAYMENT_LABELS } from "@/lib/payments";
import type { Receipt } from "@/server/repositories/sales.repository";

export type ReceiptFormat = "a4" | "80" | "58";

/**
 * E-nota layout. Thermal formats use a fixed paper width and monospace text;
 * A4 uses a table. Print CSS hides everything else on the page.
 */
export default function ReceiptView({ receipt, format }: { receipt: Receipt; format: ReceiptFormat }) {
  const thermal = format !== "a4";
  const isBuyback = receipt.kind === "BUYBACK";
  const width = format === "58" ? "58mm" : format === "80" ? "80mm" : "100%";

  const header = (
    <div className={thermal ? "text-center" : "flex items-start justify-between"}>
      <div>
        <p className={thermal ? "text-sm font-bold" : "text-xl font-bold"}>{receipt.store.name}</p>
        {receipt.store.address && <p className="text-xs">{receipt.store.address}</p>}
        {receipt.store.phone && <p className="text-xs">Telp {receipt.store.phone}</p>}
      </div>
      <div className={thermal ? "mt-2 text-xs" : "text-right text-sm"}>
        <p className="font-mono font-semibold">{receipt.invoice_number}</p>
        <p>{formatDateTime(receipt.sold_at)}</p>
        {receipt.cashier && <p>Kasir: {receipt.cashier}</p>}
        {receipt.customer && <p>Customer: {receipt.customer}</p>}
      </div>
    </div>
  );

  return (
    <div className="receipt mx-auto bg-white p-3 text-black" style={{ width, maxWidth: "100%" }}>
      {receipt.status === "VOIDED" && <p className="mb-2 border border-black py-1 text-center text-sm font-bold">DIBATALKAN</p>}
      {isBuyback && <p className="mb-2 text-center text-sm font-bold">NOTA PEMBELIAN EMAS (BUYBACK)</p>}
      {header}
      <hr className="my-2 border-dashed border-black" />

      {thermal ? (
        <div className="space-y-2 font-mono text-[11px] leading-tight">
          {receipt.items.map((i) => (
            <div key={i.barcode}>
              <p>{i.name}</p>
              <p className="flex justify-between">
                <span>
                  {i.purity_code} {formatGram(i.gross_weight)}
                </span>
                <span>{formatRupiah(i.subtotal)}</span>
              </p>
              {Number(i.discount) > 0 && (
                <p className="flex justify-between">
                  <span>{isBuyback ? "Potongan" : "Diskon"}</span>
                  <span>-{formatRupiah(i.discount)}</span>
                </p>
              )}
            </div>
          ))}
        </div>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-black text-left">
              <th className="py-1">Barang</th>
              <th>Kadar</th>
              <th className="text-right">Berat</th>
              <th className="text-right">Harga</th>
              <th className="text-right">{isBuyback ? "Potongan" : "Diskon"}</th>
              <th className="text-right">Jumlah</th>
            </tr>
          </thead>
          <tbody>
            {receipt.items.map((i) => (
              <tr key={i.barcode} className="border-b border-gray-300">
                <td className="py-1">
                  {i.name}
                  <span className="block font-mono text-xs">{i.barcode}</span>
                </td>
                <td>{i.purity_code}</td>
                <td className="text-right">{formatGram(i.gross_weight)}</td>
                <td className="text-right">{formatRupiah(i.subtotal)}</td>
                <td className="text-right">{Number(i.discount) > 0 ? `-${formatRupiah(i.discount)}` : "-"}</td>
                <td className="text-right">{formatRupiah(i.price)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <hr className="my-2 border-dashed border-black" />
      <div className={`space-y-0.5 ${thermal ? "font-mono text-[11px]" : "ml-auto w-72 text-sm"}`}>
        <p className="flex justify-between"><span>{isBuyback ? "Bruto" : "Subtotal"}</span><span>{formatRupiah(receipt.subtotal)}</span></p>
        <p className="flex justify-between"><span>{isBuyback ? "Potongan" : "Diskon"}</span><span>-{formatRupiah(receipt.discount_total)}</span></p>
        <p className="flex justify-between font-bold"><span>{isBuyback ? "DIBAYAR KE CUSTOMER" : "TOTAL"}</span><span>{formatRupiah(receipt.total)}</span></p>
        {receipt.payments.map((p, idx) => (
          <p key={idx} className="flex justify-between"><span>{PAYMENT_LABELS[p.method] ?? p.method}</span><span>{formatRupiah(p.amount)}</span></p>
        ))}
        {Number(receipt.change_amount) > 0 && (
          <p className="flex justify-between"><span>Kembalian</span><span>{formatRupiah(receipt.change_amount)}</span></p>
        )}
      </div>
      <p className={`mt-3 text-center ${thermal ? "text-[10px]" : "text-xs"}`}>Terima kasih — {receipt.tenant.name}</p>
    </div>
  );
}
