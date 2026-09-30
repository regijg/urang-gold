"use client";

import React, { useActionState, useEffect, useState } from "react";
import type { ActionResult } from "@/lib/action-result";
import { formatRupiah } from "@/lib/format";
import { CurrencyField, FormAlert, SelectField, SubmitButton, TextField, fieldErrorsOf } from "../form";

type Action = (prev: ActionResult | null, formData: FormData) => Promise<ActionResult>;
const card = "rounded-2xl border border-gray-200 bg-white p-5 text-gray-800 dark:border-gray-800 dark:bg-gray-900 dark:text-white/90";

export function OpenCashForm({ action, stores }: { action: Action; stores: { value: string; label: string }[] }) {
  const [state, formAction] = useActionState(action, null);
  const errors = fieldErrorsOf(state);
  return (
    <form autoComplete="off" action={formAction} className={`${card} space-y-3`} noValidate>
      <p className="font-semibold text-gray-900 dark:text-white">Buka kas</p>
      <FormAlert state={state} />
      <div className="grid gap-3 sm:grid-cols-3">
        {stores.length > 1 ? (
          <SelectField name="storeId" label="Outlet" options={stores} error={errors.storeId} />
        ) : (
          <input type="hidden" name="storeId" value={stores[0]?.value ?? ""} />
        )}
        <CurrencyField name="openingAmount" label="Modal awal di laci" error={errors.openingAmount} hint="Uang tunai saat toko buka" />
        <TextField name="notes" label="Catatan" placeholder="Opsional" />
      </div>
      <SubmitButton>Buka Kas</SubmitButton>
    </form>
  );
}

export function CashMovementForm({ action }: { action: Action }) {
  const [state, formAction] = useActionState(action, null);
  const errors = fieldErrorsOf(state);
  // new key after each successful save = empty fields for the next entry
  const [key, setKey] = useState(0);
  useEffect(() => {
    if (state?.success) setKey((k) => k + 1);
  }, [state]);
  return (
    <form autoComplete="off" action={formAction} className={`${card} space-y-3`} noValidate>
      <p className="font-semibold text-gray-900 dark:text-white">Uang masuk / keluar laci</p>
      <p className="text-sm text-gray-500">Selain transaksi: tambah modal, setor ke bank, ambil untuk belanja, dll.</p>
      <FormAlert state={state} />
      {state?.success && <p className="text-sm text-success-600">{state.message}</p>}
      <div key={key} className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-[140px_1fr]">
          <SelectField
            name="direction"
            label="Jenis"
            options={[
              { value: "OUT", label: "Uang keluar" },
              { value: "IN", label: "Uang masuk" },
            ]}
            error={errors.direction}
          />
          <CurrencyField name="amount" label="Nominal" error={errors.amount} />
        </div>
        <TextField name="reason" label="Keterangan" placeholder="mis. Setor ke BCA" error={errors.reason} required />
      </div>
      <SubmitButton>Catat</SubmitButton>
    </form>
  );
}

export function CloseCashForm({ action, expected }: { action: Action; expected: string }) {
  const [state, formAction] = useActionState(action, null);
  const errors = fieldErrorsOf(state);
  const [counted, setCounted] = useState("");
  const diff = counted === "" ? null : BigInt(counted) - BigInt(expected);
  return (
    <form
      autoComplete="off"
      action={formAction}
      onSubmit={(e) => {
        if (!window.confirm("Tutup kas sekarang? Setelah ditutup, kas tidak bisa diubah lagi.")) e.preventDefault();
      }}
      className={`${card} space-y-3 border-brand-200 dark:border-brand-500/30`}
      noValidate
    >
      <p className="font-semibold text-gray-900 dark:text-white">Tutup kas</p>
      <p className="text-sm text-gray-500">Hitung uang tunai di laci, lalu isi jumlahnya.</p>
      <FormAlert state={state} />
      <CurrencyField
        name="countedAmount"
        label="Uang di laci (hasil hitung)"
        error={errors.countedAmount}
        onInput={(e) => setCounted((e.target as HTMLInputElement).value.replace(/\D/g, ""))}
      />
      {diff !== null && (
        <p className={`text-sm font-medium ${diff === BigInt(0) ? "text-success-600" : "text-warning-600"}`}>
          {diff === BigInt(0) ? "Cocok dengan catatan sistem" : diff > BigInt(0) ? `Lebih ${formatRupiah(diff.toString())}` : `Kurang ${formatRupiah((-diff).toString())}`}
        </p>
      )}
      <TextField name="notes" label="Keterangan selisih" placeholder="Wajib jika ada selisih" error={errors.notes} />
      <SubmitButton>Tutup Kas</SubmitButton>
    </form>
  );
}
