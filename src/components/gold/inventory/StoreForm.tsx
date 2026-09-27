"use client";

import React, { useActionState } from "react";
import type { ActionResult } from "@/lib/action-result";
import type { StoreRow } from "@/server/repositories/store.repository";
import { CheckboxField, FormAlert, FormCard, SubmitButton, TextAreaField, TextField, fieldErrorsOf } from "../form";

type Props = {
  action: (prev: ActionResult | null, formData: FormData) => Promise<ActionResult>;
  initial?: StoreRow;
};

export default function StoreForm({ action, initial }: Props) {
  const [state, formAction] = useActionState(action, null);
  const errors = fieldErrorsOf(state);
  return (
    <FormCard>
      <form action={formAction} className="space-y-5" noValidate>
        <FormAlert state={state} />
        <div className="grid gap-5 sm:grid-cols-2">
          <TextField name="code" label="Kode Outlet" required defaultValue={initial?.code} placeholder="JKT-01" error={errors.code} className="uppercase" />
          <TextField name="name" label="Nama Outlet" required defaultValue={initial?.name} placeholder="Outlet Jakarta" error={errors.name} />
          <TextField name="phone" label="Telepon" type="tel" defaultValue={initial?.phone ?? ""} error={errors.phone} />
          <TextField name="whatsapp" label="WhatsApp" type="tel" defaultValue={initial?.whatsapp ?? ""} placeholder="6281234567890" hint="Dipakai untuk tombol WhatsApp di katalog" error={errors.whatsapp} />
        </div>
        <TextAreaField name="address" label="Alamat" defaultValue={initial?.address ?? ""} error={errors.address} />
        <CheckboxField name="isActive" label="Aktif" defaultChecked={initial?.is_active ?? true} />
        <CheckboxField name="catalogEnabled" label="Tampilkan katalog online (publik, stok & harga jual terlihat oleh siapa pun)" defaultChecked={initial?.catalog_enabled ?? false} />
        <SubmitButton />
      </form>
    </FormCard>
  );
}
