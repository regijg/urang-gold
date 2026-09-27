"use client";

import Link from "next/link";
import React, { useActionState, useState } from "react";
import type { ActionResult } from "@/lib/action-result";
import { FormAlert, FormCard, SelectField, SubmitButton, TextAreaField, fieldErrorsOf } from "../form";

type Option = { value: string; label: string };
type Props = {
  action: (
    prev: ActionResult<{ items: { inventory_id: string; barcode: string }[] }> | null,
    formData: FormData
  ) => Promise<ActionResult<{ items: { inventory_id: string; barcode: string }[] }>>;
  products: Option[];
  stores: Option[];
  locations: { id: string; store_id: string; code: string; name: string }[];
  defaultProductId?: string;
};

const cell =
  "h-10 w-full rounded-lg border bg-transparent px-3 text-sm text-gray-800 focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:bg-gray-900 dark:text-white/90";

export default function ReceiveForm({ action, products, stores, locations, defaultProductId }: Props) {
  const [state, formAction] = useActionState(action, null);
  const errors = fieldErrorsOf(state);
  const [storeId, setStoreId] = useState(stores[0]?.value ?? "");
  const [rows, setRows] = useState<number[]>([0]);
  const [copies, setCopies] = useState("1");
  const [nextKey, setNextKey] = useState(1);

  if (state?.success) {
    const ids = state.data.items.map((i) => i.inventory_id).join(",");
    return (
      <FormCard>
        <p className="text-sm font-medium text-success-600 dark:text-success-400">{state.message}</p>
        <p className="mt-2 font-mono text-sm text-gray-700 dark:text-gray-300">{state.data.items.map((i) => i.barcode).join(", ")}</p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link href={`/inventory/labels?ids=${ids}`} className="rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-600">
            Cetak Label Barcode
          </Link>
          <Link href="/inventory/new" className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 dark:border-gray-700 dark:text-gray-300" prefetch={false}>
            Input Lagi
          </Link>
          <Link href="/inventory" className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 dark:border-gray-700 dark:text-gray-300">
            Ke Daftar Stok
          </Link>
        </div>
      </FormCard>
    );
  }

  function addRows(n: number) {
    const count = Math.max(1, Math.min(n, 200 - rows.length));
    setRows((r) => [...r, ...Array.from({ length: count }, (_, i) => nextKey + i)]);
    setNextKey((k) => k + count);
  }

  return (
    <FormCard>
      <form action={formAction} className="space-y-6" noValidate>
        <FormAlert state={state} />
        <div className="grid gap-5 sm:grid-cols-3">
          <SelectField name="productId" label="Produk" required placeholder="Pilih produk" options={products} defaultValue={defaultProductId ?? ""} error={errors.productId} />
          <SelectField name="storeId" label="Outlet" required options={stores} value={storeId} onChange={(e) => setStoreId(e.target.value)} error={errors.storeId} />
          <SelectField
            name="locationId"
            label="Lokasi / Baki"
            placeholder="Tanpa lokasi"
            options={locations.filter((l) => l.store_id === storeId).map((l) => ({ value: l.id, label: `${l.code} — ${l.name}` }))}
            error={errors.locationId}
          />
        </div>

        <div>
          <p className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-400">Keping (satu baris = satu barang fisik, barcode dibuat otomatis)</p>
          {errors.items && <p className="mb-2 text-sm text-error-500">{errors.items}</p>}
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-500">
                  <th className="px-1 py-2">#</th>
                  <th className="px-1 py-2">Berat total (gram) *</th>
                  <th className="px-1 py-2">Berat batu (gram)</th>
                  <th className="px-1 py-2">No. seri</th>
                  <th className="px-1 py-2">Harga modal</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((key, i) => (
                  <tr key={key}>
                    <td className="px-1 py-1 text-gray-400">{i + 1}</td>
                    {(["grossWeight", "stoneWeight", "serialNumber", "costPrice"] as const).map((f) => (
                      <td key={f} className="px-1 py-1">
                        <input
                          name={f}
                          inputMode={f === "serialNumber" ? "text" : f === "costPrice" ? "numeric" : "decimal"}
                          placeholder={f === "grossWeight" ? "3,21" : f === "costPrice" || f === "stoneWeight" ? "Ikuti produk" : ""}
                          className={`${cell} ${errors[`${f}.${i}`] ? "border-error-500" : "border-gray-300 dark:border-gray-700"}`}
                        />
                        {errors[`${f}.${i}`] && <p className="mt-0.5 text-xs text-error-500">{errors[`${f}.${i}`]}</p>}
                      </td>
                    ))}
                    <td className="px-1 py-1">
                      {rows.length > 1 && (
                        <button type="button" onClick={() => setRows((r) => r.filter((k) => k !== key))} className="text-sm text-error-500 hover:underline">
                          Hapus
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => addRows(1)} className="rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:text-gray-300">
              + Tambah baris
            </button>
            <span className="text-sm text-gray-500">atau tambah</span>
            <input value={copies} onChange={(e) => setCopies(e.target.value)} inputMode="numeric" className={`${cell} w-20 border-gray-300 dark:border-gray-700`} />
            <button type="button" onClick={() => addRows(Number(copies) || 1)} className="rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:text-gray-300">
              baris sekaligus
            </button>
          </div>
        </div>

        <TextAreaField name="notes" label="Catatan" placeholder="Stok awal, titipan, dll." error={errors.notes} />
        <SubmitButton>Simpan Stok</SubmitButton>
      </form>
    </FormCard>
  );
}
