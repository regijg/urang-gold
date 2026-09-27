import DeleteButton from "@/components/gold/DeleteButton";
import PageHeader from "@/components/gold/PageHeader";
import ProductForm from "@/components/gold/master/ProductForm";
import { formatGram, formatRupiah } from "@/lib/format";
import { loadPage, requirePagePermission } from "@/server/page-guard";
import { loadProductFormOptions } from "@/server/services/product-options";
import { goldRateService } from "@/server/services/gold-rate.service";
import { productService } from "@/server/services/product.service";
import { deleteProductAction, saveProductAction } from "../actions";

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requirePagePermission("master_data.manage");
  const product = await loadPage(() => productService.get(id));
  const { categories, purities } = await loadPage(() => loadProductFormOptions(product));
  const quote = await loadPage(() => goldRateService.quoteProduct(id));

  return (
    <>
      <PageHeader
        title={product.name}
        description={`${product.sku} · Berat emas ${formatGram(product.gold_weight)}`}
        back={{ href: "/products", label: "Produk" }}
      />
      <div className="space-y-6">
        <div className="rounded-2xl border border-gray-200 bg-white p-5 text-sm dark:border-gray-800 dark:bg-gray-900">
          <p className="mb-3 font-semibold text-gray-900 dark:text-white">Estimasi harga jual (harga emas saat ini, berat standar)</p>
          {quote ? (
            <dl className="grid gap-2 sm:grid-cols-2">
              <div className="flex justify-between"><dt className="text-gray-500">Harga emas {product.purity?.code} / gram</dt><dd>{formatRupiah(quote.sell_rate)}</dd></div>
              <div className="flex justify-between"><dt className="text-gray-500">Nilai emas ({formatGram(product.gold_weight)})</dt><dd>{formatRupiah(quote.gold_value)}</dd></div>
              <div className="flex justify-between"><dt className="text-gray-500">Ongkos produksi</dt><dd>{formatRupiah(product.labor_cost)}</dd></div>
              <div className="flex justify-between"><dt className="text-gray-500">Harga batu</dt><dd>{formatRupiah(product.stone_price)}</dd></div>
              <div className="flex justify-between"><dt className="text-gray-500">Margin</dt><dd>{formatRupiah(product.margin_amount)}</dd></div>
              <div className="flex justify-between font-semibold text-gray-900 dark:text-white"><dt>Harga jual</dt><dd>{formatRupiah(quote.total)}</dd></div>
            </dl>
          ) : (
            <p className="text-gray-500">Harga emas untuk kadar {product.purity?.code} belum diatur.</p>
          )}
        </div>
        <ProductForm
          action={saveProductAction.bind(null, id)}
          categories={categories}
          purities={purities}
          initial={product}
        />
        <DeleteButton
          action={deleteProductAction.bind(null, id)}
          confirmText={`Hapus produk "${product.name}"? Produk yang sudah punya stok/transaksi tidak bisa dihapus.`}
        />
      </div>
    </>
  );
}
