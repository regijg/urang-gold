"use client";

import React, { useActionState } from "react";
import type { ActionResult } from "@/lib/action-result";
import { PAYMENT_LABELS, PAYMENT_METHODS } from "@/lib/payments";
import { CurrencyField, FormAlert, SelectField, SubmitButton, TextField } from "./form";

export default function PayPurchaseForm({ action, remaining }: { action: (prev: ActionResult | null, formData: FormData) => Promise<ActionResult>; remaining: string }) {
  const [state, formAction] = useActionState(action, null);
  return (
    <form autoComplete="off" action={formAction} className="space-y-3 rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900" noValidate>
      <p className="text-sm font-semibold text-gray-900 dark:text-white">Bayar hutang supplier</p>
      <FormAlert state={state} />
      {state?.success && <p className="text-sm text-success-600">{state.message}</p>}
      <SelectField name="method" label="Metode" options={PAYMENT_METHODS.map((m) => ({ value: m, label: PAYMENT_LABELS[m] }))} defaultValue="BANK_TRANSFER" />
      <CurrencyField name="amount" label="Nominal" defaultValue={remaining} />
      <TextField name="reference" label="Referensi" />
      <SubmitButton>Catat Pembayaran</SubmitButton>
    </form>
  );
}
