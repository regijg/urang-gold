import React from "react";

export type Column<T> = {
  header: React.ReactNode;
  /** needed when `header` is not a string */
  key?: string;
  cell: (row: T) => React.ReactNode;
  className?: string;
};

type Props<T> = {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  empty?: string;
};

export default function DataTable<T>({ columns, rows, rowKey, empty = "Belum ada data." }: Props<T>) {
  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="border-b border-gray-100 bg-gray-50 dark:border-gray-800 dark:bg-white/[0.02]">
            <tr>
              {columns.map((c) => (
                <th key={c.key ?? String(c.header)} className={`px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400 ${c.className ?? ""}`}>
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-10 text-center text-gray-500 dark:text-gray-400">
                  {empty}
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={rowKey(row)} className="hover:bg-gray-50 dark:hover:bg-white/[0.02]">
                  {columns.map((c) => (
                    <td key={c.key ?? String(c.header)} className={`px-4 py-3 text-gray-700 dark:text-gray-300 ${c.className ?? ""}`}>
                      {c.cell(row)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
