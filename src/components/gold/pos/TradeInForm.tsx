"use client";

import Link from "next/link";
import React, { useMemo, useState, useTransition } from "react";
import { formatRupiah } from "@/lib/format";
import { subRupiah, sumRupiah } from "@/lib/validation/sales";
import { createTradeInAction } from "@/app/(admin)/trade-ins/actions";
import BuybackLines, { buybackTotal, emptyBuybackLine, toBuybackPayload, type BuybackLine, type BuybackPurity } from "./BuybackLines";
import CartPanel, { type CartLine } from "./CartPanel";
import CustomerPicker, { type PickedCustomer } from "./CustomerPicker";
import PaymentEditor, { type PaymentRow } from "./PaymentEditor";
import { waLink } from "@/lib/whatsapp";

type Done = { trade_in_id: string; trade_in_number: string; sale_id: string; buyback_id: string; balance: string; change_amount: string; public_token: string };
// text colour set on the card so every amount inside is readable in light and dark mode
const card = "rounded-2xl border border-gray-200 bg-white p-4 text-gray-800 dark:border-gray-800 dark:bg-gray-900 dark:text-white/90";

export default function TradeInForm({
  stores,
  categories,
  purities,
  canOverridePrice,
}: {
  stores: { id: string; name: string }[];
  categories: { id: string; name: string }[];
  purities: BuybackPurity[];
  canOverridePrice: boolean;
}) {
  const [storeId, setStoreId] = useState(stores[0]?.id ?? "");
  const [customer, setCustomer] = useState<PickedCustomer | null>(null);
  const [lines, setLines] = useState<BuybackLine[]>([emptyBuybackLine(0)]);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [payments, setPayments] = useState<PaymentRow[]>([{ method: "CASH", amount: "", reference: "" }]);
  const [notes, setNotes] = useState("");
  const [message, setMessage] = useState<{ kind: "error" | "info"; text: string } | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [done, setDone] = useState<Done | null>(null);
  const [pending, startTransition] = useTransition();

  // display figures (the database recomputes and verifies the balance)
  const oldValue = buybackTotal(lines, purities);
  const newTotal = useMemo(() => subRupiah(sumRupiah(cart.map((l) => l.price ?? "0")), sumRupiah(cart.map((l) => l.discount || "0"))), [cart]);
  const balance = subRupiah(newTotal, oldValue); // >0 customer pays, <0 store pays
  const customerPays = BigInt(balance) > BigInt(0);
  const absBalance = balance.replace("-", "");
  const paid = sumRupiah(payments.map((p) => p.amount || "0"));
  const settleOk = balance === "0" ? paid === "0" : customerPays ? BigInt(paid) >= BigInt(balance) : paid === absBalance;

  function submit() {
    setMessage(null);
    setFieldErrors({});
    if (!customer) return setMessage({ kind: "error", text: "Customer wajib dipilih." });
    startTransition(async () => {
      const r = await createTradeInAction({
        storeId,
        customerId: customer.id,
        buyItems: toBuybackPayload(lines),
        sellItems: cart.map((l) => ({ inventoryId: l.id, discount: l.discount })),
        payments: balance === "0" ? [] : payments,
        expectedBalance: balance,
        notes,
      });
      if (r.success) setDone(r.data);
      else {
        setMessage({ kind: "error", text: r.message });
        setFieldErrors(r.fieldErrors ?? {});
      }
    });
  }

  if (done) {
    const notaUrl = typeof window !== "undefined" ? `${window.location.origin}/nota/${done.public_token}` : "";
    const b = BigInt(done.balance);
    return (
      <div className={`${card} mx-auto max-w-lg p-8 text-center`}>
        <p className="text-sm text-success-600">Tukar tambah berhasil</p>
        <p className="mt-1 font-mono text-lg font-semibold text-gray-900 dark:text-white">{done.trade_in_number}</p>
        <p className="mt-4 text-3xl font-bold text-gray-900 dark:text-white">{formatRupiah(done.balance.replace("-", ""))}</p>
        <p className="text-sm text-gray-500">{b > BigInt(0) ? "dibayar customer" : b < BigInt(0) ? "dibayar toko ke customer" : "tanpa selisih"}</p>
        {BigInt(done.change_amount) > BigInt(0) && <p className="mt-2">Kembalian {formatRupiah(done.change_amount)}</p>}
        <div className="mt-6 grid grid-cols-2 gap-2 text-sm">
          <Link href={`/sales/${done.sale_id}/print?format=80`} target="_blank" className="rounded-lg border border-gray-300 py-2.5 dark:border-gray-700 dark:text-gray-300">
            Cetak nota jual
          </Link>
          <Link href={`/buybacks/${done.buyback_id}/print?format=80`} target="_blank" className="rounded-lg border border-gray-300 py-2.5 dark:border-gray-700 dark:text-gray-300">
            Cetak nota beli
          </Link>
        </div>
        <a href={waLink(customer?.phone, `Nota tukar tambah ${done.trade_in_number}: ${notaUrl}`)} target="_blank" rel="noreferrer" className="mt-3 block rounded-lg border border-success-300 py-2.5 text-sm text-success-700">
          Kirim nota via WhatsApp
        </a>
        <button type="button" onClick={() => window.location.reload()} className="mt-6 w-full rounded-xl bg-brand-500 py-3 font-semibold text-white">
          Transaksi Baru
        </button>
      </div>
    );
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_1fr_360px]">
      <div className="space-y-4">
        <h2 className="text-base font-semibold text-gray-900 dark:text-white">1. Barang lama (dibeli toko)</h2>
        <BuybackLines lines={lines} setLines={setLines} categories={categories} purities={purities} canOverridePrice={canOverridePrice} fieldErrors={fieldErrors} onError={(m) => setMessage(m ? { kind: "error", text: m } : null)} />
      </div>
      <div className="space-y-4">
        <h2 className="text-base font-semibold text-gray-900 dark:text-white">2. Barang baru (dijual toko)</h2>
        {stores.length > 1 && (
          <select value={storeId} onChange={(e) => { setStoreId(e.target.value); setCart([]); }} className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-3 dark:border-gray-700 dark:text-white">
            {stores.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        )}
        <CartPanel storeId={storeId} cart={cart} setCart={setCart} onMessage={setMessage} />
      </div>
      <div className="space-y-4">
        <div className={card}>
          <p className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">Customer (wajib)</p>
          <CustomerPicker value={customer} onChange={setCustomer} onError={(m) => setMessage({ kind: "error", text: m })} />
        </div>
        <div className={card}>
          <dl className="space-y-1 text-sm">
            <div className="flex justify-between"><dt className="text-gray-500">Nilai barang lama</dt><dd>{formatRupiah(oldValue)}</dd></div>
            <div className="flex justify-between"><dt className="text-gray-500">Harga barang baru</dt><dd>{formatRupiah(newTotal)}</dd></div>
            <div className="flex justify-between pt-2 text-lg font-bold text-gray-900 dark:text-white">
              <dt>{customerPays ? "Customer bayar" : balance === "0" ? "Selisih" : "Toko bayar"}</dt>
              <dd>{formatRupiah(absBalance)}</dd>
            </div>
          </dl>
        </div>
        {balance !== "0" && (
          <div className={card}>
            <p className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">{customerPays ? "Pembayaran dari customer" : "Pembayaran ke customer"}</p>
            <PaymentEditor payments={payments} setPayments={setPayments} target={absBalance} methods={customerPays ? undefined : ["CASH", "BANK_TRANSFER"]} />
          </div>
        )}
        <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Catatan (opsional)" className="h-10 w-full rounded-lg border border-gray-300 bg-transparent px-3 text-sm dark:border-gray-700 dark:text-white" />
        {message && <p className="rounded-lg bg-error-50 px-4 py-2 text-sm text-error-600 dark:bg-error-500/10 dark:text-error-400">{message.text}</p>}
        <button type="button" onClick={submit} disabled={pending || cart.length === 0 || oldValue === "0" || !settleOk} className="h-14 w-full rounded-xl bg-brand-500 text-lg font-semibold text-white disabled:opacity-50">
          {pending ? "Memproses..." : "Simpan Tukar Tambah"}
        </button>
      </div>
    </div>
  );
}
