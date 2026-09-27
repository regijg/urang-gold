"use client";

import React, { useActionState, useState } from "react";
import type { ActionResult } from "@/lib/action-result";
import type { StaffRow } from "@/server/services/users.service";
import { CheckboxField, Field, FormAlert, FormCard, SelectField, SubmitButton, TextField, fieldErrorsOf } from "./form";

type Props = {
  action: (prev: ActionResult | null, formData: FormData) => Promise<ActionResult>;
  roles: { code: string; name: string; description: string | null }[];
  stores: { id: string; name: string }[];
  initial?: StaffRow;
  isSelf?: boolean;
};

export default function StaffForm({ action, roles, stores, initial, isSelf }: Props) {
  const [state, formAction] = useActionState(action, null);
  const errors = fieldErrorsOf(state);
  const [role, setRole] = useState(initial?.role_code ?? "CASHIER");
  const assigned = new Set((initial?.stores ?? []).map((s) => s.store_id));
  const allStores = role === "OWNER" || role === "ADMIN";

  return (
    <FormCard>
      <form autoComplete="off" action={formAction} className="space-y-5" noValidate>
        <FormAlert state={state} />
        <div className="grid gap-5 sm:grid-cols-2">
          <TextField name="fullName" label="Nama" required defaultValue={initial?.full_name} error={errors.fullName} />
          {initial ? (
            <TextField name="emailDisplay" label="Email" defaultValue={initial.email} disabled />
          ) : (
            <TextField name="email" label="Email" type="email" required autoComplete="off" error={errors.email} />
          )}
          <TextField name="phone" label="Nomor HP" type="tel" defaultValue={initial?.phone ?? ""} error={errors.phone} />
          <TextField
            name="password"
            label={initial ? "Password baru (opsional)" : "Password"}
            type="password"
            required={!initial}
            autoComplete="new-password"
            hint={initial ? "Kosongkan jika tidak diubah" : "Minimal 8 karakter"}
            error={errors.password}
          />
          <SelectField
            name="roleCode"
            label="Role"
            required
            options={roles.map((r) => ({ value: r.code, label: r.name }))}
            value={role}
            onChange={(e) => setRole(e.target.value)}
            disabled={isSelf}
            hint={roles.find((r) => r.code === role)?.description ?? undefined}
            error={errors.roleCode}
          />
          {isSelf && <input type="hidden" name="roleCode" value={role} />}
        </div>

        <Field label="Akses outlet" name="storeIds" error={errors.storeIds} hint={allStores ? "Owner & Admin otomatis dapat mengakses semua outlet" : undefined}>
          <div className="grid gap-2 sm:grid-cols-2">
            {stores.map((s) => (
              <label key={s.id} className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                <input type="checkbox" name="storeIds" value={s.id} defaultChecked={assigned.has(s.id)} className="h-4 w-4 rounded border-gray-300" />
                {s.name}
              </label>
            ))}
          </div>
        </Field>

        {initial && !isSelf && <CheckboxField name="isActive" label="Aktif" defaultChecked={initial.is_active} />}
        {initial && isSelf && <input type="hidden" name="isActive" value="on" />}
        <SubmitButton />
      </form>
    </FormCard>
  );
}
