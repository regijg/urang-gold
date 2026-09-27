"use client";

import React, { useEffect, useRef, useState, useTransition } from "react";
import { formatGram, formatRupiah } from "@/lib/format";
import type { PosItem } from "@/server/repositories/sales.repository";
import { lookupBarcodeAction, searchItemsAction } from "@/app/(admin)/sales/actions";

export type CartLine = PosItem & { discount: string };

const input =
  "h-12 w-full rounded-xl border border-gray-300 bg-transparent px-4 text-base text-gray-800 focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90";
// text colour set on the card so every amount inside is readable in light and dark mode
const card = "rounded-2xl border border-gray-200 bg-white p-4 text-gray-800 dark:border-gray-800 dark:bg-gray-900 dark:text-white/90";
const digits = (v: string) => v.replace(/[^\d]/g, "");

/** Barcode scan + search + cart with per-line discount (POS and trade-in). */
export default function CartPanel({
  storeId,
  cart,
  setCart,
  onMessage,
  title,
}: {
  storeId: string;
  cart: CartLine[];
  setCart: React.Dispatch<React.SetStateAction<CartLine[]>>;
  onMessage: (m: { kind: "error" | "info"; text: string } | null) => void;
  title?: string;
}) {
  const [barcode, setBarcode] = useState("");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PosItem[]>([]);
  const [, startTransition] = useTransition();
  const barcodeRef = useRef<HTMLInputElement>(null);

  useEffect(() => barcodeRef.current?.focus(), [cart.length]);

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    const t = setTimeout(async () => {
      const r = await searchItemsAction(storeId, query);
      if (r.success) setResults(r.data.filter((i) => !cart.some((c) => c.id === i.id)));
    }, 300);
    return () => clearTimeout(t);
  }, [query, storeId, cart]);

  function addItem(item: PosItem) {
    if (item.price === null) {
      onMessage({ kind: "error", text: `Harga emas kadar ${item.purity_code} belum diatur.` });
      return;
    }
    if (cart.some((c) => c.id === item.id)) {
      onMessage({ kind: "info", text: `${item.barcode} sudah ada di keranjang.` });
      return;
    }
    setCart((c) => [...c, { ...item, discount: "" }]);
    onMessage(null);
    setQuery("");
    setResults([]);
  }

  function onScan(e: React.FormEvent) {
    e.preventDefault();
    const code = barcode.trim();
    if (!code) return;
    setBarcode("");
    startTransition(async () => {
      const r = await lookupBarcodeAction(storeId, code);
      if (r.success) addItem(r.data);
      else onMessage({ kind: "error", text: r.message });
    });
  }

  return (
    <div className="space-y-4">
      <div className={card}>
        {title && <p className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">{title}</p>}
        <form onSubmit={onScan}>
          <input ref={barcodeRef} value={barcode} onChange={(e) => setBarcode(e.target.value)} placeholder="Scan barcode lalu Enter" className={`${input} font-mono`} autoComplete="off" />
        </form>
        <div className="relative mt-3">
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Cari nama / barcode / no. seri" className={input} />
          {results.length > 0 && (
            <ul className="absolute z-10 mt-1 max-h-72 w-full overflow-auto rounded-xl border border-gray-200 bg-white shadow-lg dark:border-gray-800 dark:bg-gray-900">
              {results.map((r) => (
                <li key={r.id}>
                  <button type="button" onClick={() => addItem(r)} className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-white/5">
                    <span>
                      <span className="block font-medium text-gray-900 dark:text-white">{r.name}</span>
                      <span className="font-mono text-xs text-gray-500">
                        {r.barcode} · {r.purity_code} · {formatGram(r.gross_weight)}
                      </span>
                    </span>
                    <span className="text-sm font-medium text-gray-800 dark:text-white/90">{r.price ? formatRupiah(r.price) : "—"}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className={card}>
        {cart.length === 0 ? (
          <p className="py-10 text-center text-gray-400">Keranjang kosong. Scan barcode untuk menambah barang.</p>
        ) : (
          <ul className="divide-y divide-gray-100 dark:divide-gray-800">
            {cart.map((l, i) => (
              <li key={l.id} className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center">
                <div className="flex-1">
                  <p className="font-medium text-gray-900 dark:text-white">{l.name}</p>
                  <p className="font-mono text-xs text-gray-500">
                    {l.barcode} · {l.purity_code} · {formatGram(l.gold_weight)} emas
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-gray-600 dark:text-gray-300">{formatRupiah(l.price)}</span>
                  <input
                    value={l.discount}
                    onChange={(e) => setCart((c) => c.map((x, idx) => (idx === i ? { ...x, discount: digits(e.target.value) } : x)))}
                    placeholder="Diskon"
                    inputMode="numeric"
                    className="h-10 w-28 rounded-lg border border-gray-300 bg-transparent px-3 text-right text-sm dark:border-gray-700 dark:text-white"
                  />
                  <button type="button" onClick={() => setCart((c) => c.filter((x) => x.id !== l.id))} className="text-sm text-error-500 hover:underline">
                    Hapus
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
