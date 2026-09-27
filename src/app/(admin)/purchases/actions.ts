"use server";

import { revalidatePath } from "next/cache";
import { ok, toFailure, type ActionResult } from "@/lib/action-result";
import { purchaseService } from "@/server/services/purchase.service";

export type PurchasePayload = {
  storeId: string;
  locationId: string;
  supplierId: string;
  supplierInvoice: string;
  purchaseDate: string;
  items: { productId: string; grossWeight: string; stoneWeight: string; serialNumber: string; costPrice: string; laborCost: string }[];
  payments: { method: string; amount: string; reference: string }[];
  notes: string;
};

export async function createPurchaseAction(payload: PurchasePayload) {
  try {
    const result = await purchaseService.create(payload);
    revalidatePath("/purchases");
    revalidatePath("/inventory");
    return ok(result, `Pembelian ${result.purchase_number} tersimpan.`);
  } catch (e) {
    return toFailure(e);
  }
}

export async function payPurchaseAction(id: string, _prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  try {
    await purchaseService.pay(id, [{ method: formData.get("method"), amount: formData.get("amount"), reference: formData.get("reference") }]);
    revalidatePath(`/purchases/${id}`);
    revalidatePath("/purchases");
    return ok(null, "Pembayaran tercatat.");
  } catch (e) {
    return toFailure(e);
  }
}

export async function voidPurchaseAction(id: string, _prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  try {
    await purchaseService.void(id, formData.get("reason"));
    revalidatePath(`/purchases/${id}`);
    revalidatePath("/purchases");
    revalidatePath("/inventory");
    return ok(null, "Pembelian dibatalkan.");
  } catch (e) {
    return toFailure(e);
  }
}
