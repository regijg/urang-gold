"use client";

import React, { useEffect, useState, useTransition } from "react";
import { quickCreateCustomerAction, searchCustomersAction } from "@/app/(admin)/sales/actions";

export type PickedCustomer = { id: string; name: string; phone: string | null };

const input =
  "h-12 w-full rounded-xl border border-gray-300 bg-transparent px-4 text-base text-gray-800 focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90";

/** Search-or-create customer (used by POS and buyback). */
export default function CustomerPicker({
  value,
  onChange,
  placeholder = "Cari nama / nomor HP",
  onError,
}: {
  value: PickedCustomer | null;
  onChange: (c: PickedCustomer | null) => void;
  placeholder?: string;
  onError?: (message: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PickedCustomer[]>([]);
  const [draft, setDraft] = useState<{ name: string; phone: string } | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    const t = setTimeout(async () => {
      const r = await searchCustomersAction(query);
      if (r.success) setResults(r.data);
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  if (value) {
    return (
      <div className="flex items-center justify-between">
        <span className="text-gray-900 dark:text-white">
          {value.name} <span className="text-xs text-gray-500">{value.phone}</span>
        </span>
        <button type="button" onClick={() => onChange(null)} className="text-sm text-error-500">
          Ganti
        </button>
      </div>
    );
  }

  if (draft) {
    return (
      <div className="space-y-2">
        <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Nama" className={input} />
        <input value={draft.phone} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} placeholder="Nomor HP" inputMode="tel" className={input} />
        <div className="flex gap-2">
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const r = await quickCreateCustomerAction(draft);
                if (r.success) {
                  onChange(r.data);
                  setDraft(null);
                  setQuery("");
                } else onError?.(r.message);
              })
            }
            className="flex-1 rounded-lg bg-brand-500 py-2 text-sm text-white"
          >
            Simpan
          </button>
          <button type="button" onClick={() => setDraft(null)} className="flex-1 rounded-lg border border-gray-300 py-2 text-sm dark:border-gray-700 dark:text-gray-300">
            Batal
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={placeholder} className={input} />
      {results.length > 0 && (
        <ul className="absolute z-10 mt-1 w-full rounded-xl border border-gray-200 bg-white shadow-lg dark:border-gray-800 dark:bg-gray-900">
          {results.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => {
                  onChange(c);
                  setQuery("");
                  setResults([]);
                }}
                className="w-full px-4 py-2 text-left hover:bg-gray-50 dark:text-white dark:hover:bg-white/5"
              >
                {c.name} <span className="text-xs text-gray-500">{c.phone}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <button type="button" onClick={() => setDraft({ name: query, phone: "" })} className="mt-2 text-sm text-brand-500">
        + Customer baru
      </button>
    </div>
  );
}
