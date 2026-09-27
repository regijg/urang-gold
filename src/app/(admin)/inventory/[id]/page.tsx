import Link from "next/link";
import DataTable from "@/components/gold/DataTable";
import PageHeader from "@/components/gold/PageHeader";
import PieceStatusBadge from "@/components/gold/PieceStatusBadge";
import { DetailsForm, StatusChangeForm, TransferForm } from "@/components/gold/inventory/PieceActions";
import { formatDateTime, formatGram, formatRupiah } from "@/lib/format";
import { MOVEMENT_LABELS, STATUS_LABELS, isPieceStatus } from "@/lib/validation/inventory";
import { requireAppSession } from "@/server/auth/session";
import { loadPage } from "@/server/page-guard";
import { inventoryService, locationService, storeService } from "@/server/services/inventory.service";
import type { MovementRow } from "@/server/repositories/inventory.repository";
import { changeStatusAction, transferOneAction, updateDetailsAction } from "../actions";

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-1.5">
      <dt className="text-gray-500">{label}</dt>
      <dd className="text-right text-gray-900 dark:text-white">{children}</dd>
    </div>
  );
}

export default async function InventoryItemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireAppSession();
  const can = (p: (typeof session.permissions)[number]) => session.permissions.includes(p);

  const [item, quote] = await loadPage(() => Promise.all([inventoryService.get(id), inventoryService.quote(id)]));
  const [movements, stores, locations] = await loadPage(() =>
    Promise.all([
      can("inventory.view") ? inventoryService.movements({ inventoryId: id }) : Promise.resolve(null),
      can("stock_transfer.manage") ? storeService.list({ activeOnly: true }) : Promise.resolve([]),
      can("stock_transfer.manage") ? locationService.list({ activeOnly: true }) : Promise.resolve([]),
    ])
  );
  const editable = !["SOLD", "MELTED"].includes(item.status);

  return (
    <>
      <PageHeader title={item.name} description={item.barcode} back={{ href: "/inventory", label: "Inventory" }} />
      <div className="mb-4 flex gap-4 text-sm">
        <Link href={`/inventory/labels?ids=${item.id}`} className="font-medium text-brand-500 hover:underline">Cetak label</Link>
        {item.product && <Link href={`/products/${item.product.id}`} className="font-medium text-brand-500 hover:underline">Produk {item.product.sku}</Link>}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <div className="rounded-2xl border border-gray-200 bg-white p-5 text-sm dark:border-gray-800 dark:bg-gray-900">
            <dl className="divide-y divide-gray-100 dark:divide-gray-800">
              <Row label="Status"><PieceStatusBadge status={item.status} /></Row>
              <Row label="Outlet / lokasi">{item.store?.name ?? "-"}{item.location ? ` · ${item.location.code}` : ""}</Row>
              <Row label="Kategori / kadar">{item.category?.name ?? "-"} · {item.purity?.code ?? "-"}</Row>
              <Row label="Berat total">{formatGram(item.gross_weight)}</Row>
              <Row label="Berat batu">{formatGram(item.stone_weight)}{item.stone_type ? ` (${item.stone_type})` : ""}</Row>
              <Row label="Berat emas">{formatGram(item.gold_weight)}</Row>
              <Row label="No. seri">{item.serial_number ?? "-"}</Row>
              {can("inventory.manage") && <Row label="Harga modal">{formatRupiah(item.cost_price)}</Row>}
              <Row label="Ongkos / batu / margin">
                {formatRupiah(item.labor_cost)} / {formatRupiah(item.stone_price)} / {formatRupiah(item.margin_amount)}
              </Row>
              <Row label="Harga jual saat ini">
                {quote ? <span className="font-semibold">{formatRupiah(quote.total)}</span> : <span className="text-gray-400">Harga emas belum diatur</span>}
              </Row>
              <Row label="Masuk">{formatDateTime(item.received_at)}</Row>
            </dl>
          </div>

          {movements && (
            <div>
              <h2 className="mb-3 text-base font-semibold text-gray-900 dark:text-white">Riwayat Mutasi</h2>
              <DataTable<MovementRow>
                rows={movements.rows}
                rowKey={(r) => String(r.id)}
                columns={[
                  { header: "Waktu", cell: (r) => formatDateTime(r.created_at) },
                  { header: "Jenis", cell: (r) => MOVEMENT_LABELS[r.movement_type] ?? r.movement_type },
                  {
                    header: "Status",
                    cell: (r) =>
                      `${r.from_status && isPieceStatus(r.from_status) ? STATUS_LABELS[r.from_status] : "-"} → ${
                        r.to_status && isPieceStatus(r.to_status) ? STATUS_LABELS[r.to_status] : "-"
                      }`,
                  },
                  { header: "Berat", cell: (r) => (r.before_weight && r.before_weight !== r.after_weight ? `${formatGram(r.before_weight)} → ${formatGram(r.after_weight)}` : formatGram(r.after_weight)) },
                  { header: "Catatan", cell: (r) => r.notes ?? "-" },
                ]}
              />
            </div>
          )}
        </div>

        <div className="space-y-6">
          {can("inventory.manage") && editable && <StatusChangeForm action={changeStatusAction.bind(null, id)} status={item.status} />}
          {can("stock_transfer.manage") && ["AVAILABLE", "BUYBACK", "DAMAGED"].includes(item.status) && (
            <TransferForm
              action={transferOneAction.bind(null, id)}
              stores={stores.map((s) => ({ value: s.id, label: s.name }))}
              locations={locations}
              currentStoreId={item.store_id}
            />
          )}
          {can("inventory.manage") && editable && <DetailsForm action={updateDetailsAction.bind(null, id)} item={item} />}
        </div>
      </div>
    </>
  );
}
