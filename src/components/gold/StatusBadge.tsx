import React from "react";

export default function StatusBadge({ active }: { active: boolean }) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
        active
          ? "bg-success-50 text-success-600 dark:bg-success-500/15 dark:text-success-500"
          : "bg-gray-100 text-gray-600 dark:bg-white/5 dark:text-gray-400"
      }`}
    >
      {active ? "Aktif" : "Nonaktif"}
    </span>
  );
}
