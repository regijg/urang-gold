"use client";

import React, { useActionState, useState } from "react";
import type { ActionResult } from "@/lib/action-result";
import { STATUS_LABELS, STATUS_TRANSITIONS, type PieceStatus } from "@/lib/validation/inventory";
import type { InventoryRow } from "@/server/repositories/inventory.repository";
import { CurrencyField, FormAlert, SelectField, SubmitButton, TextAreaField, TextField, WeightField, fieldErrorsOf } from "../form";

type Action = (prev: ActionResult | null, formData: FormData) => Promise<ActionResult>;
type Option = { value: string; label: string };

function Success({ state }: { state: ActionResult | null }) {
  if (!state?.success) return null;
  return (
    <div className="rounded-lg border border-success-200 bg-success-50 px-4 py-3 text-sm text-success-700 dark:border-success-500/30 dark:bg-success-500/10 dark:text-success-400">
      {state.message}
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
      <h2 className="mb-4 text-base font-semibold text-gray-900 dark:text-white">{title}</h2>
      {children}
    </div>
  );
}

export function StatusChangeForm({ action, status }: { action: Action; status: PieceStatus }) {
  const [state, formAction] = useActionState(action, null);
  const errors = fieldErrorsOf(state);
  const options = STATUS_TRANSITIONS[status].map((s) => ({ value: s, label: STATUS_LABELS[s] }));
  if (options.length === 0) return null;
  return (
    <Card title="Ubah Status">
      <form action={formAction} className="space-y-4" noValidate>
        <FormAlert state={state} />
        <Success state={state} />
        <SelectField name="toStatus" label="Status baru" required placeholder="Pilih status" options={options} error={errors.toStatus} />
        <WeightField name="newGrossWeight" label="Berat total baru (opsional)" hint="Isi jika berat berubah, misalnya setelah reparasi/lebur" error={errors.newGrossWeight} />
        <TextAreaField name="notes" label="Alasan / catatan" hint="Wajib untuk status Rusak, Hilang, Dilebur" error={errors.notes} />
        <SubmitButton>Ubah Status</SubmitButton>
      </form>
    </Card>
  );
}

export function TransferForm({
  action,
  stores,
  locations,
  currentStoreId,
}: {
  action: Action;
  stores: Option[];
  locations: { id: string; store_id: string; code: string; name: string }[];
  currentStoreId: string;
}) {
  const [state, formAction] = useActionState(action, null);
  const errors = fieldErrorsOf(state);
  const [storeId, setStoreId] = useState(currentStoreId);
  return (
    <Card title="Pindah Lokasi / Outlet">
      <form action={formAction} className="space-y-4" noValidate>
        <FormAlert state={state} />
        <Success state={state} />
        <SelectField name="toStoreId" label="Outlet tujuan" required options={stores} value={storeId} onChange={(e) => setStoreId(e.target.value)} error={errors.toStoreId} />
        <SelectField
          name="toLocationId"
          label="Lokasi tujuan"
          placeholder="Tanpa lokasi"
          options={locations.filter((l) => l.store_id === storeId).map((l) => ({ value: l.id, label: `${l.code} — ${l.name}` }))}
          error={errors.toLocationId}
        />
        <TextAreaField name="notes" label="Catatan" error={errors.notes} />
        {errors.barcodes && <p className="text-sm text-error-500">{errors.barcodes}</p>}
        <SubmitButton>Pindahkan</SubmitButton>
      </form>
    </Card>
  );
}

const moneyText = (v: string) => (Number(v) === 0 ? "" : v.replace(/\.00$/, ""));

export function DetailsForm({ action, item }: { action: Action; item: InventoryRow }) {
  const [state, formAction] = useActionState(action, null);
  const errors = fieldErrorsOf(state);
  return (
    <Card title="Data Barang">
      <form action={formAction} className="space-y-4" noValidate>
        <FormAlert state={state} />
        <Success state={state} />
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField name="name" label="Nama" required defaultValue={item.name} error={errors.name} />
          <TextField name="serialNumber" label="No. seri" defaultValue={item.serial_number ?? ""} error={errors.serialNumber} />
          <TextField name="stoneType" label="Jenis batu" defaultValue={item.stone_type ?? ""} error={errors.stoneType} />
          <CurrencyField name="costPrice" label="Harga modal" defaultValue={moneyText(item.cost_price)} error={errors.costPrice} />
          <CurrencyField name="laborCost" label="Ongkos" defaultValue={moneyText(item.labor_cost)} error={errors.laborCost} />
          <CurrencyField name="stonePrice" label="Harga batu" defaultValue={moneyText(item.stone_price)} error={errors.stonePrice} />
          <CurrencyField name="marginAmount" label="Margin" defaultValue={moneyText(item.margin_amount)} error={errors.marginAmount} />
        </div>
        <TextAreaField name="notes" label="Catatan" defaultValue={item.notes ?? ""} error={errors.notes} />
        <SubmitButton />
      </form>
    </Card>
  );
}

export function BulkTransferForm({
  action,
  stores,
  locations,
}: {
  action: (prev: ActionResult<{ moved: number }> | null, formData: FormData) => Promise<ActionResult<{ moved: number }>>;
  stores: Option[];
  locations: { id: string; store_id: string; code: string; name: string }[];
}) {
  const [state, formAction] = useActionState(action, null);
  const errors = fieldErrorsOf(state);
  const [storeId, setStoreId] = useState(stores[0]?.value ?? "");
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
      <form action={formAction} className="space-y-5" noValidate>
        <FormAlert state={state} />
        {state?.success && (
          <div className="rounded-lg border border-success-200 bg-success-50 px-4 py-3 text-sm text-success-700 dark:border-success-500/30 dark:bg-success-500/10 dark:text-success-400">
            {state.message}
          </div>
        )}
        <TextAreaField
          name="barcodes"
          label="Barcode"
          required
          rows={8}
          placeholder={"Scan atau ketik barcode, satu per baris\nGOLD-000001\nGOLD-000002"}
          error={errors.barcodes}
        />
        <div className="grid gap-5 sm:grid-cols-2">
          <SelectField name="toStoreId" label="Outlet tujuan" required options={stores} value={storeId} onChange={(e) => setStoreId(e.target.value)} error={errors.toStoreId} />
          <SelectField
            name="toLocationId"
            label="Lokasi tujuan"
            placeholder="Tanpa lokasi"
            options={locations.filter((l) => l.store_id === storeId).map((l) => ({ value: l.id, label: `${l.code} — ${l.name}` }))}
            error={errors.toLocationId}
          />
        </div>
        <TextAreaField name="notes" label="Catatan" error={errors.notes} />
        <SubmitButton>Pindahkan Semua</SubmitButton>
      </form>
    </div>
  );
}
