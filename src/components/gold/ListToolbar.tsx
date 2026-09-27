import React from "react";
import FilterForm from "./FilterForm";

type Option = { value: string; label: string };

type Props = {
  q?: string;
  placeholder?: string;
  filters?: { name: string; value?: string; options: Option[]; allLabel: string }[];
  showSearch?: boolean;
  /** extra params kept when the form is submitted (e.g. a location drill-down) */
  hidden?: Record<string, string | undefined>;
};

// Filters live in the URL; applied by client navigation (no full page reload).
export default function ListToolbar({ q, placeholder = "Cari...", filters = [], showSearch = true, hidden = {} }: Props) {
  const control =
    "h-11 rounded-lg border border-gray-300 bg-transparent px-4 text-sm text-gray-800 focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90";

  return (
    <FilterForm className="mb-4 flex flex-col gap-3 sm:flex-row">
      {Object.entries(hidden).map(([k, v]) => (v ? <input key={k} type="hidden" name={k} value={v} /> : null))}
      {showSearch && <input autoComplete="off" type="search" name="q" defaultValue={q} placeholder={placeholder} className={`${control} flex-1`} />}
      {filters.map((f) => (
        <select key={f.name} name={f.name} defaultValue={f.value ?? ""} className={`${control} ${showSearch ? "" : "flex-1"}`}>
          <option value="">{f.allLabel}</option>
          {f.options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      ))}
    </FilterForm>
  );
}
