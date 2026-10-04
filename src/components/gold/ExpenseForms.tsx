"use client";

import React, { useActionState, useEffect, useState, useTransition } from "react";
import type { ActionResult } from "@/lib/action-result";
import { PAYMENT_LABELS, PAYMENT_METHODS } from "@/lib/payments";
import { EXPENSE_CATEGORIES, EXPENSE_LABELS } from "@/lib/validation/operations";
import { CurrencyField, DateField, FormAlert, SelectField, SubmitButton, TextField, fieldErrorsOf } from "./form";

export function ExpenseForm({
  action,
  stores,
  today,
}: {
  action: (prev: ActionResult | null, formData: FormData) => Promise<ActionResult>;
  stores: { value: string; label: string }[];
  today: string;
}) {
  const [state, formAction] = useActionState(action, null);
  const errors = fieldErrorsOf(state);
  const [key, setKey] = useState(0);
  useEffect(() => {
    if (state?.success) setKey((k) => k + 1);
  }, [state]);

  return (
    <form autoComplete="off" action={formAction} className="space-y-3 rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900" noValidate>
      <p className="font-semibold text-gray-900 dark:text-white">Catat biaya</p>
      <FormAlert state={state} />
      {state?.success && <p className="text-sm text-success-600">{state.message}</p>}
      <div key={key} className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <SelectField name="category" label="Kategori" options={EXPENSE_CATEGORIES.map((c) => ({ value: c, label: EXPENSE_LABELS[c] }))} placeholder="Pilih kategori" error={errors.category} required />
          <CurrencyField name="amount" label="Nominal" error={errors.amount} required />
        </div>
        <TextField name="description" label="Keterangan" placeholder="mis. Token listrik Oktober" error={errors.description} required />
        <div className="grid gap-3 sm:grid-cols-3">
          <DateField name="expenseDate" label="Tanggal" defaultValue={today} max={today} error={errors.expenseDate} />
          <SelectField name="method" label="Dibayar dengan" options={PAYMENT_METHODS.map((m) => ({ value: m, label: PAYMENT_LABELS[m] }))} defaultValue="CASH" error={errors.method} />
          {stores.length > 1 ? (
            <SelectField name="storeId" label="Outlet" options={stores} error={errors.storeId} />
          ) : (
            <input type="hidden" name="storeId" value={stores[0]?.value ?? ""} />
          )}
        </div>
      </div>
      <SubmitButton>Simpan Biaya</SubmitButton>
    </form>
  );
}

export function VoidExpenseButton({ action }: { action: (reason: string) => Promise<ActionResult> }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <span>
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          const reason = window.prompt("Alasan membatalkan biaya ini?");
          if (!reason?.trim()) return;
          start(async () => {
            const r = await action(reason);
            setError(r.success ? null : r.message);
          });
        }}
        className="text-xs font-medium text-error-500 hover:underline disabled:opacity-50"
      >
        {pending ? "..." : "Batalkan"}
      </button>
      {error && <span className="ml-2 text-xs text-error-500">{error}</span>}
    </span>
  );
}
