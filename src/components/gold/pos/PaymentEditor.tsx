"use client";

import React from "react";
import { PAYMENT_LABELS, PAYMENT_METHODS } from "@/lib/payments";
import { subRupiah, sumRupiah } from "@/lib/validation/sales";
import RupiahInput from "@/components/gold/RupiahInput";

export type PaymentRow = { method: string; amount: string; reference: string };

const field = "h-11 rounded-lg border border-gray-300 bg-transparent px-3 text-sm text-gray-800 dark:border-gray-700 dark:bg-gray-900 dark:text-white";

/** Split-payment editor. `target` is the amount to cover ("Uang pas" fills the first row). */
export default function PaymentEditor({
  payments,
  setPayments,
  target,
  methods = PAYMENT_METHODS,
}: {
  payments: PaymentRow[];
  setPayments: React.Dispatch<React.SetStateAction<PaymentRow[]>>;
  target: string;
  methods?: readonly string[];
}) {
  const set = (i: number, patch: Partial<PaymentRow>) => setPayments((p) => p.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));

  return (
    <div>
      <div className="space-y-2">
        {payments.map((p, i) => (
          <div key={i} className="space-y-2 rounded-xl bg-gray-50 p-2 dark:bg-white/[0.03]">
            <div className="flex gap-2">
              <select value={p.method} onChange={(e) => set(i, { method: e.target.value })} className={`${field} flex-1`}>
                {methods.map((m) => (
                  <option key={m} value={m}>
                    {PAYMENT_LABELS[m] ?? m}
                  </option>
                ))}
              </select>
              <div className="w-44">
                <RupiahInput value={p.amount} onValueChange={(v) => set(i, { amount: v })} placeholder="Nominal" aria-label="Nominal pembayaran" className={`${field} w-full text-right`} />
              </div>
            </div>
            {p.method !== "CASH" && (
              <input autoComplete="off" value={p.reference} onChange={(e) => set(i, { reference: e.target.value })} placeholder="No. referensi (opsional)" className={`${field} h-10 w-full`} />
            )}
            {payments.length > 1 && (
              <button type="button" onClick={() => setPayments((ps) => ps.filter((_, idx) => idx !== i))} className="text-xs text-error-500">
                Hapus pembayaran
              </button>
            )}
          </div>
        ))}
      </div>
      <div className="mt-2 flex gap-3 text-sm">
        <button type="button" onClick={() => setPayments((ps) => [...ps, { method: methods[1] ?? methods[0], amount: "", reference: "" }])} className="text-brand-500">
          + Split pembayaran
        </button>
        <button
          type="button"
          onClick={() => setPayments((ps) => ps.map((x, idx) => (idx === 0 ? { ...x, amount: subRupiah(target, sumRupiah(ps.slice(1).map((y) => y.amount || "0"))) } : x)))}
          className="text-brand-500"
        >
          Uang pas
        </button>
      </div>
    </div>
  );
}
