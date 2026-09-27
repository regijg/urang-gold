"use client";

import React, { useActionState } from "react";
import type { ActionResult } from "@/lib/action-result";
import { FormAlert, SubmitButton, TextField, fieldErrorsOf } from "./form";

export default function TenantProfileForm({
  action,
  name,
}: {
  action: (prev: ActionResult | null, formData: FormData) => Promise<ActionResult>;
  name: string;
}) {
  const [state, formAction] = useActionState(action, null);
  const errors = fieldErrorsOf(state);
  return (
    <form action={formAction} className="space-y-4" noValidate>
      <FormAlert state={state} />
      {state?.success && <p className="text-sm text-success-600">{state.message}</p>}
      <TextField name="name" label="Nama toko / usaha" required defaultValue={name} error={errors.name} hint="Tampil di header, nota, dan katalog" />
      <SubmitButton />
    </form>
  );
}
