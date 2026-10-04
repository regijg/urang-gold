"use client";

import React, { useActionState } from "react";
import type { ActionResult } from "@/lib/action-result";
import { PLAN_LABELS, TENANT_PLANS } from "@/lib/validation/platform";
import { FormAlert, SelectField, SubmitButton, TextField, fieldErrorsOf } from "@/components/gold/form";

type Action = (prev: ActionResult | null, formData: FormData) => Promise<ActionResult>;

export default function TenantForm({ action }: { action: Action }) {
  const [state, formAction] = useActionState(action, null);
  const errors = fieldErrorsOf(state);

  return (
    <form
      autoComplete="off"
      action={formAction}
      noValidate
      className="max-w-2xl space-y-4 rounded-2xl border border-gray-200 bg-white p-5 text-gray-800 dark:border-gray-800 dark:bg-gray-900 dark:text-white/90"
    >
      <FormAlert state={state} />

      <p className="text-sm font-semibold text-gray-900 dark:text-white">Toko</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <TextField name="tenantName" label="Nama usaha" placeholder="Toko Emas Sejahtera" error={errors.tenantName} required />
        <TextField name="storeName" label="Nama outlet pertama" placeholder="Outlet Pusat" hint="Kosongkan untuk memakai nama usaha." error={errors.storeName} />
      </div>
      <SelectField name="plan" label="Paket" options={TENANT_PLANS.map((p) => ({ value: p, label: PLAN_LABELS[p] }))} defaultValue="FREE" error={errors.plan} />

      <p className="pt-2 text-sm font-semibold text-gray-900 dark:text-white">Akun owner toko</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <TextField name="fullName" label="Nama owner" placeholder="Nama lengkap" error={errors.fullName} required />
        <TextField name="email" type="email" label="Email (untuk login)" placeholder="owner@toko.com" error={errors.email} required />
      </div>
      <TextField
        name="password"
        type="text"
        label="Password awal"
        placeholder="Minimal 8 karakter"
        hint="Berikan email dan password ini ke pelanggan. Catat sekarang, password tidak ditampilkan lagi."
        error={errors.password}
        required
      />

      <SubmitButton>Buat Toko</SubmitButton>
    </form>
  );
}
