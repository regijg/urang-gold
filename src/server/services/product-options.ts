import { categoryService, purityService } from "@/server/services/master-data.service";

type Option = { value: string; label: string };

/**
 * Active categories/purities for the product form. The currently selected
 * (possibly inactive) one is kept so editing an old product doesn't lose it.
 */
export async function loadProductFormOptions(current?: {
  category: { id: string; code: string; name: string } | null;
  purity: { id: string; code: string; percentage: string } | null;
}): Promise<{ categories: Option[]; purities: Option[] }> {
  const [cats, purs] = await Promise.all([
    categoryService.list({ activeOnly: true, pageSize: 500 }),
    purityService.list({ activeOnly: true, pageSize: 500 }),
  ]);

  const categories = cats.rows.map((c) => ({ value: c.id, label: `${c.name} (${c.code})` }));
  const purities = purs.rows.map((p) => ({ value: p.id, label: `${p.code} — ${p.name}` }));

  if (current?.category && !categories.some((c) => c.value === current.category!.id)) {
    categories.push({ value: current.category.id, label: `${current.category.name} (${current.category.code}) — nonaktif` });
  }
  if (current?.purity && !purities.some((p) => p.value === current.purity!.id)) {
    purities.push({ value: current.purity.id, label: `${current.purity.code} — nonaktif` });
  }
  return { categories, purities };
}
