"use client";

import React, { useActionState } from "react";
import type { ActionResult } from "@/lib/action-result";
import type { PurityRow } from "@/server/repositories/master-data.repository";
import { CheckboxField, FormAlert, FormCard, SubmitButton, TextField, fieldErrorsOf } from "../form";

type Props = {
  action: (prev: ActionResult | null, formData: FormData) => Promise<ActionResult>;
  initial?: PurityRow;
};

export default function PurityForm({ action, initial }: Props) {
  const [state, formAction] = useActionState(action, null);
  const errors = fieldErrorsOf(state);

  return (
    <FormCard>
      <form autoComplete="off" action={formAction} className="space-y-5" noValidate>
        <FormAlert state={state} />
        <div className="grid gap-5 sm:grid-cols-2">
          <TextField name="code" label="Kode" required maxLength={20} defaultValue={initial?.code} placeholder="18K" error={errors.code} className="uppercase" />
          <TextField name="name" label="Nama" required defaultValue={initial?.name} placeholder="Emas 18 Karat" error={errors.name} />
          <TextField
            name="percentage"
            label="Persentase Kemurnian"
            required
            inputMode="decimal"
            suffix="%"
            defaultValue={initial?.percentage.toString().replace(".", ",")}
            placeholder="75,000"
            hint="Dipakai untuk menghitung nilai emas"
            error={errors.percentage}
          />
          <TextField name="sortOrder" label="Urutan" type="number" min={0} defaultValue={initial?.sort_order ?? 0} error={errors.sortOrder} />
        </div>
        <CheckboxField name="isActive" label="Aktif" defaultChecked={initial?.is_active ?? true} />
        <SubmitButton />
      </form>
    </FormCard>
  );
}
