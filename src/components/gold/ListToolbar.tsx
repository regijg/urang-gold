import React from "react";

type Option = { value: string; label: string };

type Props = {
  q?: string;
  placeholder?: string;
  filters?: { name: string; value?: string; options: Option[]; allLabel: string }[];
  showSearch?: boolean;
  /** extra params kept when the form is submitted (e.g. a location drill-down) */
  hidden?: Record<string, string | undefined>;
};

// Plain GET form: works without JavaScript and keeps filters in the URL.
export default function ListToolbar({ q, placeholder = "Cari...", filters = [], showSearch = true, hidden = {} }: Props) {
  const control =
    "h-11 rounded-lg border border-gray-300 bg-transparent px-4 text-sm text-gray-800 focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90";

  return (
    <form autoComplete="off" method="get" className="mb-4 flex flex-col gap-3 sm:flex-row">
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
      <button type="submit" className="h-11 rounded-lg border border-gray-300 px-5 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-white/5">
        {showSearch ? "Cari" : "Terapkan"}
      </button>
    </form>
  );
}
