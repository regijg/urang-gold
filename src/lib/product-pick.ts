/** Product fields the stock-in form shows and copies into each piece. */
export type ReceiveProduct = {
  id: string;
  sku: string;
  name: string;
  category: string;
  purity: string;
  gross_weight: string;
  stone_weight: string;
  cost_price: string;
  labor_cost: string;
  stone_price: string;
  margin_amount: string;
};

type ProductLike = {
  id: string;
  sku: string;
  name: string;
  category: { name: string } | null;
  purity: { code: string } | null;
  gross_weight: unknown;
  stone_weight: unknown;
  cost_price: unknown;
  labor_cost: unknown;
  stone_price: unknown;
  margin_amount: unknown;
};

// PostgREST returns numeric columns as JSON numbers: stringify for the client
export function toReceiveProduct(p: ProductLike): ReceiveProduct {
  return {
    id: p.id,
    sku: p.sku,
    name: p.name,
    category: p.category?.name ?? "-",
    purity: p.purity?.code ?? "-",
    gross_weight: String(p.gross_weight),
    stone_weight: String(p.stone_weight),
    cost_price: String(p.cost_price),
    labor_cost: String(p.labor_cost),
    stone_price: String(p.stone_price),
    margin_amount: String(p.margin_amount),
  };
}
