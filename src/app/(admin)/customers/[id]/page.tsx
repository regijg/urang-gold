import Link from "next/link";
import DataTable from "@/components/gold/DataTable";
import DeleteButton from "@/components/gold/DeleteButton";
import PageHeader from "@/components/gold/PageHeader";
import ContactForm from "@/components/gold/master/ContactForm";
import { loadPage, requirePagePermission } from "@/server/page-guard";
import { formatDateTime, formatRupiah } from "@/lib/format";
import { customerHistory, type CustomerTx } from "@/server/services/customer-history.service";
import { customerService } from "@/server/services/master-data.service";
import { deleteCustomerAction, saveCustomerAction } from "../actions";

const KIND: Record<CustomerTx["kind"], string> = { SALE: "Penjualan", BUYBACK: "Buyback", TRADE_IN: "Tukar tambah" };

export default async function EditCustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requirePagePermission("customers.manage");
  const [customer, history] = await loadPage(() => Promise.all([customerService.get(id), customerHistory(id)]));

  return (
    <>
      <PageHeader title={`Ubah Customer: ${customer.name}`} back={{ href: "/customers", label: "Customer" }} />
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900"><p className="text-xs text-gray-500">Total transaksi</p><p className="text-lg font-semibold dark:text-white">{history.rows.length}</p></div>
          <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900"><p className="text-xs text-gray-500">Total pembelian</p><p className="text-lg font-semibold dark:text-white">{formatRupiah(history.salesTotal)}</p></div>
          <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900"><p className="text-xs text-gray-500">Total buyback</p><p className="text-lg font-semibold dark:text-white">{formatRupiah(history.buybackTotal)}</p></div>
        </div>
        <DataTable<CustomerTx>
          rows={history.rows}
          rowKey={(r) => `${r.kind}-${r.id}`}
          empty="Belum ada transaksi."
          columns={[
            { header: "Waktu", cell: (r) => formatDateTime(r.at) },
            { header: "Jenis", cell: (r) => KIND[r.kind] },
            { header: "Nomor", cell: (r) => <Link href={r.href} className="font-mono text-brand-500 hover:underline">{r.number}</Link> },
            { header: "Nilai", cell: (r) => formatRupiah(r.total), className: "text-right" },
            { header: "Status", cell: (r) => (r.status === "VOIDED" ? "Dibatalkan" : "Selesai") },
          ]}
        />
        <ContactForm kind="customer" action={saveCustomerAction.bind(null, id)} initial={customer} />
        <DeleteButton
          action={deleteCustomerAction.bind(null, id)}
          confirmText={`Hapus customer "${customer.name}"? Customer yang sudah punya transaksi tidak bisa dihapus.`}
        />
      </div>
    </>
  );
}
