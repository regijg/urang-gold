"use client";

import React, { useEffect } from "react";

export default function PrintButton({ auto = false, label = "Cetak" }: { auto?: boolean; label?: string }) {
  useEffect(() => {
    if (auto) {
      const t = setTimeout(() => window.print(), 300);
      return () => clearTimeout(t);
    }
  }, [auto]);
  return (
    <button type="button" onClick={() => window.print()} className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white print:hidden">
      {label}
    </button>
  );
}
