"use client";

import { useRouter } from "next/navigation";
import React, { useActionState, useRef, useState, useTransition } from "react";
import type { ActionResult } from "@/lib/action-result";
import { formatGram } from "@/lib/format";
import { scanOpnameAction, submitOpnameAction, unscanOpnameAction } from "@/app/(admin)/inventory/stock-opname/actions";
import { FormAlert, SubmitButton, TextAreaField } from "../form";

const input =
  "h-12 rounded-xl border border-gray-300 bg-transparent px-4 text-base text-gray-800 focus:border-brand-300 focus:outline-hidden dark:border-gray-700 dark:bg-gray-900 dark:text-white/90";

/** Counting: scan barcode (+ optional weighed gross weight). Enter on barcode moves to weight. */
export function OpnameCounter({ opnameId, canSubmit }: { opnameId: string; canSubmit: boolean }) {
  const router = useRouter();
  const [barcode, setBarcode] = useState("");
  const [weight, setWeight] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const barcodeRef = useRef<HTMLInputElement>(null);

  function scan(e: React.FormEvent) {
    e.preventDefault();
    if (!barcode.trim()) return;
    const code = barcode;
    const w = weight;
    startTransition(async () => {
      const r = await scanOpnameAction(opnameId, code, w);
      if (r.success) {
        setMsg({
          ok: true,
          text: `${r.data.barcode} · ${r.data.name} — ${formatGram(r.data.physical_gross_weight)}${r.data.in_snapshot ? "" : " (tidak terduga di opname ini)"}`,
        });
        setBarcode("");
        setWeight("");
        router.refresh();
      } else setMsg({ ok: false, text: r.message });
      barcodeRef.current?.focus();
    });
  }

  return (
    <div className="space-y-3 rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
      <form onSubmit={scan} className="flex flex-col gap-3 sm:flex-row">
        <input ref={barcodeRef} autoFocus value={barcode} onChange={(e) => setBarcode(e.target.value)} placeholder="Scan barcode" className={`${input} flex-1 font-mono`} autoComplete="off" />
        <input value={weight} onChange={(e) => setWeight(e.target.value)} inputMode="decimal" placeholder="Berat timbang (opsional)" className={`${input} sm:w-56`} />
        <button type="submit" disabled={pending} className="h-12 rounded-xl bg-brand-500 px-6 font-semibold text-white disabled:opacity-50">
          Hitung
        </button>
      </form>
      <p className="text-xs text-gray-500">Kosongkan berat jika sesuai sistem. Scan ulang untuk mengoreksi berat.</p>
      {msg && <p className={`rounded-lg px-4 py-2 text-sm ${msg.ok ? "bg-success-50 text-success-700" : "bg-error-50 text-error-600"}`}>{msg.text}</p>}
      {canSubmit && (
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            if (!window.confirm("Selesai menghitung dan kirim untuk persetujuan? Barang yang belum discan dianggap tidak ditemukan.")) return;
            startTransition(async () => {
              const r = await submitOpnameAction(opnameId);
              setMsg({ ok: r.success, text: r.message });
              router.refresh();
            });
          }}
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium dark:border-gray-700 dark:text-gray-300"
        >
          Selesai & Kirim untuk Persetujuan
        </button>
      )}
    </div>
  );
}

export function UnscanButton({ opnameId, inventoryId }: { opnameId: string; inventoryId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await unscanOpnameAction(opnameId, inventoryId);
          router.refresh();
        })
      }
      className="text-xs text-error-500 hover:underline"
    >
      Batal hitung
    </button>
  );
}

export function OpnameReviewForm({
  action,
  canApprove,
  canCancel,
}: {
  action: (prev: ActionResult | null, formData: FormData) => Promise<ActionResult>;
  canApprove: boolean;
  canCancel: boolean;
}) {
  const [state, formAction] = useActionState(action, null);
  if (state?.success) return <p className="rounded-lg bg-success-50 px-4 py-3 text-sm text-success-700">{state.message}</p>;
  return (
    <form action={formAction} className="space-y-3 rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
      <p className="text-sm font-semibold text-gray-900 dark:text-white">Persetujuan</p>
      <FormAlert state={state} />
      <TextAreaField name="notes" label="Catatan" />
      <div className="flex flex-wrap gap-2">
        {canApprove && (
          <>
            <button name="decision" value="APPROVE" className="rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-medium text-white">
              Setujui & Terapkan Penyesuaian
            </button>
            <button name="decision" value="REJECT" className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm dark:border-gray-700 dark:text-gray-300">
              Hitung Ulang
            </button>
          </>
        )}
        {canCancel && (
          <button name="decision" value="CANCEL" className="rounded-lg border border-error-300 px-4 py-2.5 text-sm text-error-600">
            Batalkan Opname
          </button>
        )}
      </div>
    </form>
  );
}

export function StartOpnameForm({
  action,
  stores,
  locations,
}: {
  action: (prev: ActionResult | null, formData: FormData) => Promise<ActionResult>;
  stores: { value: string; label: string }[];
  locations: { id: string; store_id: string; code: string; name: string }[];
}) {
  const [state, formAction] = useActionState(action, null);
  const [storeId, setStoreId] = useState(stores[0]?.value ?? "");
  const sel = "h-11 w-full rounded-lg border border-gray-300 bg-transparent px-3 text-sm dark:border-gray-700 dark:text-white";
  return (
    <form action={formAction} className="mb-6 space-y-3 rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
      <p className="text-sm font-semibold text-gray-900 dark:text-white">Mulai stock opname</p>
      <FormAlert state={state} />
      <div className="grid gap-3 sm:grid-cols-3">
        <select name="storeId" value={storeId} onChange={(e) => setStoreId(e.target.value)} className={sel}>
          {stores.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        <select name="locationId" className={sel} defaultValue="">
          <option value="">Semua lokasi</option>
          {locations.filter((l) => l.store_id === storeId).map((l) => <option key={l.id} value={l.id}>{l.code} — {l.name}</option>)}
        </select>
        <input name="notes" placeholder="Catatan (opsional)" className={sel} />
      </div>
      <SubmitButton>Mulai</SubmitButton>
    </form>
  );
}
