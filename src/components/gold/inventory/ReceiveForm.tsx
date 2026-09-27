"use client";

import Link from "next/link";
import React, { useActionState, useMemo, useRef, useState } from "react";
import type { ActionResult } from "@/lib/action-result";
import { formatGram, formatRupiah, groupThousands } from "@/lib/format";
import { parseDecimal } from "@/lib/validation/common";
import { FormAlert, FormCard, SubmitButton, fieldErrorsOf } from "../form";
import RupiahInput from "@/components/gold/RupiahInput";

export type ReceiveProduct = {
  id: string;
  sku: string;
  name: string;
  category: string;
  purity: string;
  gross_weight: string;
  stone_weight: string;
  cost_price: string;
  labor_cost: string;
  stone_price: string;
  margin_amount: string;
};

type Option = { value: string; label: string };
type Props = {
  action: (
    prev: ActionResult<{ items: { inventory_id: string; barcode: string }[] }> | null,
    formData: FormData
  ) => Promise<ActionResult<{ items: { inventory_id: string; barcode: string }[] }>>;
  products: ReceiveProduct[];
  stores: Option[];
  locations: { id: string; store_id: string; code: string; name: string }[];
  defaultProductId?: string;
};

type Row = { key: number; gross: string; stone: string; serial: string; cost: string };

const input =
  "w-full rounded-lg border bg-transparent px-3 text-gray-800 focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:bg-gray-900 dark:text-white/90";
const okBorder = "border-gray-300 dark:border-gray-700";
const errBorder = "border-error-500";
const MAX = 200;

function Step({ n, title, hint, children }: { n: number; title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-4 text-gray-800 dark:border-gray-800 dark:bg-gray-900 dark:text-white/90">
      <div className="mb-3 flex items-start gap-3">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-500 text-sm font-semibold text-white">{n}</span>
        <div>
          <h2 className="font-semibold text-gray-900 dark:text-white">{title}</h2>
          {hint && <p className="text-sm text-gray-500 dark:text-gray-400">{hint}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

/** display-only sum of gram strings (thousandths, no float error) */
function sumGrams(values: string[]): string {
  let milli = BigInt(0);
  for (const v of values) {
    const d = parseDecimal(v, 3);
    if (!d) continue;
    const [i, f = ""] = d.split(".");
    milli += BigInt(i + f.padEnd(3, "0"));
  }
  const s = milli.toString().padStart(4, "0");
  return `${s.slice(0, -3)}.${s.slice(-3)}`;
}

const newRow = (key: number): Row => ({ key, gross: "", stone: "", serial: "", cost: "" });

export default function ReceiveForm({ action, products, stores, locations, defaultProductId }: Props) {
  const [state, formAction] = useActionState(action, null);
  const errors = fieldErrorsOf(state);

  const [productId, setProductId] = useState(defaultProductId ?? "");
  const [search, setSearch] = useState("");
  const [storeId, setStoreId] = useState(stores[0]?.value ?? "");
  const [rows, setRows] = useState<Row[]>([newRow(0)]);
  const [nextKey, setNextKey] = useState(1);
  const [showDetail, setShowDetail] = useState(false);
  // keys of pieces whose weight is empty when the user tries to save
  const [missing, setMissing] = useState<Set<number>>(new Set());
  const weightRefs = useRef<(HTMLInputElement | null)[]>([]);

  const product = products.find((p) => p.id === productId);
  const matches = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return products.slice(0, 8);
    return products.filter((p) => `${p.sku} ${p.name} ${p.purity} ${p.category}`.toLowerCase().includes(q)).slice(0, 8);
  }, [products, search]);

  const filled = rows.filter((r) => r.gross.trim() !== "");
  const totalWeight = sumGrams(filled.map((r) => r.gross));

  if (state?.success) {
    const ids = state.data.items.map((i) => i.inventory_id).join(",");
    return (
      <FormCard>
        <div className="text-center">
          <p className="text-4xl">✅</p>
          <p className="mt-2 text-lg font-semibold text-gray-900 dark:text-white">{state.message}</p>
          <p className="mt-2 font-mono text-sm text-gray-600 dark:text-gray-300">{state.data.items.map((i) => i.barcode).join(", ")}</p>
          <p className="mt-1 text-sm text-gray-500">Cetak label lalu tempelkan ke setiap barang sesuai urutan.</p>
        </div>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link href={`/inventory/labels?ids=${ids}`} className="rounded-lg bg-brand-500 px-5 py-3 text-sm font-semibold text-white hover:bg-brand-600">
            Cetak Label Barcode
          </Link>
          {/* full reload resets the form state */}
          <button type="button" onClick={() => window.location.assign("/inventory/new")} className="rounded-lg border border-gray-300 px-5 py-3 text-sm font-medium text-gray-700 dark:border-gray-700 dark:text-gray-300">
            Input Barang Lain
          </button>
          <Link href="/inventory" className="rounded-lg border border-gray-300 px-5 py-3 text-sm font-medium text-gray-700 dark:border-gray-700 dark:text-gray-300">
            Lihat Stok
          </Link>
        </div>
      </FormCard>
    );
  }

  function setCount(n: number) {
    const count = Math.max(1, Math.min(MAX, n || 1));
    setRows((rs) => {
      if (count <= rs.length) return rs.slice(0, count);
      const extra = Array.from({ length: count - rs.length }, (_, i) => newRow(nextKey + i));
      return [...rs, ...extra];
    });
    setNextKey((k) => k + count);
  }

  const setRow = (key: number, patch: Partial<Row>) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  function onWeightKey(e: React.KeyboardEvent<HTMLInputElement>, i: number) {
    if (e.key !== "Enter") return;
    e.preventDefault(); // Enter = next piece, never submit by accident
    // last piece: stay put (adding an empty piece here would only block saving; use "+" for more)
    if (i < rows.length - 1) weightRefs.current[i + 1]?.focus();
  }

  return (
    <form autoComplete="off"
      action={formAction}
      onSubmit={(e) => {
        const empty = rows.filter((r) => r.gross.trim() === "");
        if (empty.length > 0) {
          e.preventDefault();
          setMissing(new Set(empty.map((r) => r.key)));
          weightRefs.current[rows.indexOf(empty[0])]?.focus();
        }
      }}
      className="space-y-5"
      noValidate
    >
      <FormAlert state={state} />

      <Step n={1} title="Barang apa yang masuk?" hint="Pilih produk (model barang). Data kadar, ongkos, dan margin diambil dari produk.">
        <input type="hidden" name="productId" value={productId} />
        {product ? (
          <div className="rounded-xl border border-brand-200 bg-brand-50 p-4 dark:border-brand-900 dark:bg-brand-500/10">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-gray-900 dark:text-white">{product.name}</p>
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  {product.sku} · {product.category} · Kadar {product.purity}
                </p>
              </div>
              <button type="button" onClick={() => setProductId("")} className="text-sm font-medium text-brand-600 hover:underline">
                Ganti
              </button>
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-3">
              <div><dt className="text-xs text-gray-500">Berat standar</dt><dd className="font-medium text-gray-800 dark:text-white/90">{formatGram(product.gross_weight)}</dd></div>
              <div><dt className="text-xs text-gray-500">Berat batu</dt><dd className="font-medium text-gray-800 dark:text-white/90">{formatGram(product.stone_weight)}</dd></div>
              <div><dt className="text-xs text-gray-500">Harga modal</dt><dd className="font-medium text-gray-800 dark:text-white/90">{formatRupiah(product.cost_price)}</dd></div>
              <div><dt className="text-xs text-gray-500">Ongkos</dt><dd className="font-medium text-gray-800 dark:text-white/90">{formatRupiah(product.labor_cost)}</dd></div>
              <div><dt className="text-xs text-gray-500">Harga batu</dt><dd className="font-medium text-gray-800 dark:text-white/90">{formatRupiah(product.stone_price)}</dd></div>
              <div><dt className="text-xs text-gray-500">Margin</dt><dd className="font-medium text-gray-800 dark:text-white/90">{formatRupiah(product.margin_amount)}</dd></div>
            </dl>
          </div>
        ) : (
          <div>
            <input autoComplete="off"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Ketik nama, SKU, atau kadar… mis. cincin 18k"
              className={`${input} ${errors.productId ? errBorder : okBorder} h-11 text-base`}
              autoFocus
            />
            {errors.productId && <p className="mt-1 text-sm text-error-500">{errors.productId}</p>}
            <ul className="mt-2 divide-y divide-gray-100 rounded-xl border border-gray-200 dark:divide-gray-800 dark:border-gray-800">
              {matches.length === 0 ? (
                <li className="p-4 text-sm text-gray-500">
                  Produk tidak ditemukan.{" "}
                  <Link href="/products/new" className="font-medium text-brand-500 hover:underline">
                    Buat produk baru
                  </Link>
                </li>
              ) : (
                matches.map((p) => (
                  <li key={p.id}>
                    <button type="button" onClick={() => setProductId(p.id)} className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-white/5">
                      <span>
                        <span className="block font-medium text-gray-900 dark:text-white">{p.name}</span>
                        <span className="text-xs text-gray-500">
                          {p.sku} · {p.category}
                        </span>
                      </span>
                      <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700 dark:bg-white/10 dark:text-gray-200">{p.purity}</span>
                    </button>
                  </li>
                ))
              )}
            </ul>
            <p className="mt-2 text-xs text-gray-500">
              Belum ada produknya?{" "}
              <Link href="/products/new" className="font-medium text-brand-500 hover:underline">
                Buat produk baru
              </Link>{" "}
              dulu, lalu kembali ke sini.
            </p>
          </div>
        )}
      </Step>

      <Step n={2} title="Disimpan di mana?" hint="Baki boleh dikosongkan jika belum diatur.">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-sm text-gray-600 dark:text-gray-400">
            Outlet
            <select name="storeId" value={storeId} onChange={(e) => setStoreId(e.target.value)} className={`${input} ${okBorder} mt-1 h-11 dark:bg-gray-900`}>
              {stores.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm text-gray-600 dark:text-gray-400">
            Lokasi / Baki
            <select name="locationId" defaultValue="" className={`${input} ${okBorder} mt-1 h-11 dark:bg-gray-900`}>
              <option value="">Tanpa lokasi</option>
              {locations
                .filter((l) => l.store_id === storeId)
                .map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.code} — {l.name}
                  </option>
                ))}
            </select>
          </label>
        </div>
      </Step>

      <Step n={3} title="Timbang setiap keping" hint="Satu kolom = satu barang fisik. Tekan Enter untuk lanjut ke keping berikutnya. Barcode dibuat otomatis.">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <span className="text-sm text-gray-600 dark:text-gray-400">Jumlah keping</span>
          <div className="flex items-center rounded-lg border border-gray-300 dark:border-gray-700">
            <button type="button" onClick={() => setCount(rows.length - 1)} className="h-10 w-10 text-lg" aria-label="Kurangi">−</button>
            <input autoComplete="off"
              value={rows.length}
              onChange={(e) => setCount(Number(e.target.value.replace(/\D/g, "")))}
              inputMode="numeric"
              className="h-10 w-14 border-x border-gray-300 bg-transparent text-center dark:border-gray-700"
              aria-label="Jumlah keping"
            />
            <button type="button" onClick={() => setCount(rows.length + 1)} className="h-10 w-10 text-lg" aria-label="Tambah">+</button>
          </div>
          <label className="ml-auto flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
            <input type="checkbox" checked={showDetail} onChange={(e) => setShowDetail(e.target.checked)} className="h-4 w-4 rounded border-gray-300" />
            Isi detail per keping (berat batu, no. seri, harga modal)
          </label>
        </div>
        {errors.items && <p className="mb-3 text-sm text-error-500">{errors.items}</p>}

        <div className={showDetail ? "space-y-3" : "grid gap-3 sm:grid-cols-2 lg:grid-cols-4"}>
          {rows.map((r, i) => {
            const err = (f: string) => errors[`${f}.${i}`];
            return (
              <div key={r.key} className="rounded-xl border border-gray-200 p-3 dark:border-gray-800">
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-xs font-medium text-gray-500">Keping {i + 1}</span>
                  {rows.length > 1 && (
                    <button type="button" onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))} className="text-xs text-error-500 hover:underline">
                      Hapus
                    </button>
                  )}
                </div>
                <div className={showDetail ? "grid gap-2 sm:grid-cols-4" : ""}>
                  <div>
                    <div className="relative">
                      <input autoComplete="off"
                        ref={(el) => {
                          weightRefs.current[i] = el;
                        }}
                        name="grossWeight"
                        value={r.gross}
                        onChange={(e) => {
                          setRow(r.key, { gross: e.target.value });
                          if (missing.has(r.key)) setMissing((m) => new Set([...m].filter((k) => k !== r.key)));
                        }}
                        onKeyDown={(e) => onWeightKey(e, i)}
                        inputMode="decimal"
                        placeholder="Ketik berat"
                        className={`${input} ${err("grossWeight") || missing.has(r.key) ? errBorder : okBorder} h-11 pr-14 text-lg font-semibold placeholder:text-sm placeholder:font-normal`}
                        aria-label={`Berat keping ${i + 1}`}
                      />
                      <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-gray-400">gram</span>
                    </div>
                    {missing.has(r.key) && <p className="mt-0.5 text-xs text-error-500">Berat belum diisi</p>}
                    {err("grossWeight") && <p className="mt-0.5 text-xs text-error-500">{err("grossWeight")}</p>}
                  </div>
                  {showDetail && (
                    <>
                      <input autoComplete="off"
                        name="stoneWeight"
                        value={r.stone}
                        onChange={(e) => setRow(r.key, { stone: e.target.value })}
                        inputMode="decimal"
                        placeholder={`Batu: ${product ? String(product.stone_weight).replace(".", ",") : "0"} g`}
                        className={`${input} ${err("stoneWeight") ? errBorder : okBorder} h-11`}
                        aria-label={`Berat batu keping ${i + 1}`}
                      />
                      <input autoComplete="off"
                        name="serialNumber"
                        value={r.serial}
                        onChange={(e) => setRow(r.key, { serial: e.target.value })}
                        placeholder="No. seri (opsional)"
                        className={`${input} ${okBorder} h-11`}
                        aria-label={`Nomor seri keping ${i + 1}`}
                      />
                      <RupiahInput
                        name="costPrice"
                        value={r.cost}
                        onValueChange={(v) => setRow(r.key, { cost: v })}
                        placeholder={product ? `Modal ${groupThousands(product.cost_price)}` : "Harga modal"}
                        className={`${input} ${err("costPrice") ? errBorder : okBorder} h-11`}
                        aria-label={`Harga modal keping ${i + 1}`}
                      />
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        {!showDetail && (
          <p className="mt-3 text-xs text-gray-500">Berat batu dan harga modal otomatis mengikuti data produk.</p>
        )}
      </Step>

      <section className="sticky bottom-0 z-10 rounded-2xl border border-gray-200 bg-white/95 p-4 text-gray-800 shadow-lg backdrop-blur dark:border-gray-800 dark:bg-gray-900/95 dark:text-white/90">
        <label className="text-sm text-gray-600 dark:text-gray-400">
          Catatan (opsional)
          <input autoComplete="off" name="notes" placeholder="mis. stok awal, barang titipan" className={`${input} ${okBorder} mt-1 h-11`} />
        </label>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-gray-600 dark:text-gray-300">
            <span className="font-semibold text-gray-900 dark:text-white">{filled.length}</span> dari {rows.length} keping terisi · total{" "}
            <span className="font-semibold text-gray-900 dark:text-white">{formatGram(totalWeight)}</span>
            {filled.length < rows.length && (
              <span className="block text-error-500">
                {rows.length - filled.length} keping belum diisi beratnya — isi atau kurangi jumlah keping.
              </span>
            )}
          </p>
          <SubmitButton>{`Simpan ${rows.length} Keping`}</SubmitButton>
        </div>
      </section>
    </form>
  );
}
