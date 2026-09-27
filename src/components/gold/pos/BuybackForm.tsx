"use client";

import Link from "next/link";
import React, { useState, useTransition } from "react";
import { formatRupiah } from "@/lib/format";
import { subRupiah, sumRupiah } from "@/lib/validation/sales";
import { createBuybackAction } from "@/app/(admin)/buybacks/actions";
import BuybackLines, { buybackTotal, emptyBuybackLine, toBuybackPayload, type BuybackLine, type BuybackPurity } from "./BuybackLines";
import CustomerPicker, { type PickedCustomer } from "./CustomerPicker";
import PaymentEditor, { type PaymentRow } from "./PaymentEditor";

type Done = { buyback_id: string; buyback_number: string; total: string; public_token: string };
// text colour set on the card so every amount inside is readable in light and dark mode
const card = "rounded-2xl border border-gray-200 bg-white p-4 text-gray-800 dark:border-gray-800 dark:bg-gray-900 dark:text-white/90";

export default function BuybackForm({
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
  const [payments, setPayments] = useState<PaymentRow[]>([{ method: "CASH", amount: "", reference: "" }]);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [done, setDone] = useState<Done | null>(null);
  const [pending, startTransition] = useTransition();

  const total = buybackTotal(lines, purities);
  const diff = subRupiah(total, sumRupiah(payments.map((p) => p.amount || "0")));

  function submit() {
    setError(null);
    setFieldErrors({});
    if (!customer) return setError("Customer wajib dipilih untuk buyback.");
    startTransition(async () => {
      const r = await createBuybackAction({ storeId, customerId: customer.id, items: toBuybackPayload(lines), payments, expectedTotal: total, notes });
      if (r.success) setDone(r.data);
      else {
        setError(r.message);
        setFieldErrors(r.fieldErrors ?? {});
      }
    });
  }

  if (done) {
    return (
      <div className={`${card} mx-auto max-w-lg p-8 text-center`}>
        <p className="text-sm text-success-600">Buyback berhasil</p>
        <p className="mt-1 font-mono text-lg font-semibold text-gray-900 dark:text-white">{done.buyback_number}</p>
        <p className="mt-4 text-3xl font-bold text-gray-900 dark:text-white">{formatRupiah(done.total)}</p>
        <p className="text-sm text-gray-500">dibayarkan ke customer</p>
        <div className="mt-6 grid grid-cols-3 gap-2">
          {(["58", "80", "a4"] as const).map((f) => (
            <Link key={f} href={`/buybacks/${done.buyback_id}/print?format=${f}`} target="_blank" className="rounded-lg border border-gray-300 py-2.5 text-sm dark:border-gray-700 dark:text-gray-300">
              Cetak {f === "a4" ? "A4" : `${f}mm`}
            </Link>
          ))}
        </div>
        <div className="mt-6 flex gap-2">
          <Link href={`/buybacks/${done.buyback_id}`} className="flex-1 rounded-xl border border-gray-300 py-3 text-sm dark:border-gray-700 dark:text-gray-300">
            Lihat detail
          </Link>
          <button type="button" onClick={() => window.location.reload()} className="flex-1 rounded-xl bg-brand-500 py-3 text-sm font-semibold text-white">
            Buyback Baru
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
      <div className="space-y-4">
        {stores.length > 1 && (
          <select value={storeId} onChange={(e) => setStoreId(e.target.value)} className="h-11 rounded-lg border border-gray-300 bg-transparent px-3 dark:border-gray-700 dark:text-white">
            {stores.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        )}
        <BuybackLines lines={lines} setLines={setLines} categories={categories} purities={purities} canOverridePrice={canOverridePrice} fieldErrors={fieldErrors} onError={setError} />
      </div>
      <div className="space-y-4">
        <div className={card}>
          <p className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">Customer (wajib)</p>
          <CustomerPicker value={customer} onChange={setCustomer} onError={setError} />
        </div>
        <div className={card}>
          <p className="text-sm text-gray-500">Total dibayar ke customer</p>
          <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">{formatRupiah(total)}</p>
        </div>
        <div className={card}>
          <p className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">Pembayaran ke customer</p>
          <PaymentEditor payments={payments} setPayments={setPayments} target={total} methods={["CASH", "BANK_TRANSFER"]} />
          {diff !== "0" && <p className="mt-2 text-xs text-warning-600">Selisih {formatRupiah(diff.replace("-", ""))} — pembayaran harus sama dengan total.</p>}
          <input autoComplete="off" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Catatan (opsional)" className="mt-3 h-10 w-full rounded-lg border border-gray-300 bg-transparent px-3 text-sm dark:border-gray-700 dark:text-white" />
        </div>
        {error && <p className="rounded-lg bg-error-50 px-4 py-2 text-sm text-error-600 dark:bg-error-500/10 dark:text-error-400">{error}</p>}
        <button type="button" onClick={submit} disabled={pending || total === "0" || diff !== "0"} className="h-12 w-full rounded-xl bg-brand-500 text-lg font-semibold text-white hover:bg-brand-600 disabled:opacity-50">
          {pending ? "Memproses..." : `Simpan Buyback ${formatRupiah(total)}`}
        </button>
      </div>
    </div>
  );
}
