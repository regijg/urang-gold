"use server";

import { revalidatePath } from "next/cache";
import { ok, toFailure, type ActionResult } from "@/lib/action-result";
import { tradeInService } from "@/server/services/trade-in.service";

export type TradeInPayload = {
  storeId: string;
  customerId: string;
  buyItems: {
    inventoryId: string;
    name: string;
    categoryId: string;
    purityId: string;
    grossWeight: string;
    stoneWeight: string;
    pricePerGram: string;
    deduction: string;
  }[];
  sellItems: { inventoryId: string; discount: string }[];
  payments: { method: string; amount: string; reference: string }[];
  expectedBalance: string;
  notes: string;
};

export async function createTradeInAction(payload: TradeInPayload) {
  try {
    const result = await tradeInService.create(payload);
    revalidatePath("/trade-ins");
    revalidatePath("/sales");
    revalidatePath("/buybacks");
    revalidatePath("/inventory");
    revalidatePath("/dashboard");
    return ok(result, `Tukar tambah ${result.trade_in_number} berhasil.`);
  } catch (e) {
    return toFailure(e);
  }
}

export async function voidTradeInAction(id: string, _prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  try {
    await tradeInService.void(id, formData.get("reason"));
    revalidatePath("/trade-ins");
    revalidatePath(`/trade-ins/${id}`);
    revalidatePath("/inventory");
    return ok(null, "Tukar tambah dibatalkan.");
  } catch (e) {
    return toFailure(e);
  }
}
