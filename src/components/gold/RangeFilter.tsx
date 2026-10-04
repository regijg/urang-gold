"use client";

import React, { useEffect, useRef, useState } from "react";
import { todayWib, type DateRange, type RangePreset } from "@/lib/date-range";
import FilterForm from "./FilterForm";
import DateRangeInput from "./DateRangeInput";

const PRESETS: { value: RangePreset; label: string }[] = [
  { value: "today", label: "Hari ini" },
  { value: "7d", label: "7 hari" },
  { value: "30d", label: "30 hari" },
  { value: "month", label: "Bulan ini" },
  { value: "custom", label: "Rentang tanggal" },
];

const control = "h-10 rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-800 dark:border-gray-700 dark:bg-gray-900 dark:text-white";

/**
 * Range preset buttons + store, applied without a page reload. The calendar only shows under
 * "Rentang tanggal" and picks start → end in one go, so the end can't precede the start.
 */
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
  const [preset, setPreset] = useState<RangePreset>(range.preset);
  const [from, setFrom] = useState(range.fromDate);
  const [to, setTo] = useState(range.toDate);
  const [openPicker, setOpenPicker] = useState(false);
  const [submitTick, setSubmitTick] = useState(0);
  const anchor = useRef<HTMLDivElement>(null);

  // follow what the server resolved (e.g. an invalid custom range falls back to today)
  useEffect(() => {
    setPreset(range.preset);
    setFrom(range.fromDate);
    setTo(range.toDate);
  }, [range.preset, range.fromDate, range.toDate]);

  // submit after the hidden inputs carry the new state
  useEffect(() => {
    if (submitTick) anchor.current?.closest("form")?.requestSubmit();
  }, [submitTick]);

  function choose(p: RangePreset) {
    setPreset(p);
    if (p === "custom") setOpenPicker(true);
    else setSubmitTick((n) => n + 1);
  }

  return (
    <FilterForm className="mb-5 flex flex-wrap items-center gap-2 print:hidden">
      {Object.entries(hidden).map(([k, v]) => (v ? <input key={k} type="hidden" name={k} value={v} /> : null))}
      <input type="hidden" name="range" value={preset} />
      {preset === "custom" && (
        <>
          <input type="hidden" name="from" value={from} />
          <input type="hidden" name="to" value={to} />
        </>
      )}

      <div ref={anchor} role="group" aria-label="Periode" className="no-scrollbar flex max-w-full gap-1 overflow-x-auto rounded-lg border border-gray-200 bg-gray-50 p-1 dark:border-gray-800 dark:bg-gray-900">
        {PRESETS.map((p) => {
          const active = preset === p.value;
          return (
            <button
              key={p.value}
              type="button"
              aria-pressed={active}
              onClick={() => choose(p.value)}
              className={`shrink-0 whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                active
                  ? "bg-white text-brand-600 shadow-theme-xs dark:bg-gray-800 dark:text-white"
                  : "text-gray-600 hover:bg-white/70 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800/60 dark:hover:text-white"
              }`}
            >
              {p.label}
            </button>
          );
        })}
      </div>

      {preset === "custom" && (
        <div className="w-full sm:w-auto">
          <DateRangeInput
            from={from}
            to={to}
            max={todayWib()}
            autoOpen={openPicker}
            aria-label="Rentang tanggal"
            className={`${control} w-full sm:w-[17rem]`}
            onChange={(f, t) => {
              setFrom(f);
              setTo(t);
              setSubmitTick((n) => n + 1);
            }}
          />
        </div>
      )}

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
    </FilterForm>
  );
}
