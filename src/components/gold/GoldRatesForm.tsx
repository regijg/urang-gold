"use client";

import React, { useActionState, useState } from "react";
import type { ActionResult } from "@/lib/action-result";
import { suggestPurityPrice } from "@/lib/gold-rate";
import { formatPercent, formatRupiah } from "@/lib/format";
import type { CurrentRateRow } from "@/server/repositories/gold-rate.repository";
import { FormAlert, SubmitButton, fieldErrorsOf } from "./form";

type Props = {
  rows: CurrentRateRow[];
  action: (prev: ActionResult<{ count: number }> | null, formData: FormData) => Promise<ActionResult<{ count: number }>>;
};

const input =
  "h-10 w-full rounded-lg border border-gray-300 bg-transparent px-3 text-right text-sm text-gray-800 focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90";

export default function GoldRatesForm({ rows, action }: Props) {
  const [state, formAction] = useActionState(action, null);
  const errors = fieldErrorsOf(state);
  const [values, setValues] = useState<Record<string, string>>({});
  const [baseBuy, setBaseBuy] = useState("");
  const [baseSell, setBaseSell] = useState("");

  const set = (key: string, value: string) => setValues((v) => ({ ...v, [key]: value }));

  // Convenience only: fills the inputs from the 24K base × purity %, the owner reviews before saving.
  function fillFromBase() {
    const next: Record<string, string> = { ...values };
    for (const r of rows) {
      if (baseBuy) next[`buy_${r.purity_id}`] = suggestPurityPrice(baseBuy, r.percentage) ?? "";
      if (baseSell) next[`sell_${r.purity_id}`] = suggestPurityPrice(baseSell, r.percentage) ?? "";
    }
    setValues(next);
  }

  return (
    <form action={formAction} className="space-y-5">
      <FormAlert state={state} />
      {state?.success && (
        <div className="rounded-lg border border-success-200 bg-success-50 px-4 py-3 text-sm text-success-700 dark:border-success-500/30 dark:bg-success-500/10 dark:text-success-400">
          {state.message}
        </div>
      )}

      <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
        <p className="mb-3 text-sm font-medium text-gray-700 dark:text-gray-300">Isi otomatis dari harga dasar (100%)</p>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="flex-1 text-xs text-gray-500">
            Harga beli / gram
            <input className={input} inputMode="numeric" value={baseBuy} onChange={(e) => setBaseBuy(e.target.value)} placeholder="2.200.000" />
          </label>
          <label className="flex-1 text-xs text-gray-500">
            Harga jual / gram
            <input className={input} inputMode="numeric" value={baseSell} onChange={(e) => setBaseSell(e.target.value)} placeholder="2.350.000" />
          </label>
          <button type="button" onClick={fillFromBase} className="h-10 rounded-lg border border-gray-300 px-4 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-white/5">
            Hitung × persentase kadar
          </button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
        <table className="min-w-full text-sm">
          <thead className="border-b border-gray-100 bg-gray-50 dark:border-gray-800 dark:bg-white/[0.02]">
            <tr className="text-left text-gray-500 dark:text-gray-400">
              <th className="px-4 py-3 font-medium">Kadar</th>
              <th className="px-4 py-3 font-medium">Harga saat ini (beli / jual)</th>
              <th className="px-4 py-3 font-medium">Beli baru / gram</th>
              <th className="px-4 py-3 font-medium">Jual baru / gram</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {rows.map((r) => {
              const buyKey = `buy_${r.purity_id}`;
              const sellKey = `sell_${r.purity_id}`;
              return (
                <tr key={r.purity_id}>
                  <td className="px-4 py-3">
                    <span className="font-medium text-gray-900 dark:text-white">{r.code}</span>
                    <span className="ml-2 text-xs text-gray-500">{formatPercent(r.percentage)}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-300">
                    {r.sell_price ? `${formatRupiah(r.buy_price)} / ${formatRupiah(r.sell_price)}` : <span className="text-gray-400">Belum diatur</span>}
                  </td>
                  <td className="px-4 py-3">
                    <input name={buyKey} className={input} inputMode="numeric" value={values[buyKey] ?? ""} onChange={(e) => set(buyKey, e.target.value)} aria-invalid={!!errors[buyKey]} />
                    {errors[buyKey] && <p className="mt-1 text-xs text-error-500">{errors[buyKey]}</p>}
                  </td>
                  <td className="px-4 py-3">
                    <input name={sellKey} className={input} inputMode="numeric" value={values[sellKey] ?? ""} onChange={(e) => set(sellKey, e.target.value)} aria-invalid={!!errors[sellKey]} />
                    {errors[sellKey] && <p className="mt-1 text-xs text-error-500">{errors[sellKey]}</p>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400">Kosongkan baris yang tidak ingin diubah. Harga lama tetap tersimpan sebagai riwayat.</p>
      <SubmitButton>Simpan Harga Baru</SubmitButton>
    </form>
  );
}
