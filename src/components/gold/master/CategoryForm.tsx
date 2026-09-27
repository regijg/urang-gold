"use client";

import React, { useActionState } from "react";
import type { ActionResult } from "@/lib/action-result";
import type { CategoryRow } from "@/server/repositories/master-data.repository";
import { CheckboxField, FormAlert, FormCard, SubmitButton, TextAreaField, TextField, fieldErrorsOf } from "../form";

type Props = {
  action: (prev: ActionResult | null, formData: FormData) => Promise<ActionResult>;
  initial?: CategoryRow;
};

export default function CategoryForm({ action, initial }: Props) {
  const [state, formAction] = useActionState(action, null);
  const errors = fieldErrorsOf(state);

  return (
    <FormCard>
      <form action={formAction} className="space-y-5" noValidate>
        <FormAlert state={state} />
        <div className="grid gap-5 sm:grid-cols-2">
          <TextField name="code" label="Kode" required maxLength={6} defaultValue={initial?.code} placeholder="RNG" hint="Dipakai sebagai awalan SKU" error={errors.code} className="uppercase" />
          <TextField name="name" label="Nama" required defaultValue={initial?.name} placeholder="Cincin" error={errors.name} />
          <TextField name="sortOrder" label="Urutan" type="number" min={0} defaultValue={initial?.sort_order ?? 0} error={errors.sortOrder} />
        </div>
        <TextAreaField name="description" label="Deskripsi" defaultValue={initial?.description ?? ""} error={errors.description} />
        <CheckboxField name="isActive" label="Aktif" defaultChecked={initial?.is_active ?? true} />
        <SubmitButton />
      </form>
    </FormCard>
  );
}
