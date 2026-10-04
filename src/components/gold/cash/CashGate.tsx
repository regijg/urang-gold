"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import React, { useActionState, useEffect } from "react";
import { openCashHereAction } from "@/app/(admin)/cash/actions";
import { formatDateTime, formatRupiah } from "@/lib/format";
import type { OpenCashInfo } from "@/server/services/cash.service";
import { CurrencyField, FormAlert, SubmitButton, fieldErrorsOf } from "../form";

type Store = { id: string; name: string };

/**
 * Cash drawer status for the selected outlet, shown on screens that handle cash (POS, buyback, trade-in).
 * Open: a green bar with the session and a "Tutup Kas" link. Closed: a blocking dialog to open the drawer
 * (the server rejects these transactions without an open drawer as well).
 */
export default function CashGate({
  storeId,
  stores,
  onStoreChange,
  sessions,
  canManage,
}: {
  storeId: string;
  stores: Store[];
  onStoreChange: (id: string) => void;
  sessions: OpenCashInfo[];
  canManage: boolean;
}) {
  const current = sessions.find((s) => s.store_id === storeId);

  if (current) {
    return (
      <div className="col-span-full flex flex-wrap items-center justify-between gap-2 rounded-xl border border-success-200 bg-success-50 px-4 py-2.5 text-sm text-success-700 dark:border-success-500/30 dark:bg-success-500/10 dark:text-success-400 print:hidden">
        <span className="flex flex-wrap items-center gap-x-2">
          <span className="h-2 w-2 rounded-full bg-success-500" aria-hidden="true" />
          <span className="font-medium">Kas terbuka</span>
          <span className="font-mono text-xs">{current.session_number}</span>
          <span>· sejak {formatDateTime(current.opened_at)} · modal {formatRupiah(current.opening_amount)}</span>
        </span>
        {canManage && (
          <Link href={`/cash/${current.id}`} className="font-semibold underline-offset-2 hover:underline">
            Tutup Kas
          </Link>
        )}
      </div>
    );
  }

  return <OpenCashDialog key={storeId} storeId={storeId} stores={stores} onStoreChange={onStoreChange} canManage={canManage} />;
}

function OpenCashDialog({ storeId, stores, onStoreChange, canManage }: { storeId: string; stores: Store[]; onStoreChange: (id: string) => void; canManage: boolean }) {
  const router = useRouter();
  const [state, formAction] = useActionState(openCashHereAction.bind(null, storeId), null);
  const errors = fieldErrorsOf(state);

  useEffect(() => {
    if (state?.success) router.refresh();
  }, [state, router]);

  return (
    <div className="fixed inset-0 z-[999999] flex items-center justify-center bg-gray-900/60 px-4" role="dialog" aria-modal="true" aria-labelledby="open-cash-title">
      <div className="w-full max-w-sm rounded-2xl border border-gray-200 bg-white p-6 text-gray-800 shadow-xl dark:border-gray-800 dark:bg-gray-900 dark:text-white/90">
        <div className="mb-4 flex justify-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-400">
            <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a2.25 2.25 0 0 0-2.25-2.25H15a3 3 0 1 1-6 0H5.25A2.25 2.25 0 0 0 3 12m18 0v6a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 18v-6m18 0V9M3 12V9m18 0a2.25 2.25 0 0 0-2.25-2.25H5.25A2.25 2.25 0 0 0 3 9m18 0V6a2.25 2.25 0 0 0-2.25-2.25H5.25A2.25 2.25 0 0 0 3 6v3" />
            </svg>
          </span>
        </div>
        <h2 id="open-cash-title" className="text-center text-lg font-bold text-gray-900 dark:text-white">
          Buka Kas
        </h2>
        <p className="mb-5 mt-1 text-center text-sm text-gray-500 dark:text-gray-400">
          Kas belum dibuka. Isi modal awal uang tunai di laci untuk mulai bertransaksi.
        </p>

        {stores.length > 1 && (
          <label className="mb-4 block text-sm font-medium text-gray-700 dark:text-gray-400">
            Outlet
            <select
              value={storeId}
              onChange={(e) => onStoreChange(e.target.value)}
              className="mt-1 h-10 w-full rounded-lg border border-gray-300 bg-transparent px-3 text-sm text-gray-800 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
            >
              {stores.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
        )}

        {canManage ? (
          <form action={formAction} autoComplete="off" noValidate className="space-y-3">
            <FormAlert state={state} />
            <CurrencyField name="openingAmount" label="Modal kas awal" error={errors.openingAmount} hint="Uang tunai di laci saat toko buka. Isi 0 jika tidak ada." autoFocus />
            <SubmitButton>Mulai</SubmitButton>
          </form>
        ) : (
          <p className="rounded-lg bg-warning-50 px-4 py-3 text-sm text-warning-700 dark:bg-warning-500/10 dark:text-warning-400">
            Akun ini tidak punya izin membuka kas. Minta owner, manager, atau kasir yang punya izin <b>Kas Harian</b> untuk membuka kas.
          </p>
        )}

        <Link href="/dashboard" className="mt-3 block py-2 text-center text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
          Kembali ke Dashboard
        </Link>
      </div>
    </div>
  );
}
