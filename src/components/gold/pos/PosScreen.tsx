"use client";

import Link from "next/link";
import React, { useMemo, useState, useTransition } from "react";
import { formatRupiah } from "@/lib/format";
import { buildReceiptMessage, waLink } from "@/lib/whatsapp";
import { subRupiah, sumRupiah } from "@/lib/validation/sales";
import { checkoutAction, repriceAction } from "@/app/(admin)/sales/actions";
import CartPanel, { type CartLine } from "./CartPanel";
import CustomerPicker, { type PickedCustomer } from "./CustomerPicker";
import PaymentEditor, { type PaymentRow } from "./PaymentEditor";
import CashGate from "../cash/CashGate";
import type { OpenCashInfo } from "@/server/services/cash.service";

type Done = { invoice_number: string; total: string; change_amount: string; sale_id: string; public_token: string };

// text colour set on the card so every amount inside is readable in light and dark mode
const card = "rounded-2xl border border-gray-200 bg-white p-4 text-gray-800 dark:border-gray-800 dark:bg-gray-900 dark:text-white/90";

export default function PosScreen({
  stores,
  canCustomers,
  cashSessions,
  canManageCash,
}: {
  stores: { id: string; name: string }[];
  canCustomers: boolean;
  cashSessions: OpenCashInfo[];
  canManageCash: boolean;
}) {
  const [storeId, setStoreId] = useState(stores[0]?.id ?? "");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [customer, setCustomer] = useState<PickedCustomer | null>(null);
  const [payments, setPayments] = useState<PaymentRow[]>([{ method: "CASH", amount: "", reference: "" }]);
  const [notes, setNotes] = useState("");
  const [message, setMessage] = useState<{ kind: "error" | "info"; text: string } | null>(null);
  const [done, setDone] = useState<Done | null>(null);
  const [pending, startTransition] = useTransition();

  // display totals (the database recomputes and verifies via expected total)
  const subtotal = useMemo(() => sumRupiah(cart.map((l) => l.price ?? "0")), [cart]);
  const discountTotal = useMemo(() => sumRupiah(cart.map((l) => l.discount || "0")), [cart]);
  const total = subRupiah(subtotal, discountTotal);
  const paid = sumRupiah(payments.map((p) => p.amount || "0"));
  const change = subRupiah(paid, total);

  function changeStore(id: string) {
    if (cart.length && !window.confirm("Ganti outlet akan mengosongkan keranjang. Lanjutkan?")) return;
    setStoreId(id);
    setCart([]);
  }

  function reset() {
    setCart([]);
    setCustomer(null);
    setPayments([{ method: "CASH", amount: "", reference: "" }]);
    setNotes("");
    setMessage(null);
    setDone(null);
  }

  function checkout() {
    setMessage(null);
    startTransition(async () => {
      const r = await checkoutAction({
        storeId,
        customerId: customer?.id ?? null,
        items: cart.map((l) => ({ inventoryId: l.id, discount: l.discount })),
        payments,
        expectedTotal: total,
        notes,
      });
      if (r.success) return setDone(r.data);
      if (r.code === "PRICE_CHANGED") {
        const fresh = await repriceAction(storeId, cart.map((l) => l.barcode));
        if (fresh.success) setCart((old) => fresh.data.map((f) => ({ ...f, discount: old.find((o) => o.id === f.id)?.discount ?? "" })));
      }
      setMessage({ kind: "error", text: r.message });
    });
  }

  if (done) {
    const notaUrl = typeof window !== "undefined" ? `${window.location.origin}/nota/${done.public_token}` : "";
    return (
      <div className={`${card} mx-auto max-w-lg p-8 text-center`}>
        <p className="text-sm text-success-600">Transaksi berhasil</p>
        <p className="mt-1 font-mono text-lg font-semibold text-gray-900 dark:text-white">{done.invoice_number}</p>
        <p className="mt-4 text-3xl font-bold text-gray-900 dark:text-white">{formatRupiah(done.total)}</p>
        {BigInt(done.change_amount) > BigInt(0) && <p className="mt-2 text-lg text-gray-700 dark:text-gray-300">Kembalian {formatRupiah(done.change_amount)}</p>}
        <div className="mt-6 grid grid-cols-3 gap-2">
          {(["58", "80", "a4"] as const).map((f) => (
            <Link key={f} href={`/sales/${done.sale_id}/print?format=${f}`} target="_blank" className="rounded-lg border border-gray-300 py-2.5 text-sm dark:border-gray-700 dark:text-gray-300">
              Cetak {f === "a4" ? "A4" : `${f}mm`}
            </Link>
          ))}
        </div>
        <a
          href={waLink(
            customer?.phone,
            buildReceiptMessage({
              storeName: stores.find((st) => st.id === storeId)?.name ?? "",
              invoiceNumber: done.invoice_number,
              customerName: customer?.name,
              items: cart.map((l) => ({
                name: l.name,
                purity: l.purity_code,
                weight: l.gross_weight,
                price: subRupiah(l.price ?? "0", l.discount || "0"),
                discount: l.discount,
              })),
              discountTotal,
              total: done.total,
              payments,
              change: done.change_amount,
              url: notaUrl,
            })
          )}
          target="_blank"
          rel="noreferrer"
          className="mt-3 block rounded-lg border border-success-300 py-2.5 text-sm text-success-700 dark:text-success-400"
        >
          Kirim nota via WhatsApp
        </a>
        <button type="button" onClick={reset} className="mt-6 w-full rounded-xl bg-brand-500 py-3 text-base font-semibold text-white hover:bg-brand-600">
          Transaksi Baru
        </button>
      </div>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
      <CashGate storeId={storeId} stores={stores} onStoreChange={changeStore} sessions={cashSessions} canManage={canManageCash} />
      <div className="space-y-4">
        {stores.length > 1 && (
          <select value={storeId} onChange={(e) => changeStore(e.target.value)} className="h-11 w-full rounded-xl border border-gray-300 bg-transparent px-4 text-gray-800 dark:border-gray-700 dark:bg-gray-900 dark:text-white sm:w-64">
            {stores.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        )}
        <CartPanel storeId={storeId} cart={cart} setCart={setCart} onMessage={setMessage} />
        {message && (
          <p className={`rounded-lg px-4 py-2 text-sm ${message.kind === "error" ? "bg-error-50 text-error-600 dark:bg-error-500/10 dark:text-error-400" : "bg-blue-light-50 text-blue-light-700"}`}>
            {message.text}
          </p>
        )}
      </div>

      <div className="space-y-4 lg:sticky lg:top-24 lg:max-h-[calc(100vh-7rem)] lg:self-start lg:overflow-y-auto">
        {canCustomers && (
          <div className={card}>
            <p className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">Customer</p>
            <CustomerPicker value={customer} onChange={setCustomer} placeholder="Cari nama / nomor HP (opsional)" onError={(m) => setMessage({ kind: "error", text: m })} />
          </div>
        )}
        <div className={card}>
          <dl className="space-y-1 text-sm">
            <div className="flex justify-between"><dt className="text-gray-500">Subtotal</dt><dd>{formatRupiah(subtotal)}</dd></div>
            <div className="flex justify-between"><dt className="text-gray-500">Diskon</dt><dd>-{formatRupiah(discountTotal)}</dd></div>
            <div className="flex justify-between pt-2 text-xl font-bold text-gray-900 dark:text-white"><dt>Total</dt><dd>{formatRupiah(total)}</dd></div>
          </dl>
        </div>
        <div className={card}>
          <p className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">Pembayaran</p>
          <PaymentEditor payments={payments} setPayments={setPayments} target={total} />
          <dl className="mt-3 space-y-1 text-sm">
            <div className="flex justify-between"><dt className="text-gray-500">Dibayar</dt><dd>{formatRupiah(paid)}</dd></div>
            <div className="flex justify-between"><dt className="text-gray-500">{BigInt(change) >= BigInt(0) ? "Kembalian" : "Kurang"}</dt><dd>{formatRupiah(change.replace("-", ""))}</dd></div>
          </dl>
          <input autoComplete="off" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Catatan (opsional)" className="mt-3 h-10 w-full rounded-lg border border-gray-300 bg-transparent px-3 text-sm dark:border-gray-700 dark:text-white" />
        </div>
        <button
          type="button"
          onClick={checkout}
          disabled={pending || cart.length === 0 || BigInt(change) < BigInt(0)}
          className="h-12 w-full rounded-xl bg-brand-500 text-lg font-semibold text-white hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? "Memproses..." : `Bayar ${formatRupiah(total)}`}
        </button>
      </div>
    </div>
  );
}
