"use client";

import { useRouter } from "next/navigation";
import React, { useActionState, useState, useTransition } from "react";
import type { ActionResult } from "@/lib/action-result";
import { formatRupiah } from "@/lib/format";
import { PAYMENT_LABELS, PAYMENT_METHODS } from "@/lib/payments";
import { createRepairAction } from "@/app/(admin)/repairs/actions";
import CustomerPicker, { type PickedCustomer } from "../pos/CustomerPicker";
import RupiahInput from "../RupiahInput";
import { CurrencyField, FormAlert, SelectField, SubmitButton, TextField, fieldErrorsOf } from "../form";

const card = "rounded-2xl border border-gray-200 bg-white p-5 text-gray-800 dark:border-gray-800 dark:bg-gray-900 dark:text-white/90";
const field =
  "h-10 w-full rounded-lg border border-gray-300 bg-transparent px-3 text-sm text-gray-800 focus:border-brand-300 focus:outline-hidden dark:border-gray-700 dark:bg-gray-900 dark:text-white";
const label = "mb-1 block text-sm font-medium text-gray-700 dark:text-gray-400";

export function NewRepairForm({ stores, today }: { stores: { id: string; name: string }[]; today: string }) {
  const router = useRouter();
  const [storeId, setStoreId] = useState(stores[0]?.id ?? "");
  const [customer, setCustomer] = useState<PickedCustomer | null>(null);
  const [item, setItem] = useState("");
  const [service, setService] = useState("");
  const [weight, setWeight] = useState("");
  const [estimate, setEstimate] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [dp, setDp] = useState("");
  const [method, setMethod] = useState("CASH");
  const [notes, setNotes] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function save() {
    setMessage(null);
    setErrors({});
    if (!customer) return setMessage("Customer wajib dipilih.");
    start(async () => {
      const r = await createRepairAction({
        storeId,
        customerId: customer.id,
        itemDescription: item,
        serviceType: service,
        weightIn: weight,
        estimatedCost: estimate,
        dueDate,
        payments: dp ? [{ method, amount: dp, reference: "" }] : [],
        notes,
      });
      if (r.success) return router.push(`/repairs/${r.data.repair_id}`);
      setMessage(r.message);
      setErrors(r.fieldErrors ?? {});
    });
  }

  const err = (k: string) => errors[k] && <p className="mt-1 text-xs text-error-500">{errors[k]}</p>;

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
      <div className={`${card} space-y-4`}>
        {stores.length > 1 && (
          <div>
            <label className={label}>Outlet</label>
            <select value={storeId} onChange={(e) => setStoreId(e.target.value)} className={field}>
              {stores.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
        )}
        <div>
          <label className={label}>Barang yang diservis *</label>
          <input autoComplete="off" value={item} onChange={(e) => setItem(e.target.value)} placeholder="mis. Cincin emas kuning, batu biru" className={field} />
          {err("itemDescription")}
        </div>
        <div>
          <label className={label}>Jenis servis *</label>
          <input autoComplete="off" value={service} onChange={(e) => setService(e.target.value)} placeholder="mis. Patri + cuci, ganti batu, ukir nama" className={field} />
          {err("serviceType")}
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className={label}>Berat saat diterima</label>
            <div className="relative">
              <input autoComplete="off" inputMode="decimal" value={weight} onChange={(e) => setWeight(e.target.value)} placeholder="0,000" className={`${field} pr-14`} />
              <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-gray-400">gram</span>
            </div>
            {err("weightIn")}
          </div>
          <div>
            <label className={label}>Perkiraan biaya</label>
            <RupiahInput value={estimate} onValueChange={setEstimate} placeholder="0" className={field} />
            {err("estimatedCost")}
          </div>
          <div>
            <label className={label}>Janji selesai</label>
            <input type="date" value={dueDate} min={today} onChange={(e) => setDueDate(e.target.value)} className={field} />
            {err("dueDate")}
          </div>
        </div>
        <input autoComplete="off" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Catatan (opsional), mis. ada goresan di sisi kiri" className={field} />
      </div>

      <div className="space-y-4">
        <div className={card}>
          <p className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">Customer (wajib)</p>
          <CustomerPicker value={customer} onChange={setCustomer} onError={setMessage} />
        </div>
        <div className={`${card} space-y-3`}>
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Uang muka (opsional)</p>
          <div className="flex gap-2">
            <select value={method} onChange={(e) => setMethod(e.target.value)} className={`${field} w-36`}>
              {PAYMENT_METHODS.map((m) => (
                <option key={m} value={m}>
                  {PAYMENT_LABELS[m]}
                </option>
              ))}
            </select>
            <RupiahInput value={dp} onValueChange={setDp} placeholder="0" className={field} />
          </div>
        </div>
        {message && <p className="rounded-lg bg-error-50 px-4 py-2 text-sm text-error-600 dark:bg-error-500/10 dark:text-error-400">{message}</p>}
        <button type="button" onClick={save} disabled={pending} className="h-12 w-full rounded-xl bg-brand-500 text-lg font-semibold text-white hover:bg-brand-600 disabled:opacity-50">
          {pending ? "Menyimpan..." : "Simpan & Cetak Tanda Terima"}
        </button>
      </div>
    </div>
  );
}

type Action = (prev: ActionResult | null, formData: FormData) => Promise<ActionResult>;

export function RepairStatusForm({ action, status, finalCost }: { action: Action; status: string; finalCost: string }) {
  const [state, formAction] = useActionState(action, null);
  const errors = fieldErrorsOf(state);
  const next = status === "RECEIVED" ? ["IN_PROGRESS", "READY"] : status === "IN_PROGRESS" ? ["READY", "RECEIVED"] : ["IN_PROGRESS"];
  const labels: Record<string, string> = { IN_PROGRESS: "Mulai dikerjakan", READY: "Siap diambil", RECEIVED: "Kembali ke antrian" };
  return (
    <form autoComplete="off" action={formAction} className={`${card} space-y-3`} noValidate>
      <p className="font-semibold text-gray-900 dark:text-white">Ubah status</p>
      <FormAlert state={state} />
      <CurrencyField key={finalCost} name="finalCost" label="Biaya akhir" defaultValue={finalCost} hint="Isi saat servis selesai" error={errors.finalCost} />
      <div className="flex flex-wrap gap-2">
        {next.map((s) => (
          <button
            key={s}
            type="submit"
            name="status"
            value={s}
            className={`rounded-lg px-4 py-2 text-sm font-medium ${s === "READY" ? "bg-success-500 text-white hover:bg-success-600" : "border border-gray-300 text-gray-700 dark:border-gray-700 dark:text-gray-300"}`}
          >
            {labels[s]}
          </button>
        ))}
      </div>
    </form>
  );
}

/** Pick-up: final cost vs. what was already paid -> collect the rest or refund the excess. */
export function RepairPickupForm({ action, paid, defaultCost }: { action: Action; paid: string; defaultCost: string }) {
  const [state, formAction] = useActionState(action, null);
  const errors = fieldErrorsOf(state);
  const [cost, setCost] = useState(defaultCost);
  const diff = BigInt(cost || "0") - BigInt(paid);
  const kind = diff >= BigInt(0) ? "pay" : "refund";
  const amount = (diff >= BigInt(0) ? diff : -diff).toString();
  if (state?.success) return <p className={`${card} text-sm text-success-600`}>{state.message}</p>;
  return (
    <form
      autoComplete="off"
      action={formAction}
      onSubmit={(e) => {
        if (!window.confirm("Serahkan barang ke customer?")) e.preventDefault();
      }}
      className={`${card} space-y-3 border-success-200 dark:border-success-500/30`}
      noValidate
    >
      <p className="font-semibold text-gray-900 dark:text-white">Barang diambil customer</p>
      <FormAlert state={state} />
      <div>
        <label className={label}>Biaya akhir</label>
        <RupiahInput name="finalCost" value={cost} onValueChange={setCost} className={field} />
        {errors.finalCost && <p className="mt-1 text-xs text-error-500">{errors.finalCost}</p>}
      </div>
      <p className="text-sm text-gray-600 dark:text-gray-300">
        Sudah dibayar {formatRupiah(paid)} ·{" "}
        <span className="font-semibold">{diff === BigInt(0) ? "Lunas" : kind === "pay" ? `Kurang ${formatRupiah(amount)}` : `Kembalikan ${formatRupiah(amount)}`}</span>
      </p>
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="amount" value={diff === BigInt(0) ? "" : amount} />
      {diff !== BigInt(0) && (
        <SelectField name="method" label={kind === "pay" ? "Dibayar dengan" : "Dikembalikan dengan"} options={PAYMENT_METHODS.map((m) => ({ value: m, label: PAYMENT_LABELS[m] }))} defaultValue="CASH" />
      )}
      <TextField name="reference" label="Referensi" placeholder="Opsional" />
      <SubmitButton>Serahkan Barang</SubmitButton>
    </form>
  );
}
