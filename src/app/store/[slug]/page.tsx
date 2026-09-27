import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { formatGram, formatRupiah } from "@/lib/format";
import { parsePage } from "@/lib/validation/common";
import { productPhotoUrl } from "@/lib/validation/image";
import { waLink } from "@/lib/whatsapp";
import { CATALOG_PAGE_SIZE, catalogService } from "@/server/services/catalog.service";

type Params = { params: Promise<{ slug: string }>; searchParams: Promise<{ category?: string; q?: string; page?: string }> };

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const store = await catalogService.store(slug);
  if (!store) return { title: "Katalog tidak ditemukan" };
  return { title: `${store.name} — Katalog Perhiasan`, description: `Katalog emas & perhiasan ${store.name}. Harga mengikuti harga emas hari ini.` };
}

// Public catalogue: store -> products -> WhatsApp. No cart, no checkout (not a marketplace).
export default async function CatalogPage({ params, searchParams }: Params) {
  const { slug } = await params;
  const sp = await searchParams;
  const store = await catalogService.store(slug);
  if (!store) notFound();
  const page = parsePage(sp.page);
  const { rows, total } = await catalogService.products(slug, { category: sp.category, q: sp.q, page });
  const pages = Math.max(1, Math.ceil(total / CATALOG_PAGE_SIZE));
  const href = (p: number) => {
    const q = new URLSearchParams(Object.entries({ category: sp.category, q: sp.q, page: p > 1 ? String(p) : undefined }).filter(([, v]) => v) as [string, string][]);
    return `/store/${slug}${q.toString() ? `?${q}` : ""}`;
  };
  const wa = store.whatsapp ?? store.phone;

  return (
    <main className="min-h-screen bg-gray-50 text-gray-900">
      <header className="bg-white shadow-sm">
        <div className="mx-auto max-w-6xl px-4 py-6">
          <h1 className="text-2xl font-bold">{store.name}</h1>
          <p className="text-sm text-gray-500">{store.tenant_name}{store.address ? ` · ${store.address}` : ""}</p>
          {wa && (
            <a href={waLink(wa, `Halo ${store.name}, saya ingin bertanya tentang perhiasan.`)} target="_blank" rel="noreferrer" className="mt-3 inline-block rounded-full bg-[#25D366] px-4 py-2 text-sm font-semibold text-white">
              Chat WhatsApp
            </a>
          )}
        </div>
        {store.rates.length > 0 && (
          <div className="border-t border-gray-100 bg-amber-50">
            <div className="mx-auto flex max-w-6xl flex-wrap gap-x-6 gap-y-1 px-4 py-3 text-sm">
              <span className="font-semibold text-amber-800">Harga emas hari ini (jual/gram):</span>
              {store.rates.map((r) => (
                <span key={r.code} className="text-amber-900">
                  {r.code} {formatRupiah(r.sell_price)}
                </span>
              ))}
            </div>
          </div>
        )}
      </header>

      <div className="mx-auto max-w-6xl px-4 py-6">
        <form autoComplete="off" method="get" className="mb-6 flex flex-col gap-3 sm:flex-row">
          <input autoComplete="off" type="search" name="q" defaultValue={sp.q} placeholder="Cari perhiasan" className="h-11 flex-1 rounded-lg border border-gray-300 bg-white px-4 text-sm" />
          <select name="category" defaultValue={sp.category ?? ""} className="h-11 rounded-lg border border-gray-300 bg-white px-3 text-sm">
            <option value="">Semua kategori</option>
            {store.categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <button type="submit" className="h-11 rounded-lg bg-gray-900 px-5 text-sm font-medium text-white">Cari</button>
        </form>

        {rows.length === 0 ? (
          <p className="py-16 text-center text-gray-500">Belum ada produk yang tersedia.</p>
        ) : (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
            {rows.map((p) => {
              const photo = productPhotoUrl(p.photo_path);
              const weight = p.min_weight === p.max_weight ? formatGram(p.min_weight) : `${formatGram(p.min_weight)} – ${formatGram(p.max_weight)}`;
              const price = p.min_price ? (p.min_price === p.max_price ? formatRupiah(p.min_price) : `mulai ${formatRupiah(p.min_price)}`) : "Hubungi kami";
              return (
                <article key={p.product_id} className="flex flex-col overflow-hidden rounded-2xl bg-white shadow-sm">
                  {photo ? (
                    // eslint-disable-next-line @next/next/no-img-element -- public storage images
                    <img src={photo} alt={p.name} className="aspect-square w-full object-cover" loading="lazy" />
                  ) : (
                    <div className="flex aspect-square w-full items-center justify-center bg-amber-50 text-4xl">💍</div>
                  )}
                  <div className="flex flex-1 flex-col p-3">
                    <p className="text-xs text-gray-500">{p.category_name} · {p.purity_code}</p>
                    <h2 className="mt-0.5 font-semibold leading-snug">{p.name}</h2>
                    <p className="mt-1 text-xs text-gray-500">{weight} · {p.stock_count} tersedia</p>
                    <p className="mt-2 font-bold text-amber-700">{price}</p>
                    {wa && (
                      <a
                        href={waLink(wa, `Halo ${store.name}, saya tertarik dengan ${p.name} (${p.sku}, ${p.purity_code}, ${weight}). Apakah masih tersedia?`)}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-3 rounded-lg bg-[#25D366] py-2 text-center text-sm font-semibold text-white"
                      >
                        Tanya via WhatsApp
                      </a>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}

        {pages > 1 && (
          <div className="mt-8 flex justify-center gap-3 text-sm">
            {page > 1 && <Link href={href(page - 1)} className="rounded-lg border border-gray-300 bg-white px-4 py-2">Sebelumnya</Link>}
            <span className="px-2 py-2 text-gray-500">Halaman {page} / {pages}</span>
            {page < pages && <Link href={href(page + 1)} className="rounded-lg border border-gray-300 bg-white px-4 py-2">Berikutnya</Link>}
          </div>
        )}
        <p className="mt-10 text-center text-xs text-gray-400">Harga dapat berubah mengikuti harga emas harian. Ketersediaan dikonfirmasi via WhatsApp.</p>
      </div>
    </main>
  );
}
