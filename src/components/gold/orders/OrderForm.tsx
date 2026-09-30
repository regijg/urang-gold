"use client";

import { useRouter } from "next/navigation";
import React, { useMemo, useState, useTransition } from "react";
import { formatRupiah } from "@/lib/format";
import { subRupiah, sumRupiah } from "@/lib/validation/sales";
import { repriceAction } from "@/app/(admin)/sales/actions";
import { createOrderAction } from "@/app/(admin)/orders/actions";
import CartPanel, { type CartLine } from "../pos/CartPanel";
import CustomerPicker, { type PickedCustomer } from "../pos/CustomerPicker";
import PaymentEditor, { type PaymentRow } from "../pos/PaymentEditor";

const card = "rounded-2xl border border-gray-200 bg-white p-4 text-gray-800 dark:border-gray-800 dark:bg-gray-900 dark:text-white/90";
const field = "h-10 w-full rounded-lg border border-gray-300 bg-transparent px-3 text-sm text-gray-800 dark:border-gray-700 dark:bg-gray-900 dark:text-white";

/** New order: pieces are reserved at today's price (locked) with an optional down payment. */
export default function OrderForm({ stores, today }: { stores: { id: string; name: string }[]; today: string }) {
  const router = useRouter();
  const [storeId, setStoreId] = useState(stores[0]?.id ?? "");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [customer, setCustomer] = useState<PickedCustomer | null>(null);
  const [payments, setPayments] = useState<PaymentRow[]>([{ method: "CASH", amount: "", reference: "" }]);
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");
  const [message, setMessage] = useState<{ kind: "error" | "info"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const subtotal = useMemo(() => sumRupiah(cart.map((l) => l.price ?? "0")), [cart]);
  const discountTotal = useMemo(() => sumRupiah(cart.map((l) => l.discount || "0")), [cart]);
  const total = subRupiah(subtotal, discountTotal);
  const dp = sumRupiah(payments.map((p) => p.amount || "0"));
  const remaining = subRupiah(total, dp);
  const overpaid = remaining.startsWith("-");

  function save() {
    setMessage(null);
    if (!customer) return setMessage({ kind: "error", text: "Customer wajib dipilih untuk pesanan." });
    startTransition(async () => {
      const r = await createOrderAction({
        storeId,
        customerId: customer.id,
        items: cart.map((l) => ({ inventoryId: l.id, discount: l.discount })),
        payments,
        expectedTotal: total,
        dueDate,
        notes,
      });
      if (r.success) return router.push(`/orders/${r.data.order_id}`);
      if (r.code === "PRICE_CHANGED") {
        const fresh = await repriceAction(storeId, cart.map((l) => l.barcode));
        if (fresh.success) setCart((old) => fresh.data.map((f) => ({ ...f, discount: old.find((o) => o.id === f.id)?.discount ?? "" })));
      }
      setMessage({ kind: "error", text: r.message });
    });
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
      <div className="space-y-4">
        {stores.length > 1 && (
          <select
            value={storeId}
            onChange={(e) => {
              if (cart.length && !window.confirm("Ganti outlet akan mengosongkan daftar barang. Lanjutkan?")) return;
              setStoreId(e.target.value);
              setCart([]);
            }}
            className={`${field} h-11 sm:w-64`}
          >
            {stores.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        )}
        <CartPanel storeId={storeId} cart={cart} setCart={setCart} onMessage={setMessage} title="Barang yang dipesan" />
        {message && (
          <p className={`rounded-lg px-4 py-2 text-sm ${message.kind === "error" ? "bg-error-50 text-error-600 dark:bg-error-500/10 dark:text-error-400" : "bg-blue-light-50 text-blue-light-700"}`}>{message.text}</p>
        )}
      </div>

      <div className="space-y-4 lg:sticky lg:top-24 lg:max-h-[calc(100vh-7rem)] lg:self-start lg:overflow-y-auto">
        <div className={card}>
          <p className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">Customer (wajib)</p>
          <CustomerPicker value={customer} onChange={setCustomer} onError={(m) => setMessage({ kind: "error", text: m })} />
        </div>
        <div className={card}>
          <dl className="space-y-1 text-sm">
            <div className="flex justify-between"><dt className="text-gray-500">Harga barang (dikunci hari ini)</dt><dd className="font-medium">{formatRupiah(subtotal)}</dd></div>
            {discountTotal !== "0" && <div className="flex justify-between"><dt className="text-gray-500">Diskon</dt><dd className="font-medium">-{formatRupiah(discountTotal)}</dd></div>}
            <div className="flex justify-between pt-1 text-lg font-bold text-gray-900 dark:text-white"><dt>Total pesanan</dt><dd>{formatRupiah(total)}</dd></div>
          </dl>
        </div>
        <div className={card}>
          <p className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">Uang muka (DP)</p>
          <PaymentEditor payments={payments} setPayments={setPayments} target={total} />
          <p className={`mt-2 text-sm ${overpaid ? "text-error-600" : "text-gray-600 dark:text-gray-300"}`}>
            {overpaid ? "DP melebihi total pesanan." : `Sisa dibayar saat ambil: ${formatRupiah(remaining)}`}
          </p>
        </div>
        <div className={`${card} space-y-2`}>
          <label className="block text-sm text-gray-600 dark:text-gray-400">
            Rencana diambil
            <input type="date" value={dueDate} min={today} onChange={(e) => setDueDate(e.target.value)} className={`${field} mt-1`} />
          </label>
          <input autoComplete="off" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Catatan (opsional)" className={field} />
        </div>
        <button
          type="button"
          onClick={save}
          disabled={pending || cart.length === 0 || overpaid}
          className="h-12 w-full rounded-xl bg-brand-500 text-lg font-semibold text-white hover:bg-brand-600 disabled:opacity-50"
        >
          {pending ? "Menyimpan..." : "Simpan Pesanan"}
        </button>
      </div>
    </div>
  );
}
