import React from "react";
import type { DateRange } from "@/lib/date-range";

const PRESETS = [
  { value: "today", label: "Hari ini" },
  { value: "7d", label: "7 hari" },
  { value: "30d", label: "30 hari" },
  { value: "month", label: "Bulan ini" },
  { value: "custom", label: "Rentang tanggal" },
];

const control = "h-10 rounded-lg border border-gray-300 bg-transparent px-3 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white";

/** GET form: range preset + optional custom dates + store. Works without JS. */
export default function RangeFilter({
  range,
  stores,
  store,
  hidden = {},
}: {
  range: DateRange;
  stores?: { id: string; name: string }[];
  store?: string;
  hidden?: Record<string, string | undefined>;
}) {
  return (
    <form autoComplete="off" method="get" className="mb-5 flex flex-wrap items-end gap-2 print:hidden">
      {Object.entries(hidden).map(([k, v]) => (v ? <input key={k} type="hidden" name={k} value={v} /> : null))}
      <select name="range" defaultValue={range.preset} className={control}>
        {PRESETS.map((p) => (
          <option key={p.value} value={p.value}>
            {p.label}
          </option>
        ))}
      </select>
      <input autoComplete="off" type="date" name="from" defaultValue={range.fromDate} className={control} aria-label="Dari tanggal" />
      <input autoComplete="off" type="date" name="to" defaultValue={range.toDate} className={control} aria-label="Sampai tanggal" />
      {stores && stores.length > 1 && (
        <select name="store" defaultValue={store ?? ""} className={control}>
          <option value="">Semua outlet</option>
          {stores.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      )}
      <button type="submit" className="h-10 rounded-lg bg-brand-500 px-4 text-sm font-medium text-white">
        Terapkan
      </button>
      <span className="text-xs text-gray-500">
        {range.fromDate === range.toDate ? range.fromDate : `${range.fromDate} s/d ${range.toDate}`} (WIB)
      </span>
    </form>
  );
}
