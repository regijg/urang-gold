"use server";

import { revalidatePath } from "next/cache";
import { ok, toFailure, type ActionResult } from "@/lib/action-result";
import { buybackService } from "@/server/services/buyback.service";

export type BuybackPayload = {
  storeId: string;
  customerId: string;
  items: {
    inventoryId: string;
    name: string;
    categoryId: string;
    purityId: string;
    grossWeight: string;
    stoneWeight: string;
    pricePerGram: string;
    deduction: string;
  }[];
  payments: { method: string; amount: string; reference: string }[];
  expectedTotal: string;
  notes: string;
};

export async function createBuybackAction(
  payload: BuybackPayload
): Promise<ActionResult<{ buyback_id: string; buyback_number: string; total: string; public_token: string }>> {
  try {
    const result = await buybackService.create(payload);
    revalidatePath("/buybacks");
    revalidatePath("/inventory");
    revalidatePath("/dashboard");
    return ok(result, `Buyback ${result.buyback_number} berhasil.`);
  } catch (e) {
    return toFailure(e);
  }
}

export async function findSoldPieceAction(barcode: string) {
  try {
    return ok(await buybackService.findSoldPiece(barcode));
  } catch (e) {
    return toFailure(e);
  }
}

export async function voidBuybackAction(id: string, _prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  try {
    await buybackService.void(id, formData.get("reason"));
    revalidatePath("/buybacks");
    revalidatePath(`/buybacks/${id}`);
    revalidatePath("/inventory");
    return ok(null, "Buyback dibatalkan.");
  } catch (e) {
    return toFailure(e);
  }
}
