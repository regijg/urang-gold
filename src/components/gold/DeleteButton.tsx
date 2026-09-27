"use client";

import React, { useState, useTransition } from "react";
import type { ActionResult } from "@/lib/action-result";

type Props = {
  action: () => Promise<ActionResult>;
  label?: string;
  confirmText: string;
};

// The server action re-checks permission; on success it redirects.
export default function DeleteButton({ action, label = "Hapus", confirmText }: Props) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-col items-start gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          if (!window.confirm(confirmText)) return;
          setError(null);
          startTransition(async () => {
            const result = await action();
            if (result && !result.success) setError(result.message);
          });
        }}
        className="rounded-lg border border-error-300 px-4 py-2.5 text-sm font-medium text-error-600 hover:bg-error-50 disabled:opacity-60 dark:border-error-500/40 dark:text-error-400 dark:hover:bg-error-500/10"
      >
        {pending ? "Menghapus..." : label}
      </button>
      {error && <p className="text-sm text-error-500">{error}</p>}
    </div>
  );
}
