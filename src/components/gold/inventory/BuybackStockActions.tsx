"use client";

import React, { useActionState, useState } from "react";
import type { ActionResult } from "@/lib/action-result";
import { CurrencyField, FormAlert, SubmitButton, TextField, fieldErrorsOf } from "../form";

type Action = (prev: ActionResult | null, formData: FormData) => Promise<ActionResult>;

/** Row actions on the buyback stock list: put back on display (with price parts) or melt. */
export default function BuybackStockActions({
  resellAction,
  meltAction,
  locations,
}: {
  resellAction: Action;
  meltAction: Action;
  locations: { id: string; code: string; name: string }[];
}) {
  const [mode, setMode] = useState<"none" | "resell" | "melt">("none");
  const [resellState, resell] = useActionState(resellAction, null);
  const [meltState, melt] = useActionState(meltAction, null);
  const errors = fieldErrorsOf(mode === "resell" ? resellState : meltState);

  if (resellState?.success || meltState?.success) {
    return <span className="text-xs text-success-600">{(resellState?.success ? resellState : meltState)?.message}</span>;
  }

  if (mode === "resell") {
    return (
      <form autoComplete="off" action={resell} className="w-72 space-y-2 text-left" noValidate>
        <FormAlert state={resellState} />
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">Taruh di</label>
          <select name="locationId" className="h-9 w-full rounded-lg border border-gray-300 bg-transparent px-2 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white">
            <option value="">Tanpa baki</option>
            {locations.map((l) => (
              <option key={l.id} value={l.id}>
                {l.code} — {l.name}
              </option>
            ))}
          </select>
        </div>
        <CurrencyField name="laborCost" label="Ongkos" error={errors.laborCost} />
        <CurrencyField name="stonePrice" label="Harga batu" error={errors.stonePrice} />
        <CurrencyField name="marginAmount" label="Margin" error={errors.marginAmount} />
        <p className="text-xs text-gray-500">Harga jual = berat emas × harga hari ini + ongkos + batu + margin.</p>
        <div className="flex gap-2">
          <SubmitButton>Pajang</SubmitButton>
          <button type="button" onClick={() => setMode("none")} className="rounded-lg border border-gray-300 px-3 text-sm dark:border-gray-700 dark:text-gray-300">
            Batal
          </button>
        </div>
      </form>
    );
  }

  if (mode === "melt") {
    return (
      <form autoComplete="off" action={melt} className="w-64 space-y-2 text-left" noValidate>
        <FormAlert state={meltState} />
        <input type="hidden" name="toStatus" value="MELTED" />
        <TextField name="notes" label="Keterangan" placeholder="mis. Dikirim ke pengrajin" error={errors.notes} required />
        <div className="flex gap-2">
          <SubmitButton>Tandai Dilebur</SubmitButton>
          <button type="button" onClick={() => setMode("none")} className="rounded-lg border border-gray-300 px-3 text-sm dark:border-gray-700 dark:text-gray-300">
            Batal
          </button>
        </div>
      </form>
    );
  }

  return (
    <div className="flex justify-end gap-2">
      <button type="button" onClick={() => setMode("resell")} className="rounded-lg bg-brand-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-600">
        Jual lagi
      </button>
      <button type="button" onClick={() => setMode("melt")} className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 dark:border-gray-700 dark:text-gray-300">
        Lebur
      </button>
    </div>
  );
}
