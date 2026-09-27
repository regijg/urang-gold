"use client";

import React, { useActionState, useState } from "react";
import type { ActionResult } from "@/lib/action-result";
import { LOCATION_TYPES, LOCATION_TYPE_LABELS } from "@/lib/validation/inventory";
import type { LocationRow } from "@/server/repositories/location.repository";
import { CheckboxField, FormAlert, FormCard, SelectField, SubmitButton, TextField, fieldErrorsOf } from "../form";

type Props = {
  action: (prev: ActionResult | null, formData: FormData) => Promise<ActionResult>;
  stores: { value: string; label: string }[];
  locations: { id: string; store_id: string; code: string; name: string }[];
  initial?: LocationRow;
  defaultStoreId?: string;
};

export default function LocationForm({ action, stores, locations, initial, defaultStoreId }: Props) {
  const [state, formAction] = useActionState(action, null);
  const errors = fieldErrorsOf(state);
  const [storeId, setStoreId] = useState(initial?.store_id ?? defaultStoreId ?? stores[0]?.value ?? "");
  const parents = locations.filter((l) => l.store_id === storeId && l.id !== initial?.id);

  return (
    <FormCard>
      <form autoComplete="off" action={formAction} className="space-y-5" noValidate>
        <FormAlert state={state} />
        <div className="grid gap-5 sm:grid-cols-2">
          <SelectField name="storeId" label="Outlet" required options={stores} value={storeId} onChange={(e) => setStoreId(e.target.value)} error={errors.storeId} />
          <SelectField
            name="type"
            label="Tipe"
            required
            options={LOCATION_TYPES.map((t) => ({ value: t, label: LOCATION_TYPE_LABELS[t] }))}
            defaultValue={initial?.type ?? "BAKI"}
            error={errors.type}
          />
          <TextField name="code" label="Kode" required defaultValue={initial?.code} placeholder="A-01" error={errors.code} className="uppercase" />
          <TextField name="name" label="Nama" required defaultValue={initial?.name} placeholder="Baki A slot 1" error={errors.name} />
          <SelectField
            name="parentId"
            label="Induk (opsional)"
            placeholder="Tanpa induk"
            options={parents.map((p) => ({ value: p.id, label: `${p.code} — ${p.name}` }))}
            defaultValue={initial?.parent_id ?? ""}
            hint="Contoh: slot A-01 berada di Baki A"
            error={errors.parentId}
          />
          <TextField name="sortOrder" label="Urutan" type="number" min={0} defaultValue={initial?.sort_order ?? 0} error={errors.sortOrder} />
        </div>
        <CheckboxField name="isActive" label="Aktif" defaultChecked={initial?.is_active ?? true} />
        <SubmitButton />
      </form>
    </FormCard>
  );
}
