"use client";

import { useSearchParams } from "next/navigation";
import React, { useEffect, useRef, useState } from "react";

// Row checkboxes are rendered by the (server) table as <input form={LABEL_FORM} name="ids">;
// these client pieces only count them, toggle them all, and submit to the label page.
export const LABEL_FORM = "label-print";
const boxes = () => Array.from(document.querySelectorAll<HTMLInputElement>(`input[form="${LABEL_FORM}"][name="ids"]`));

function useSelectedCount() {
  const [count, setCount] = useState(0);
  const search = useSearchParams().toString(); // rows are replaced when filters/page change
  useEffect(() => {
    const update = () => setCount(boxes().filter((b) => b.checked).length);
    update();
    const onChange = (e: Event) => {
      if ((e.target as HTMLInputElement)?.getAttribute?.("form") === LABEL_FORM) update();
    };
    document.addEventListener("change", onChange);
    return () => document.removeEventListener("change", onChange);
  }, [search]);
  return count;
}

export function LabelRowCheckbox({ id, label }: { id: string; label: string }) {
  return <input type="checkbox" name="ids" value={id} form={LABEL_FORM} aria-label={`Pilih ${label}`} className="h-4 w-4 accent-brand-500" />;
}

export function LabelSelectAll() {
  const ref = useRef<HTMLInputElement>(null);
  const count = useSelectedCount();
  useEffect(() => {
    const total = boxes().length;
    if (ref.current) {
      ref.current.checked = total > 0 && count === total;
      ref.current.indeterminate = count > 0 && count < total;
    }
  }, [count]);
  return (
    <input
      ref={ref}
      type="checkbox"
      aria-label="Pilih semua di halaman ini"
      className="h-4 w-4 accent-brand-500"
      onChange={(e) => {
        const on = e.target.checked;
        boxes().forEach((b) => (b.checked = on));
        // recount through a row event (the listener only reacts to label checkboxes)
        boxes()[0]?.dispatchEvent(new Event("change", { bubbles: true }));
      }}
    />
  );
}

export function LabelPrintBar() {
  const count = useSelectedCount();
  if (count === 0) return <form id={LABEL_FORM} action="/inventory/labels" method="get" target="_blank" className="hidden" />;
  return (
    <form id={LABEL_FORM} action="/inventory/labels" method="get" target="_blank" className="sticky bottom-3 z-20 mt-3 flex items-center justify-between gap-3 rounded-xl border border-brand-200 bg-white px-4 py-2.5 shadow-lg dark:border-brand-500/30 dark:bg-gray-900">
      <span className="text-sm text-gray-700 dark:text-gray-300">{count} barang dipilih</span>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => {
            boxes().forEach((b) => (b.checked = false));
            boxes()[0]?.dispatchEvent(new Event("change", { bubbles: true }));
          }}
          className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 dark:border-gray-700 dark:text-gray-300"
        >
          Batal
        </button>
        <button type="submit" className="rounded-lg bg-brand-500 px-4 py-1.5 text-sm font-semibold text-white hover:bg-brand-600">
          Cetak label ({count})
        </button>
      </div>
    </form>
  );
}
