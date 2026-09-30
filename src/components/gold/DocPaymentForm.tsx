"use client";

import Link from "next/link";
import React, { useActionState } from "react";
import type { ActionResult } from "@/lib/action-result";
import { PAYMENT_LABELS, PAYMENT_METHODS } from "@/lib/payments";
import { CurrencyField, FormAlert, SelectField, SubmitButton, TextAreaField, TextField, fieldErrorsOf } from "./form";

type Props<T> = {
  action: (prev: ActionResult<T> | null, formData: FormData) => Promise<ActionResult<T>>;
  title: string;
  hint?: string;
  submitLabel: string;
  amountLabel?: string;
  defaultAmount?: string;
  methods?: readonly string[];
  /** reason textarea (cancel forms) */
  withReason?: boolean;
  confirmText?: string;
  danger?: boolean;
  /** extra fields rendered above the payment (e.g. final repair cost) */
  children?: React.ReactNode;
  /** link shown after success (e.g. the created sale) */
  successLink?: (data: T) => { href: string; label: string } | null;
};

/** One-payment form used by orders and repairs (pay, pick up, cancel with refund). */
export default function DocPaymentForm<T = null>({
  action,
  title,
  hint,
  submitLabel,
  amountLabel = "Nominal",
  defaultAmount,
  methods = PAYMENT_METHODS,
  withReason,
  confirmText,
  danger,
  children,
  successLink,
}: Props<T>) {
  const [state, formAction] = useActionState(action, null);
  const errors = fieldErrorsOf(state);
  if (state?.success && (successLink || withReason)) {
    const link = successLink?.(state.data);
    return (
      <div className="rounded-2xl border border-success-200 bg-success-50 p-5 text-sm text-success-700 dark:border-success-500/30 dark:bg-success-500/10 dark:text-success-400">
        <p>{state.message}</p>
        {link && (
          <Link href={link.href} className="mt-2 inline-block font-semibold underline">
            {link.label}
          </Link>
        )}
      </div>
    );
  }
  return (
    <form
      autoComplete="off"
      action={formAction}
      onSubmit={(e) => {
        if (confirmText && !window.confirm(confirmText)) e.preventDefault();
      }}
      className={`space-y-3 rounded-2xl border bg-white p-5 dark:bg-gray-900 ${danger ? "border-error-200 dark:border-error-500/30" : "border-gray-200 dark:border-gray-800"}`}
      noValidate
    >
      <div>
        <p className={`font-semibold ${danger ? "text-error-600" : "text-gray-900 dark:text-white"}`}>{title}</p>
        {hint && <p className="text-sm text-gray-500">{hint}</p>}
      </div>
      <FormAlert state={state} />
      {state?.success && <p className="text-sm text-success-600">{state.message}</p>}
      {children}
      {withReason && <TextAreaField name="reason" label="Alasan" required error={errors.reason} rows={2} />}
      <div className="grid gap-3 sm:grid-cols-2">
        <SelectField name="method" label="Metode" options={methods.map((m) => ({ value: m, label: PAYMENT_LABELS[m] ?? m }))} defaultValue="CASH" />
        <CurrencyField key={defaultAmount} name="amount" label={amountLabel} defaultValue={defaultAmount} error={errors.payments ?? errors["payments.0"]} />
      </div>
      <TextField name="reference" label="Referensi" placeholder="Opsional (no. transfer, dll.)" />
      <SubmitButton>{submitLabel}</SubmitButton>
    </form>
  );
}
