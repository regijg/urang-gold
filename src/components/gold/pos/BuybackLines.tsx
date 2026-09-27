"use client";

import React, { useState, useTransition } from "react";
import { formatRupiah, groupThousands } from "@/lib/format";
import { previewBuybackLine } from "@/lib/validation/buyback";
import { dbRupiah } from "@/lib/validation/common";
import { sumRupiah } from "@/lib/validation/sales";
import { findSoldPieceAction } from "@/app/(admin)/buybacks/actions";
import RupiahInput from "@/components/gold/RupiahInput";

export type BuybackPurity = { purity_id: string; code: string; buy_price: string | null };
export type BuybackLine = {
  key: number;
  inventoryId: string;
  label: string;
  name: string;
  categoryId: string;
  purityId: string;
  grossWeight: string;
  stoneWeight: string;
  pricePerGram: string;
  deduction: string;
};

export const emptyBuybackLine = (key: number): BuybackLine => ({
  key,
  inventoryId: "",
  label: "",
  name: "",
  categoryId: "",
  purityId: "",
  grossWeight: "",
  stoneWeight: "",
  pricePerGram: "",
  deduction: "",
});

export function rateOf(purities: BuybackPurity[], purityId: string): string {
  const p = purities.find((x) => x.purity_id === purityId);
  return p?.buy_price ? dbRupiah(p.buy_price) : "";
}

/** Display total of the lines (the database recomputes and verifies). */
export function buybackTotal(lines: BuybackLine[], purities: BuybackPurity[]): string {
  return sumRupiah(
    lines.map((l) => {
      const pv = previewBuybackLine(l.grossWeight, l.stoneWeight, l.pricePerGram || rateOf(purities, l.purityId), l.deduction);
      return pv && pv.valid ? pv.net : "0";
    })
  );
}

export function toBuybackPayload(lines: BuybackLine[]) {
  return lines.map((l) => ({
    inventoryId: l.inventoryId,
    name: l.name,
    categoryId: l.categoryId,
    purityId: l.purityId,
    grossWeight: l.grossWeight,
    stoneWeight: l.stoneWeight,
    pricePerGram: l.pricePerGram,
    deduction: l.deduction,
  }));
}

const cell =
  "h-10 w-full rounded-lg border border-gray-300 bg-transparent px-3 text-sm text-gray-800 focus:border-brand-300 focus:outline-hidden dark:border-gray-700 dark:bg-gray-900 dark:text-white/90";
// text colour set on the card so every amount inside is readable in light and dark mode
const card = "rounded-2xl border border-gray-200 bg-white p-4 text-gray-800 dark:border-gray-800 dark:bg-gray-900 dark:text-white/90";

/** Editor for items bought from the customer (buyback and trade-in). */
export default function BuybackLines({
  lines,
  setLines,
  categories,
  purities,
  canOverridePrice,
  fieldErrors,
  onError,
}: {
  lines: BuybackLine[];
  setLines: React.Dispatch<React.SetStateAction<BuybackLine[]>>;
  categories: { id: string; name: string }[];
  purities: BuybackPurity[];
  canOverridePrice: boolean;
  fieldErrors: Record<string, string>;
  onError: (message: string | null) => void;
}) {
  const [barcode, setBarcode] = useState("");
  const [, startTransition] = useTransition();
  const nextKey = () => Math.max(0, ...lines.map((l) => l.key)) + 1;
  const setLine = (key: number, patch: Partial<BuybackLine>) => setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  function addSoldPiece(e: React.FormEvent) {
    e.preventDefault();
    const code = barcode.trim();
    if (!code) return;
    setBarcode("");
    startTransition(async () => {
      const r = await findSoldPieceAction(code);
      if (!r.success) return onError(r.message);
      const p = r.data;
      if (lines.some((l) => l.inventoryId === p.id)) return;
      setLines((ls) => [
        ...ls.filter((l) => l.inventoryId || l.name || l.grossWeight),
        {
          ...emptyBuybackLine(nextKey()),
          inventoryId: p.id,
          label: `${p.barcode} · ${p.name} (${p.purity_code})`,
          purityId: p.purity_id,
          grossWeight: p.gross_weight.replace(".", ","),
          stoneWeight: Number(p.stone_weight) > 0 ? p.stone_weight.replace(".", ",") : "",
        },
      ]);
      onError(null);
    });
  }

  return (
    <div className="space-y-4">
      <form autoComplete="off" onSubmit={addSoldPiece} className={card}>
        <input autoComplete="off" value={barcode} onChange={(e) => setBarcode(e.target.value)} placeholder="Scan barcode barang yang dulu dibeli di toko ini (opsional)" className={`${cell} font-mono`} />
      </form>

      {lines.map((l, i) => {
        const rate = rateOf(purities, l.purityId);
        const pv = previewBuybackLine(l.grossWeight, l.stoneWeight, l.pricePerGram || rate, l.deduction);
        const err = (f: string) => fieldErrors[`${f}.${i}`];
        return (
          <div key={l.key} className={card}>
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{l.inventoryId ? `Barang toko: ${l.label}` : `Barang lama ${i + 1}`}</p>
              {lines.length > 1 && (
                <button type="button" onClick={() => setLines((ls) => ls.filter((x) => x.key !== l.key))} className="text-sm text-error-500">
                  Hapus
                </button>
              )}
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              {!l.inventoryId && (
                <>
                  <label className="text-xs text-gray-500">
                    Nama barang
                    <input autoComplete="off" value={l.name} onChange={(e) => setLine(l.key, { name: e.target.value })} placeholder="Kalung rantai" className={cell} />
                    {err("name") && <span className="text-error-500">{err("name")}</span>}
                  </label>
                  <label className="text-xs text-gray-500">
                    Kategori
                    <select value={l.categoryId} onChange={(e) => setLine(l.key, { categoryId: e.target.value })} className={cell}>
                      <option value="">Pilih</option>
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                    {err("categoryId") && <span className="text-error-500">{err("categoryId")}</span>}
                  </label>
                  <label className="text-xs text-gray-500">
                    Kadar
                    <select value={l.purityId} onChange={(e) => setLine(l.key, { purityId: e.target.value })} className={cell}>
                      <option value="">Pilih</option>
                      {purities.map((p) => (
                        <option key={p.purity_id} value={p.purity_id} disabled={!p.buy_price}>
                          {p.code} {p.buy_price ? `— ${formatRupiah(p.buy_price)}/g` : "(harga belum diatur)"}
                        </option>
                      ))}
                    </select>
                    {err("purityId") && <span className="text-error-500">{err("purityId")}</span>}
                  </label>
                </>
              )}
              <label className="text-xs text-gray-500">
                Berat total (gram)
                <input autoComplete="off" value={l.grossWeight} onChange={(e) => setLine(l.key, { grossWeight: e.target.value })} inputMode="decimal" placeholder="3,21" className={cell} />
                {err("grossWeight") && <span className="text-error-500">{err("grossWeight")}</span>}
              </label>
              <label className="text-xs text-gray-500">
                Berat batu (gram)
                <input autoComplete="off" value={l.stoneWeight} onChange={(e) => setLine(l.key, { stoneWeight: e.target.value })} inputMode="decimal" placeholder="0" className={cell} />
              </label>
              <label className="text-xs text-gray-500">
                Harga / gram {canOverridePrice ? "" : "(maks. harga buyback)"}
                <RupiahInput value={l.pricePerGram} onValueChange={(v) => setLine(l.key, { pricePerGram: v })} placeholder={rate ? groupThousands(rate) : "-"} className={cell} />
              </label>
              <label className="text-xs text-gray-500">
                Potongan
                <RupiahInput value={l.deduction} onValueChange={(v) => setLine(l.key, { deduction: v })} placeholder="0" className={cell} />
              </label>
            </div>
            {pv && (
              <p className={`mt-3 text-sm ${pv.valid ? "text-gray-600 dark:text-gray-300" : "text-error-500"}`}>
                Bruto {formatRupiah(pv.gross)} − potongan = <span className="font-semibold">{formatRupiah(pv.net)}</span>
              </p>
            )}
          </div>
        );
      })}
      <button type="button" onClick={() => setLines((ls) => [...ls, emptyBuybackLine(nextKey())])} className="rounded-lg border border-gray-300 px-4 py-2 text-sm dark:border-gray-700 dark:text-gray-300">
        + Tambah barang
      </button>
    </div>
  );
}
