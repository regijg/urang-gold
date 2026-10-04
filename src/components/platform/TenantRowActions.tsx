"use client";

import React, { useState, useTransition } from "react";
import { setTenantPlanAction, setTenantStatusAction } from "@/app/(platform)/platform/actions";
import { PLAN_LABELS, TENANT_PLANS, type TenantPlan, type TenantStatus } from "@/lib/validation/platform";

/** Plan select + suspend/activate button for one shop. */
export default function TenantRowActions({ id, name, status, plan }: { id: string; name: string; status: TenantStatus; plan: TenantPlan }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run(task: () => Promise<{ success: boolean; message: string }>) {
    setError(null);
    start(async () => {
      const r = await task();
      if (!r.success) setError(r.message);
    });
  }

  const suspending = status === "ACTIVE";

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <select
        value={plan}
        disabled={pending}
        aria-label={`Paket ${name}`}
        onChange={(e) => run(() => setTenantPlanAction(id, e.target.value))}
        className="h-9 rounded-lg border border-gray-300 bg-transparent px-2 text-sm text-gray-800 disabled:opacity-60 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
      >
        {TENANT_PLANS.map((p) => (
          <option key={p} value={p}>
            {PLAN_LABELS[p]}
          </option>
        ))}
      </select>
      {status !== "CLOSED" && (
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            const msg = suspending
              ? `Tangguhkan "${name}"? Semua pengguna toko ini langsung tidak bisa masuk sampai diaktifkan lagi.`
              : `Aktifkan kembali "${name}"?`;
            if (window.confirm(msg)) run(() => setTenantStatusAction(id, suspending ? "SUSPENDED" : "ACTIVE"));
          }}
          className={`h-9 rounded-lg border px-3 text-sm font-medium disabled:opacity-60 ${
            suspending
              ? "border-error-300 text-error-600 hover:bg-error-50 dark:border-error-500/40 dark:text-error-400 dark:hover:bg-error-500/10"
              : "border-success-300 text-success-700 hover:bg-success-50 dark:border-success-500/40 dark:text-success-400 dark:hover:bg-success-500/10"
          }`}
        >
          {pending ? "..." : suspending ? "Tangguhkan" : "Aktifkan"}
        </button>
      )}
      {error && <span className="w-full text-right text-xs text-error-500">{error}</span>}
    </div>
  );
}
