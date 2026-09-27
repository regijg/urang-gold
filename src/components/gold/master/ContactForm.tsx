"use client";

import React, { useActionState } from "react";
import type { ActionResult } from "@/lib/action-result";
import { CheckboxField, FormAlert, FormCard, SubmitButton, TextAreaField, TextField, fieldErrorsOf } from "../form";

type Initial = {
  name: string;
  contact_person?: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
  is_active: boolean;
};

type Props = {
  kind: "customer" | "supplier";
  action: (prev: ActionResult | null, formData: FormData) => Promise<ActionResult>;
  initial?: Initial;
};

// Shared form for customers and suppliers (suppliers add a contact person).
export default function ContactForm({ kind, action, initial }: Props) {
  const [state, formAction] = useActionState(action, null);
  const errors = fieldErrorsOf(state);

  return (
    <FormCard>
      <form autoComplete="off" action={formAction} className="space-y-5" noValidate>
        <FormAlert state={state} />
        <div className="grid gap-5 sm:grid-cols-2">
          <TextField
            name="name"
            label={kind === "customer" ? "Nama Customer" : "Nama Supplier"}
            required
            defaultValue={initial?.name}
            error={errors.name}
          />
          {kind === "supplier" && (
            <TextField name="contactPerson" label="Nama Kontak" defaultValue={initial?.contact_person ?? ""} error={errors.contactPerson} />
          )}
          <TextField
            name="phone"
            label="Nomor HP"
            type="tel"
            inputMode="tel"
            defaultValue={initial?.phone ?? ""}
            placeholder="081234567890"
            hint={kind === "customer" ? "Satu nomor HP hanya untuk satu customer" : undefined}
            error={errors.phone}
          />
          <TextField name="email" label="Email" type="email" defaultValue={initial?.email ?? ""} error={errors.email} />
        </div>
        <TextAreaField name="address" label="Alamat" defaultValue={initial?.address ?? ""} error={errors.address} />
        <TextAreaField name="notes" label="Catatan" defaultValue={initial?.notes ?? ""} error={errors.notes} />
        <CheckboxField name="isActive" label="Aktif" defaultChecked={initial?.is_active ?? true} />
        <SubmitButton />
      </form>
    </FormCard>
  );
}
