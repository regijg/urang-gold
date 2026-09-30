import type { Metadata } from "next";
import Link from "next/link";
import DataTable from "@/components/gold/DataTable";
import ListToolbar from "@/components/gold/ListToolbar";
import PageHeader from "@/components/gold/PageHeader";
import Pagination from "@/components/gold/Pagination";
import StatusBadge from "@/components/gold/StatusBadge";
import { formatGram, formatRupiah } from "@/lib/format";
import { parsePage } from "@/lib/validation/common";
import { requireAppSession } from "@/server/auth/session";
import { loadPage } from "@/server/page-guard";
import { categoryService } from "@/server/services/master-data.service";
import { goldRateService } from "@/server/services/gold-rate.service";
import { productService } from "@/server/services/product.service";
import type { ProductRow } from "@/server/repositories/product.repository";

export const metadata: Metadata = { title: "Produk | UrangGold" };

type Search = { q?: string; page?: string; category?: string; status?: string };

export default async function ProductsPage({ searchParams }: { searchParams: Promise<Search> }) {
  const { q, page, category, status } = await searchParams;
  const session = await requireAppSession();
  const canManage = session.permissions.includes("master_data.manage");
  const statusFilter = status === "active" || status === "inactive" ? status : undefined;

  const [data, categories] = await loadPage(() =>
    Promise.all([
      productService.list({ q, page: parsePage(page), categoryId: category, status: statusFilter }),
      categoryService.list({ pageSize: 500 }),
    ])
  );
  const prices = await loadPage(() => goldRateService.productPrices(data.rows.map((r) => r.id)));

  return (
    <>
      <PageHeader
        title="Produk"
        description="Master barang emas dan perhiasan."
        action={canManage ? { href: "/products/new", label: "Tambah Produk" } : null}
      />
      <ListToolbar
        q={q}
        placeholder="Cari nama atau SKU"
        filters={[
          {
            name: "category",
            value: category,
            allLabel: "Semua kategori",
            options: categories.rows.map((c) => ({ value: c.id, label: c.name })),
          },
          {
            name: "status",
            value: statusFilter,
            allLabel: "Semua status",
            options: [
              { value: "active", label: "Aktif" },
              { value: "inactive", label: "Nonaktif" },
            ],
          },
        ]}
      />
      <DataTable<ProductRow>
        rows={data.rows}
        rowKey={(r) => r.id}
        empty="Belum ada produk."
        columns={[
          {
            header: "Produk",
            cell: (r) => {
              return (
                <div className="flex items-center gap-3">
                  <div>
                    {canManage ? (
                      <Link href={`/products/${r.id}`} className="font-medium text-brand-500 hover:underline">{r.name}</Link>
                    ) : (
                      <span className="font-medium">{r.name}</span>
                    )}
                    <p className="font-mono text-xs text-gray-500 dark:text-gray-400">{r.sku}</p>
                  </div>
                </div>
              );
            },
          },
          { header: "Kategori", cell: (r) => r.category?.name ?? "-" },
          { header: "Kadar", cell: (r) => r.purity?.code ?? "-" },
          { header: "Berat", cell: (r) => formatGram(r.gross_weight), className: "text-right whitespace-nowrap" },
          { header: "Berat Emas", cell: (r) => formatGram(r.gold_weight), className: "text-right whitespace-nowrap" },
          {
            header: "Estimasi Harga",
            cell: (r) => {
              const price = prices.get(r.id);
              return price ? formatRupiah(price) : <span className="text-xs text-gray-400">Harga emas belum diatur</span>;
            },
            className: "text-right whitespace-nowrap",
          },
          { header: "Status", cell: (r) => <StatusBadge active={r.is_active} /> },
        ]}
      />
      <Pagination
        page={data.page}
        pageSize={data.pageSize}
        total={data.total}
        basePath="/products"
        params={{ q, category, status: statusFilter }}
      />
    </>
  );
}
