import type { Metadata } from "next";
import DataTable from "@/components/gold/DataTable";
import { ExpenseForm, VoidExpenseButton } from "@/components/gold/ExpenseForms";
import ListToolbar from "@/components/gold/ListToolbar";
import PageHeader from "@/components/gold/PageHeader";
import Pagination from "@/components/gold/Pagination";
import RangeFilter from "@/components/gold/RangeFilter";
import { resolveRange, todayWib } from "@/lib/date-range";
import { formatDateOnly, formatRupiah } from "@/lib/format";
import { PAYMENT_LABELS } from "@/lib/payments";
import { parsePage } from "@/lib/validation/common";
import { EXPENSE_CATEGORIES, EXPENSE_LABELS } from "@/lib/validation/operations";
import { loadPage, requirePagePermission } from "@/server/page-guard";
import { expenseService, type ExpenseRow } from "@/server/services/expense.service";
import { storeService } from "@/server/services/inventory.service";
import { createExpenseAction, voidExpenseAction } from "./actions";

export const metadata: Metadata = { title: "Biaya Operasional | UrangGold" };

type Search = { range?: string; from?: string; to?: string; category?: string; page?: string };

export default async function ExpensesPage({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  await requirePagePermission("expenses.manage");
  // expenses are usually reviewed per month
  const range = resolveRange({ range: sp.range ?? "month", from: sp.from, to: sp.to });
  const [stores, data] = await loadPage(() =>
    Promise.all([
      storeService.list({ activeOnly: true }),
      expenseService.list({ page: parsePage(sp.page), category: sp.category, from: range.fromDate, to: range.toDate }),
    ])
  );

  return (
    <>
      <PageHeader title="Biaya Operasional" description="Gaji, listrik, sewa, dan pengeluaran toko lainnya. Masuk ke laporan laba bersih." />
      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="order-2 lg:order-1">
          <RangeFilter range={range} hidden={{ category: sp.category }} />
          <ListToolbar
            showSearch={false}
            hidden={{ range: range.preset, from: sp.from, to: sp.to }}
            filters={[{ name: "category", value: sp.category, allLabel: "Semua kategori", options: EXPENSE_CATEGORIES.map((c) => ({ value: c, label: EXPENSE_LABELS[c] })) }]}
          />
          <div className="mb-4 rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
            <p className="text-sm text-gray-500">Total biaya periode ini</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{formatRupiah(data.sum)}</p>
          </div>
          <DataTable<ExpenseRow>
            rows={data.rows}
            rowKey={(r) => r.id}
            empty="Belum ada biaya di periode ini."
            columns={[
              { header: "Tanggal", cell: (r) => <span className="whitespace-nowrap">{formatDateOnly(r.expense_date)}</span> },
              {
                header: "Keterangan",
                cell: (r) => (
                  <div className={r.status === "VOIDED" ? "text-gray-400 line-through" : ""}>
                    <p className="text-gray-800 dark:text-white/90">{r.description}</p>
                    <p className="text-xs text-gray-500">
                      {EXPENSE_LABELS[r.category]} · {r.payment ? PAYMENT_LABELS[r.payment.method] ?? r.payment.method : "-"}
                      {stores.length > 1 && r.store ? ` · ${r.store.name}` : ""}
                    </p>
                    {r.status === "VOIDED" && <p className="text-xs text-error-500 no-underline">Dibatalkan: {r.void_reason}</p>}
                  </div>
                ),
              },
              { header: "Nominal", cell: (r) => formatRupiah(r.amount), className: "text-right whitespace-nowrap font-medium" },
              { key: "act", header: "", cell: (r) => (r.status === "ACTIVE" ? <VoidExpenseButton action={voidExpenseAction.bind(null, r.id)} /> : null), className: "text-right" },
            ]}
          />
          <Pagination
            page={data.page}
            pageSize={data.pageSize}
            total={data.total}
            basePath="/expenses"
            params={{ range: range.preset, from: sp.from, to: sp.to, category: sp.category }}
          />
        </div>
        <div className="order-1 lg:order-2">
          <ExpenseForm action={createExpenseAction} stores={stores.map((s) => ({ value: s.id, label: s.name }))} today={todayWib()} />
        </div>
      </div>
    </>
  );
}
