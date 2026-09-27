import type { Metadata } from "next";
import Link from "next/link";
import DataTable from "@/components/gold/DataTable";
import ListToolbar from "@/components/gold/ListToolbar";
import PageHeader from "@/components/gold/PageHeader";
import Pagination from "@/components/gold/Pagination";
import { formatDateTime, formatGram } from "@/lib/format";
import { parsePage } from "@/lib/validation/common";
import { MOVEMENT_LABELS, STATUS_LABELS, isPieceStatus } from "@/lib/validation/inventory";
import { loadPage, requirePagePermission } from "@/server/page-guard";
import { inventoryService } from "@/server/services/inventory.service";
import type { MovementRow } from "@/server/repositories/inventory.repository";

export const metadata: Metadata = { title: "Riwayat Mutasi | GoldPOS" };

const statusText = (s: string | null) => (s && isPieceStatus(s) ? STATUS_LABELS[s] : "-");

export default async function MovementsPage({ searchParams }: { searchParams: Promise<{ type?: string; page?: string }> }) {
  const { type, page } = await searchParams;
  await requirePagePermission("inventory.view");
  const data = await loadPage(() => inventoryService.movements({ type, page: parsePage(page) }));

  return (
    <>
      <PageHeader title="Riwayat Mutasi" description="Audit trail semua perubahan stok." back={{ href: "/inventory", label: "Inventory" }} />
      <ListToolbar
        showSearch={false}
        filters={[{ name: "type", value: type, allLabel: "Semua jenis", options: Object.entries(MOVEMENT_LABELS).map(([value, label]) => ({ value, label })) }]}
      />
      <DataTable<MovementRow>
        rows={data.rows}
        rowKey={(r) => String(r.id)}
        empty="Belum ada mutasi."
        columns={[
          { header: "Waktu", cell: (r) => formatDateTime(r.created_at) },
          { header: "Jenis", cell: (r) => MOVEMENT_LABELS[r.movement_type] ?? r.movement_type },
          {
            header: "Barang",
            cell: (r) =>
              r.inventory ? (
                <Link href={`/inventory/${r.inventory.id}`} className="text-brand-500 hover:underline">
                  <span className="font-mono">{r.inventory.barcode}</span> · {r.inventory.name}
                </Link>
              ) : (
                "-"
              ),
          },
          { header: "Qty", cell: (r) => (r.quantity > 0 ? `+${r.quantity}` : r.quantity), className: "text-right" },
          { header: "Berat emas", cell: (r) => formatGram(r.weight), className: "text-right whitespace-nowrap" },
          { header: "Status", cell: (r) => `${statusText(r.from_status)} → ${statusText(r.to_status)}` },
          { header: "Catatan", cell: (r) => r.notes ?? "-" },
        ]}
      />
      <Pagination page={data.page} pageSize={data.pageSize} total={data.total} basePath="/inventory/movements" params={{ type }} />
    </>
  );
}
