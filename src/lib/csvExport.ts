// Lightweight CSV export — no external dependency. Values are stringified and
// double-quotes/commas/newlines are escaped per RFC 4180.
export function downloadCsv(filename: string, rows: Record<string, string | number | null | undefined>[]): void {
  if (rows.length === 0) return;

  const headers = Object.keys(rows[0]);
  const escape = (value: string | number | null | undefined): string => {
    const str = value === null || value === undefined ? "" : String(value);
    if (/[",\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
    return str;
  };

  const lines = [
    headers.join(","),
    ...rows.map((row) => headers.map((h) => escape(row[h])).join(",")),
  ];

  const blob = new Blob([`﻿${lines.join("\n")}`], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
