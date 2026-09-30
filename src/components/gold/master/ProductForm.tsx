"use client";

import Link from "next/link";
import React, { useActionState, useState } from "react";
import type { ActionResult } from "@/lib/action-result";
import type { ProductRow } from "@/server/repositories/product.repository";
import {
  CheckboxField,
  CurrencyField,
  FormAlert,
  FormCard,
  SelectField,
  StickyActions,
  SubmitButton,
  TextAreaField,
  TextField,
  WeightField,
  fieldErrorsOf,
} from "../form";

type Option = { value: string; label: string };

type Props = {
  action: (prev: ActionResult<{ id: string }> | null, formData: FormData) => Promise<ActionResult<{ id: string }>>;
  categories: Option[];
  purities: Option[];
  initial?: ProductRow;
};

/** numeric string from Postgres -> Indonesian input text ("3.210" -> "3,210", "8500000.00" -> "8500000") */
const weightText = (v?: string) => (v ? String(v).replace(".", ",") : "");
const moneyText = (v?: string) => (v && Number(v) !== 0 ? String(v).replace(/\.00$/, "") : "");

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="space-y-5">
      <legend className="mb-3 text-base font-semibold text-gray-900 dark:text-white">{title}</legend>
      {children}
    </fieldset>
  );
}

export default function ProductForm({ action, categories, purities, initial }: Props) {
  const [state, formAction] = useActionState(action, null);
  const errors = fieldErrorsOf(state);
  const [laborMode, setLaborMode] = useState<"PER_PIECE" | "PER_GRAM">(initial?.labor_per_gram != null ? "PER_GRAM" : "PER_PIECE");

  // Created, but the photo upload failed: product exists, offer to continue on its page.
  if (state?.success) {
    return (
      <FormCard>
        <p className="text-sm text-warning-600 dark:text-warning-400">{state.message}</p>
        <Link href={`/products/${state.data.id}`} className="mt-4 inline-block text-sm font-medium text-brand-500 hover:underline">
          Buka produk
        </Link>
      </FormCard>
    );
  }

  return (
    <FormCard>
      <form autoComplete="off" action={formAction} className="space-y-6" noValidate>
        <FormAlert state={state} />

        <Section title="Informasi Produk">
          <div className="grid gap-5 sm:grid-cols-2">
            <TextField name="name" label="Nama Produk" required defaultValue={initial?.name} placeholder="Cincin Berlian" error={errors.name} />
            <TextField
              name="sku"
              label="SKU"
              defaultValue={initial?.sku}
              placeholder="Otomatis jika kosong"
              hint="Kosongkan untuk dibuat otomatis, contoh RNG-00001"
              error={errors.sku}
              className="uppercase"
            />
            <SelectField name="categoryId" label="Kategori" required placeholder="Pilih kategori" options={categories} defaultValue={initial?.category_id ?? ""} error={errors.categoryId} />
            <SelectField name="purityId" label="Kadar" required placeholder="Pilih kadar" options={purities} defaultValue={initial?.purity_id ?? ""} error={errors.purityId} />
          </div>
          <TextAreaField name="description" label="Deskripsi" defaultValue={initial?.description ?? ""} error={errors.description} />
        </Section>

        <Section title="Berat & Batu">
          <div className="grid gap-5 sm:grid-cols-3">
            <WeightField name="grossWeight" label="Berat Total" required defaultValue={weightText(initial?.gross_weight)} error={errors.grossWeight} />
            <WeightField name="stoneWeight" label="Berat Batu" defaultValue={weightText(initial?.stone_weight)} error={errors.stoneWeight} hint="Berat emas = berat total − berat batu" />
            <TextField name="stoneType" label="Jenis Batu" defaultValue={initial?.stone_type ?? ""} placeholder="Berlian, zirkon, ..." error={errors.stoneType} />
          </div>
        </Section>

        <Section title="Komponen Harga">
          <p className="-mt-2 text-sm text-gray-500 dark:text-gray-400">Harga jual dihitung dari harga emas harian + komponen ini (modul Harga Emas).</p>
          <div className="grid gap-5 sm:grid-cols-2">
            <CurrencyField name="costPrice" label="Harga Modal" defaultValue={moneyText(initial?.cost_price)} error={errors.costPrice} />
            <div>
              <input type="hidden" name="laborMode" value={laborMode} />
              <div className="mb-1 flex items-center justify-between gap-2">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-400">Ongkos Produksi</span>
                <div className="flex rounded-lg border border-gray-300 p-0.5 text-xs dark:border-gray-700">
                  {(["PER_PIECE", "PER_GRAM"] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setLaborMode(m)}
                      className={`rounded-md px-2.5 py-1 ${laborMode === m ? "bg-brand-500 text-white" : "text-gray-600 dark:text-gray-300"}`}
                    >
                      {m === "PER_PIECE" ? "Per keping" : "Per gram"}
                    </button>
                  ))}
                </div>
              </div>
              {laborMode === "PER_PIECE" ? (
                <CurrencyField name="laborCost" label="" aria-label="Ongkos per keping" defaultValue={moneyText(initial?.labor_cost)} error={errors.laborCost} />
              ) : (
                <CurrencyField
                  name="laborPerGram"
                  label=""
                  aria-label="Ongkos per gram"
                  defaultValue={moneyText(initial?.labor_per_gram ?? undefined)}
                  error={errors.laborPerGram}
                  hint="Dikali berat emas tiap keping (berat total − batu)"
                />
              )}
            </div>
            <CurrencyField name="stonePrice" label="Harga Batu" defaultValue={moneyText(initial?.stone_price)} error={errors.stonePrice} />
            <CurrencyField name="marginAmount" label="Margin" defaultValue={moneyText(initial?.margin_amount)} error={errors.marginAmount} />
          </div>
        </Section>


        <CheckboxField name="isActive" label="Aktif" defaultChecked={initial?.is_active ?? true} />
        <StickyActions>
          <SubmitButton />
        </StickyActions>
      </form>
    </FormCard>
  );
}
