"use client";

import React, { useActionState } from "react";
import type { ActionResult } from "@/lib/action-result";
import { FormAlert, SubmitButton, TextAreaField, fieldErrorsOf } from "../form";

export default function VoidSaleForm({ action }: { action: (prev: ActionResult | null, formData: FormData) => Promise<ActionResult> }) {
  const [state, formAction] = useActionState(action, null);
  const errors = fieldErrorsOf(state);
  if (state?.success) return <p className="text-sm text-success-600">{state.message}</p>;
  return (
    <form autoComplete="off"
      action={formAction}
      onSubmit={(e) => {
        if (!window.confirm("Batalkan transaksi ini? Barang akan kembali tersedia dan pembayaran dicatat sebagai refund.")) e.preventDefault();
      }}
      className="space-y-3 rounded-2xl border border-error-200 bg-white p-5 dark:border-error-500/30 dark:bg-gray-900"
      noValidate
    >
      <p className="text-sm font-semibold text-error-600">Batalkan transaksi</p>
      <FormAlert state={state} />
      <TextAreaField name="reason" label="Alasan" required error={errors.reason} />
      <SubmitButton>Batalkan Transaksi</SubmitButton>
    </form>
  );
}
