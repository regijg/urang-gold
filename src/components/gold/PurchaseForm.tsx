"use client";

import Link from "next/link";
import React, { useState, useTransition } from "react";
import { formatRupiah } from "@/lib/format";
import { parseRupiah } from "@/lib/validation/common";
import { subRupiah, sumRupiah } from "@/lib/validation/sales";
import { createPurchaseAction } from "@/app/(admin)/purchases/actions";
import PaymentEditor, { type PaymentRow } from "./pos/PaymentEditor";

type Option = { value: string; label: string };
type Row = { key: number; productId: string; grossWeight: string; stoneWeight: string; serialNumber: string; costPrice: string; laborCost: string };
const emptyRow = (key: number): Row => ({ key, productId: "", grossWeight: "", stoneWeight: "", serialNumber: "", costPrice: "", laborCost: "" });
const cell =
  "h-10 w-full rounded-lg border bg-transparent px-3 text-sm text-gray-800 focus:border-brand-300 focus:outline-hidden dark:bg-gray-900 dark:text-white/90";
const card = "rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900";

export default function PurchaseForm({
  suppliers,
  products,
  stores,
  locations,
  today,
}: {
  suppliers: Option[];
  products: Option[];
  stores: Option[];
  locations: { id: string; store_id: string; code: string; name: string }[];
  today: string;
}) {
  const [head, setHead] = useState({ storeId: stores[0]?.value ?? "", locationId: "", supplierId: "", supplierInvoice: "", purchaseDate: today, notes: "" });
  const [rows, setRows] = useState<Row[]>([emptyRow(0)]);
  const [payments, setPayments] = useState<PaymentRow[]>([{ method: "BANK_TRANSFER", amount: "", reference: "" }]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [done, setDone] = useState<{ purchase_id: string; purchase_number: string; total: string } | null>(null);
  const [pending, startTransition] = useTransition();

  // display total only; the database computes the stored totals
  const total = sumRupiah(rows.flatMap((r) => [parseRupiah(r.costPrice) ?? "0", parseRupiah(r.laborCost) ?? "0"]));
  const paid = sumRupiah(payments.map((p) => p.amount || "0"));
  const setRow = (key: number, patch: Partial<Row>) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const nextKey = () => Math.max(0, ...rows.map((r) => r.key)) + 1;

  function submit() {
    setMessage(null);
    setErrors({});
    startTransition(async () => {
      const r = await createPurchaseAction({ ...head, items: rows, payments });
      if (r.success) setDone(r.data);
      else {
        setMessage(r.message);
        setErrors(r.fieldErrors ?? {});
      }
    });
  }

  if (done) {
    return (
      <div className={`${card} mx-auto max-w-lg text-center`}>
        <p className="text-sm text-success-600">Pembelian tersimpan, stok bertambah</p>
        <p className="mt-1 font-mono text-lg font-semibold text-gray-900 dark:text-white">{done.purchase_number}</p>
        <p className="mt-3 text-2xl font-bold text-gray-900 dark:text-white">{formatRupiah(done.total)}</p>
        <div className="mt-6 flex gap-2">
          <Link href={`/purchases/${done.purchase_id}`} className="flex-1 rounded-xl bg-brand-500 py-3 text-sm font-semibold text-white">
            Lihat & cetak label
          </Link>
          <button type="button" onClick={() => window.location.reload()} className="flex-1 rounded-xl border border-gray-300 py-3 text-sm dark:border-gray-700 dark:text-gray-300">
            Pembelian baru
          </button>
        </div>
      </div>
    );
  }

  const err = (k: string) => errors[k] && <p className="mt-0.5 text-xs text-error-500">{errors[k]}</p>;
  const border = (k: string) => (errors[k] ? "border-error-500" : "border-gray-300 dark:border-gray-700");

  return (
    <div className="space-y-5">
      <div className={card}>
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="text-xs text-gray-500">
            Supplier *
            <select value={head.supplierId} onChange={(e) => setHead({ ...head, supplierId: e.target.value })} className={`${cell} ${border("supplierId")}`}>
              <option value="">Pilih supplier</option>
              {suppliers.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
            {err("supplierId")}
          </label>
          <label className="text-xs text-gray-500">
            No. invoice supplier
            <input value={head.supplierInvoice} onChange={(e) => setHead({ ...head, supplierInvoice: e.target.value })} className={`${cell} ${border("supplierInvoice")}`} />
          </label>
          <label className="text-xs text-gray-500">
            Tanggal *
            <input type="date" max={today} value={head.purchaseDate} onChange={(e) => setHead({ ...head, purchaseDate: e.target.value })} className={`${cell} ${border("purchaseDate")}`} />
            {err("purchaseDate")}
          </label>
          <label className="text-xs text-gray-500">
            Outlet *
            <select value={head.storeId} onChange={(e) => setHead({ ...head, storeId: e.target.value, locationId: "" })} className={`${cell} ${border("storeId")}`}>
              {stores.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </label>
          <label className="text-xs text-gray-500">
            Lokasi / baki
            <select value={head.locationId} onChange={(e) => setHead({ ...head, locationId: e.target.value })} className={`${cell} border-gray-300 dark:border-gray-700`}>
              <option value="">Tanpa lokasi</option>
              {locations.filter((l) => l.store_id === head.storeId).map((l) => <option key={l.id} value={l.id}>{l.code} — {l.name}</option>)}
            </select>
          </label>
        </div>
      </div>

      <div className={card}>
        <p className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">Barang (satu baris = satu keping)</p>
        {errors.items && <p className="mb-2 text-sm text-error-500">{errors.items}</p>}
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500">
                <th className="px-1 py-2">Produk *</th>
                <th className="px-1 py-2">Berat (g) *</th>
                <th className="px-1 py-2">Batu (g)</th>
                <th className="px-1 py-2">No. seri</th>
                <th className="px-1 py-2">Harga modal *</th>
                <th className="px-1 py-2">Ongkos</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.key}>
                  <td className="min-w-48 px-1 py-1">
                    <select value={r.productId} onChange={(e) => setRow(r.key, { productId: e.target.value })} className={`${cell} ${border(`productId.${i}`)}`}>
                      <option value="">Pilih</option>
                      {products.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                    </select>
                    {err(`productId.${i}`)}
                  </td>
                  <td className="px-1 py-1"><input value={r.grossWeight} onChange={(e) => setRow(r.key, { grossWeight: e.target.value })} inputMode="decimal" className={`${cell} ${border(`grossWeight.${i}`)}`} />{err(`grossWeight.${i}`)}</td>
                  <td className="px-1 py-1"><input value={r.stoneWeight} onChange={(e) => setRow(r.key, { stoneWeight: e.target.value })} inputMode="decimal" placeholder="Ikuti produk" className={`${cell} ${border(`stoneWeight.${i}`)}`} /></td>
                  <td className="px-1 py-1"><input value={r.serialNumber} onChange={(e) => setRow(r.key, { serialNumber: e.target.value })} className={`${cell} border-gray-300 dark:border-gray-700`} /></td>
                  <td className="px-1 py-1"><input value={r.costPrice} onChange={(e) => setRow(r.key, { costPrice: e.target.value })} inputMode="numeric" className={`${cell} ${border(`costPrice.${i}`)}`} />{err(`costPrice.${i}`)}</td>
                  <td className="px-1 py-1"><input value={r.laborCost} onChange={(e) => setRow(r.key, { laborCost: e.target.value })} inputMode="numeric" className={`${cell} ${border(`laborCost.${i}`)}`} /></td>
                  <td className="px-1 py-1">
                    {rows.length > 1 && <button type="button" onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))} className="text-sm text-error-500">Hapus</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-3 flex gap-2">
          <button type="button" onClick={() => setRows((rs) => [...rs, emptyRow(nextKey())])} className="rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:text-gray-300">+ Tambah baris</button>
          <button type="button" onClick={() => { const last = rows[rows.length - 1]; setRows((rs) => [...rs, { ...last, key: nextKey(), serialNumber: "" }]); }} className="rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:text-gray-300">Duplikat baris terakhir</button>
        </div>
        <p className="mt-4 text-right text-lg font-semibold text-gray-900 dark:text-white">Total {formatRupiah(total)}</p>
      </div>

      <div className={card}>
        <p className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">Pembayaran ke supplier (opsional — bisa dilunasi nanti)</p>
        <PaymentEditor payments={payments} setPayments={setPayments} target={total} />
        <p className="mt-2 text-sm text-gray-500">Sisa hutang: {formatRupiah(subRupiah(total, paid).replace(/^-.*/, "0"))}</p>
        <input value={head.notes} onChange={(e) => setHead({ ...head, notes: e.target.value })} placeholder="Catatan" className={`${cell} mt-3 border-gray-300 dark:border-gray-700`} />
      </div>

      {message && <p className="rounded-lg bg-error-50 px-4 py-2 text-sm text-error-600">{message}</p>}
      <button type="button" onClick={submit} disabled={pending} className="rounded-xl bg-brand-500 px-6 py-3 font-semibold text-white disabled:opacity-50">
        {pending ? "Menyimpan..." : "Simpan Pembelian"}
      </button>
    </div>
  );
}
