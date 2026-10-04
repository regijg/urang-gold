import React from "react";
import DataTable from "@/components/gold/DataTable";
import TenantRowActions from "@/components/platform/TenantRowActions";
import { formatDateOnly, formatDateTime, formatRupiah } from "@/lib/format";
import { PLAN_LABELS, STATUS_LABELS, type TenantStatus } from "@/lib/validation/platform";
import type { PlatformTenant } from "@/server/services/platform.service";

const STATUS_STYLE: Record<TenantStatus, string> = {
  ACTIVE: "bg-success-50 text-success-600 dark:bg-success-500/15 dark:text-success-500",
  SUSPENDED: "bg-warning-50 text-warning-600 dark:bg-warning-500/15 dark:text-warning-400",
  CLOSED: "bg-gray-100 text-gray-600 dark:bg-white/5 dark:text-gray-400",
};

export default function TenantTable({ tenants }: { tenants: PlatformTenant[] }) {
  return (
      <DataTable<PlatformTenant>
        rows={tenants}
        rowKey={(t) => t.id}
        empty="Belum ada toko. Buat toko pertama dengan tombol + Toko Baru."
        columns={[
          {
            header: "Toko",
            cell: (t) => (
              <div>
                <p className="font-medium text-gray-900 dark:text-white">{t.name}</p>
                <p className="text-xs text-gray-500">{t.owner_email ?? "-"}</p>
                <p className="text-xs text-gray-400">Sejak {formatDateOnly(t.created_at.slice(0, 10))}</p>
              </div>
            ),
          },
          {
            header: "Status",
            cell: (t) => (
              <div className="flex flex-col items-start gap-1">
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLE[t.status]}`}>{STATUS_LABELS[t.status]}</span>
                <span className="text-xs text-gray-500">Paket {PLAN_LABELS[t.plan]}</span>
              </div>
            ),
          },
          {
            header: "Pemakaian",
            cell: (t) => (
              <p className="whitespace-nowrap text-xs text-gray-500">
                {t.store_count} outlet · {t.user_count} pengguna
                <br />
                {t.sales_count_month} transaksi bulan ini
                <br />
                Terakhir jual: {t.last_sale_at ? formatDateTime(t.last_sale_at) : "belum pernah"}
              </p>
            ),
          },
          {
            header: "Omzet",
            cell: (t) => (
              <p className="whitespace-nowrap text-xs text-gray-500">
                Hari ini {formatRupiah(t.sales_today)}
                <br />
                Bulan ini {formatRupiah(t.sales_month)}
                <br />
                Total {formatRupiah(t.sales_total)}
              </p>
            ),
            className: "text-right",
          },
          { key: "act", header: "", cell: (t) => <TenantRowActions id={t.id} name={t.name} status={t.status} plan={t.plan} />, className: "text-right" },
        ]}
      />
  );
}
