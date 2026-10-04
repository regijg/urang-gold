import Link from "next/link";
import React from "react";
import DataTable from "@/components/gold/DataTable";
import type { DateRange } from "@/lib/date-range";
import { formatDateOnly, formatDateTime, formatRupiah } from "@/lib/format";
import { PAYMENT_LABELS } from "@/lib/payments";
import {
  EXPENSE_STATUS_LABELS,
  ORDER_STATUS_LABELS,
  REPAIR_STATUS_LABELS,
  TRADE_IN_STATUS_LABELS,
  cashDifferenceLabel,
} from "@/lib/report-labels";
import { loadPage } from "@/server/page-guard";
import {
  REPORT_ROW_LIMIT,
  reportOpsService,
  type CashReportRow,
  type ExpenseReportRow,
  type OrderReportRow,
  type RepairReportRow,
  type TradeInReportRow,
} from "@/server/services/report-ops.service";

const SHOWN = 500;
const card = "rounded-2xl border border-gray-200 bg-white p-4 text-gray-800 dark:border-gray-800 dark:bg-gray-900 dark:text-white/90";
const link = "font-medium text-brand-500 hover:underline";

type Tone = "ok" | "warn" | "bad" | "muted";
const TONES: Record<Tone, string> = {
  ok: "bg-success-50 text-success-600 dark:bg-success-500/15 dark:text-success-500",
  warn: "bg-warning-50 text-warning-600 dark:bg-warning-500/15 dark:text-warning-400",
  bad: "bg-error-50 text-error-600 dark:bg-error-500/15 dark:text-error-400",
  muted: "bg-gray-100 text-gray-600 dark:bg-white/5 dark:text-gray-400",
};

function Pill({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  return <span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${TONES[tone]}`}>{children}</span>;
}

function Stats({ items }: { items: { label: string; value: string; hint?: string }[] }) {
  return (
    <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 print:grid-cols-4">
      {items.map((i) => (
        <div key={i.label} className={card}>
          <p className="text-sm text-gray-500 dark:text-gray-400">{i.label}</p>
          <p className="mt-1 text-xl font-bold text-gray-900 dark:text-white">{i.value}</p>
          {i.hint && <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{i.hint}</p>}
        </div>
      ))}
    </div>
  );
}

function Truncated({ total }: { total: number }) {
  if (total <= SHOWN) return null;
  return (
    <p className="mt-2 text-xs text-gray-500">
      Menampilkan {SHOWN} dari {total >= REPORT_ROW_LIMIT ? `${REPORT_ROW_LIMIT}+` : total} baris. Gunakan Export CSV untuk data lengkap.
    </p>
  );
}

const sum = (values: string[]) => values.reduce((a, v) => a + BigInt(v), BigInt(0)).toString();
const rupiah = (v: string) => (v.startsWith("-") ? `-${formatRupiah(v.slice(1))}` : formatRupiah(v));
const inRange = (iso: string | null, range: DateRange) => !!iso && Date.parse(iso) >= Date.parse(range.fromIso) && Date.parse(iso) < Date.parse(range.toIso);

// ---------------------------------------------------------------------------------- Biaya
export async function ExpensesTab({ range, store }: { range: DateRange; store?: string }) {
  const rows = await loadPage(() => reportOpsService.expenses(range, store));
  return <ExpensesView rows={rows} />;
}

export function ExpensesView({ rows }: { rows: ExpenseReportRow[] }) {
  const active = rows.filter((r) => r.status === "ACTIVE");
  const shown = rows.slice(0, SHOWN);
  return (
    <>
      <Stats
        items={[
          { label: "Total biaya (aktif)", value: formatRupiah(sum(active.map((r) => r.amount))) },
          { label: "Jumlah biaya", value: String(active.length) },
          { label: "Dibatalkan", value: String(rows.length - active.length) },
        ]}
      />
      <DataTable<ExpenseReportRow>
        rows={shown}
        rowKey={(r) => r.number}
        empty="Tidak ada biaya di periode ini."
        columns={[
          { header: "Tanggal", cell: (r) => <span className="whitespace-nowrap">{formatDateOnly(r.date)}</span> },
          {
            header: "Keterangan",
            cell: (r) => (
              <div className={r.status === "VOIDED" ? "text-gray-400 line-through" : ""}>
                <p className="text-gray-800 dark:text-white/90">{r.description}</p>
                <p className="text-xs text-gray-500">
                  {r.category}
                  {r.method ? ` · ${PAYMENT_LABELS[r.method] ?? r.method}` : ""}
                  {r.store ? ` · ${r.store}` : ""} · <span className="font-mono">{r.number}</span>
                </p>
                {r.status === "VOIDED" && <p className="text-xs text-error-500 no-underline">Dibatalkan: {r.void_reason}</p>}
              </div>
            ),
          },
          { header: "Nominal", cell: (r) => formatRupiah(r.amount), className: "text-right whitespace-nowrap font-medium" },
          { header: "Status", cell: (r) => <Pill tone={r.status === "ACTIVE" ? "ok" : "muted"}>{EXPENSE_STATUS_LABELS[r.status]}</Pill> },
        ]}
      />
      <Truncated total={rows.length} />
    </>
  );
}

// ---------------------------------------------------------------------------------- Kas Harian
export async function CashTab({ range, store }: { range: DateRange; store?: string }) {
  const rows = await loadPage(() => reportOpsService.cash(range, store));
  return <CashView rows={rows} />;
}

export function CashView({ rows }: { rows: CashReportRow[] }) {
  const closed = rows.filter((r) => r.status === "CLOSED" && r.difference !== null);
  const withDiff = closed.filter((r) => r.difference !== "0");
  const totalDiff = sum(closed.map((r) => r.difference as string));
  const shown = rows.slice(0, SHOWN);
  return (
    <>
      <Stats
        items={[
          { label: "Sesi kas", value: String(rows.length), hint: `${rows.filter((r) => r.status === "OPEN").length} masih terbuka` },
          { label: "Sesi dengan selisih", value: String(withDiff.length), hint: `dari ${closed.length} sesi yang sudah ditutup` },
          { label: "Total selisih", value: totalDiff === "0" ? "Cocok" : `${cashDifferenceLabel(totalDiff)} ${rupiah(totalDiff.replace("-", ""))}`, hint: "uang dihitung dikurangi seharusnya" },
        ]}
      />
      <DataTable<CashReportRow>
        rows={shown}
        rowKey={(r) => r.id}
        empty="Tidak ada sesi kas di periode ini."
        columns={[
          {
            header: "Sesi",
            cell: (r) => (
              <div>
                <Link href={`/cash/${r.id}`} className={`font-mono ${link}`}>
                  {r.number}
                </Link>
                <p className="text-xs text-gray-500">
                  {r.store}
                  {r.opened_by ? ` · ${r.opened_by}` : ""}
                </p>
              </div>
            ),
          },
          {
            header: "Buka / tutup",
            cell: (r) => (
              <p className="whitespace-nowrap text-xs text-gray-500">
                {formatDateTime(r.opened_at)}
                <br />
                {r.closed_at ? formatDateTime(r.closed_at) : <Pill tone="ok">Masih terbuka</Pill>}
              </p>
            ),
          },
          { header: "Modal awal", cell: (r) => formatRupiah(r.opening), className: "text-right whitespace-nowrap" },
          { header: "Seharusnya", cell: (r) => (r.expected === null ? "-" : formatRupiah(r.expected)), className: "text-right whitespace-nowrap" },
          { header: "Dihitung", cell: (r) => (r.counted === null ? "-" : formatRupiah(r.counted)), className: "text-right whitespace-nowrap" },
          {
            header: "Selisih",
            cell: (r) =>
              r.difference === null ? (
                "-"
              ) : r.difference === "0" ? (
                <Pill tone="ok">Cocok</Pill>
              ) : (
                <div className="text-right">
                  <Pill tone={r.difference.startsWith("-") ? "bad" : "warn"}>
                    {cashDifferenceLabel(r.difference)} {formatRupiah(r.difference.replace("-", ""))}
                  </Pill>
                  {r.notes && <p className="mt-1 max-w-48 text-xs text-gray-500">{r.notes}</p>}
                </div>
              ),
            className: "text-right",
          },
        ]}
      />
      <Truncated total={rows.length} />
    </>
  );
}

// ---------------------------------------------------------------------------------- Pesanan & DP
const ORDER_TONE: Record<string, Tone> = { OPEN: "warn", COMPLETED: "ok", CANCELLED: "muted" };

export async function OrdersTab({ range, store }: { range: DateRange; store?: string }) {
  const rows = await loadPage(() => reportOpsService.orders(range, store));
  return <OrdersView rows={rows} range={range} />;
}

export function OrdersView({ rows, range }: { rows: OrderReportRow[]; range: DateRange }) {
  const open = rows.filter((r) => r.status === "OPEN");
  const created = rows.filter((r) => inRange(r.created_at, range));
  // same rule as Laba/Rugi: a deposit is forfeited in the period the order is cancelled
  const cancelledNow = rows.filter((r) => r.status === "CANCELLED" && inRange(r.cancelled_at, range));
  const shown = rows.slice(0, SHOWN);
  return (
    <>
      <Stats
        items={[
          { label: "Pesanan berjalan", value: String(open.length), hint: `Sisa tagihan ${formatRupiah(sum(open.map((r) => r.outstanding)))}` },
          { label: "DP di pesanan berjalan", value: formatRupiah(sum(open.map((r) => r.paid))) },
          { label: "Pesanan dibuat di periode ini", value: String(created.length), hint: `${created.filter((r) => r.status === "COMPLETED").length} sudah selesai` },
          { label: "DP hangus (pendapatan)", value: formatRupiah(sum(cancelledNow.map((r) => r.forfeited))), hint: `${cancelledNow.length} pesanan dibatalkan` },
        ]}
      />
      <DataTable<OrderReportRow>
        rows={shown}
        rowKey={(r) => r.id}
        empty="Tidak ada pesanan di periode ini."
        columns={[
          {
            header: "Pesanan",
            cell: (r) => (
              <div>
                <Link href={`/orders/${r.id}`} className={`font-mono ${link}`}>
                  {r.number}
                </Link>
                <p className="text-xs text-gray-500">
                  {r.customer || "-"}
                  {r.store ? ` · ${r.store}` : ""}
                </p>
              </div>
            ),
          },
          { header: "Dibuat", cell: (r) => <span className="whitespace-nowrap text-xs text-gray-500">{formatDateTime(r.created_at)}</span> },
          { header: "Status", cell: (r) => <Pill tone={ORDER_TONE[r.status] ?? "muted"}>{ORDER_STATUS_LABELS[r.status] ?? r.status}</Pill> },
          { header: "Total", cell: (r) => formatRupiah(r.total), className: "text-right whitespace-nowrap" },
          { header: "DP dibayar", cell: (r) => formatRupiah(r.paid), className: "text-right whitespace-nowrap" },
          {
            header: "Sisa / hangus",
            cell: (r) =>
              r.status === "OPEN" ? (
                formatRupiah(r.outstanding)
              ) : r.status === "CANCELLED" ? (
                <span title={r.cancel_reason}>{`Hangus ${formatRupiah(r.forfeited)}`}</span>
              ) : (
                "-"
              ),
            className: "text-right whitespace-nowrap",
          },
          { header: "Rencana diambil", cell: (r) => (r.due_date ? formatDateOnly(r.due_date) : "-"), className: "whitespace-nowrap" },
        ]}
      />
      <Truncated total={rows.length} />
    </>
  );
}

// ---------------------------------------------------------------------------------- Servis
const REPAIR_TONE: Record<string, Tone> = { RECEIVED: "warn", IN_PROGRESS: "warn", READY: "ok", PICKED_UP: "muted", CANCELLED: "muted" };

export async function RepairsTab({ range, store }: { range: DateRange; store?: string }) {
  const rows = await loadPage(() => reportOpsService.repairs(range, store));
  return <RepairsView rows={rows} range={range} />;
}

export function RepairsView({ rows, range }: { rows: RepairReportRow[]; range: DateRange }) {
  const received = rows.filter((r) => inRange(r.created_at, range));
  const pickedUp = rows.filter((r) => r.status === "PICKED_UP" && inRange(r.picked_up_at, range));
  const pending = rows.filter((r) => ["RECEIVED", "IN_PROGRESS", "READY"].includes(r.status));
  const shown = rows.slice(0, SHOWN);
  return (
    <>
      <Stats
        items={[
          { label: "Servis diterima", value: String(received.length), hint: "di periode ini" },
          { label: "Belum diambil", value: String(pending.length), hint: `${pending.filter((r) => r.status === "READY").length} siap diambil` },
          { label: "Sudah diambil", value: String(pickedUp.length), hint: "di periode ini" },
          { label: "Pendapatan servis", value: formatRupiah(sum(pickedUp.map((r) => r.final ?? "0"))), hint: "biaya akhir servis yang diambil" },
        ]}
      />
      <DataTable<RepairReportRow>
        rows={shown}
        rowKey={(r) => r.id}
        empty="Tidak ada servis di periode ini."
        columns={[
          {
            header: "Servis",
            cell: (r) => (
              <div>
                <Link href={`/repairs/${r.id}`} className={`font-mono ${link}`}>
                  {r.number}
                </Link>
                <p className="text-xs text-gray-500">
                  {r.customer || "-"}
                  {r.store ? ` · ${r.store}` : ""}
                </p>
              </div>
            ),
          },
          {
            header: "Barang",
            cell: (r) => (
              <div>
                <p className="text-gray-800 dark:text-white/90">{r.item}</p>
                <p className="text-xs text-gray-500">{r.service}</p>
              </div>
            ),
          },
          { header: "Diterima", cell: (r) => <span className="whitespace-nowrap text-xs text-gray-500">{formatDateTime(r.created_at)}</span> },
          { header: "Status", cell: (r) => <Pill tone={REPAIR_TONE[r.status] ?? "muted"}>{REPAIR_STATUS_LABELS[r.status] ?? r.status}</Pill> },
          {
            header: "Biaya",
            cell: (r) =>
              r.final !== null ? (
                formatRupiah(r.final)
              ) : (
                <span className="text-gray-500" title="Perkiraan, biaya akhir belum diisi">
                  ~{formatRupiah(r.estimated)}
                </span>
              ),
            className: "text-right whitespace-nowrap",
          },
          { header: "Dibayar", cell: (r) => formatRupiah(r.paid), className: "text-right whitespace-nowrap" },
          { header: "Janji selesai", cell: (r) => (r.due_date ? formatDateOnly(r.due_date) : "-"), className: "whitespace-nowrap" },
        ]}
      />
      <Truncated total={rows.length} />
    </>
  );
}

// ---------------------------------------------------------------------------------- Tukar Tambah
export async function TradeInsTab({ range, store }: { range: DateRange; store?: string }) {
  const rows = await loadPage(() => reportOpsService.tradeIns(range, store));
  return <TradeInsView rows={rows} />;
}

export function TradeInsView({ rows }: { rows: TradeInReportRow[] }) {
  const done = rows.filter((r) => r.status === "COMPLETED");
  const shown = rows.slice(0, SHOWN);
  return (
    <>
      <Stats
        items={[
          { label: "Transaksi tukar tambah", value: String(done.length), hint: rows.length > done.length ? `${rows.length - done.length} dibatalkan` : undefined },
          { label: "Nilai barang lama", value: formatRupiah(sum(done.map((r) => r.trade_in_value))), hint: "dibeli toko dari customer" },
          { label: "Harga barang baru", value: formatRupiah(sum(done.map((r) => r.sale_total))), hint: "dijual toko ke customer" },
          { label: "Selisih diterima", value: rupiah(sum(done.map((r) => r.balance))), hint: "dibayar customer (minus = toko membayar)" },
        ]}
      />
      <DataTable<TradeInReportRow>
        rows={shown}
        rowKey={(r) => r.id}
        empty="Tidak ada tukar tambah di periode ini."
        columns={[
          {
            header: "Tukar tambah",
            cell: (r) => (
              <div className={r.status === "VOIDED" ? "text-gray-400 line-through" : ""}>
                <Link href={`/trade-ins/${r.id}`} className={`font-mono ${link}`}>
                  {r.number}
                </Link>
                <p className="text-xs text-gray-500">
                  {r.customer || "-"}
                  {r.store ? ` · ${r.store}` : ""}
                </p>
              </div>
            ),
          },
          { header: "Waktu", cell: (r) => <span className="whitespace-nowrap text-xs text-gray-500">{formatDateTime(r.created_at)}</span> },
          { header: "Barang lama", cell: (r) => formatRupiah(r.trade_in_value), className: "text-right whitespace-nowrap" },
          { header: "Barang baru", cell: (r) => formatRupiah(r.sale_total), className: "text-right whitespace-nowrap" },
          { header: "Selisih", cell: (r) => rupiah(r.balance), className: "text-right whitespace-nowrap font-medium" },
          {
            header: "Status",
            cell: (r) => (
              <span title={r.void_reason}>
                <Pill tone={r.status === "COMPLETED" ? "ok" : "muted"}>{TRADE_IN_STATUS_LABELS[r.status]}</Pill>
              </span>
            ),
          },
        ]}
      />
      <Truncated total={rows.length} />
    </>
  );
}

