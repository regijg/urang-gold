"use server";

import { revalidatePath } from "next/cache";
import { ok, toFailure, type ActionResult } from "@/lib/action-result";
import type { PosItem } from "@/server/repositories/sales.repository";
import { salesService } from "@/server/services/sales.service";

export async function lookupBarcodeAction(storeId: string, barcode: string): Promise<ActionResult<PosItem>> {
  try {
    return ok(await salesService.lookupBarcode(storeId, barcode));
  } catch (e) {
    return toFailure(e);
  }
}

export async function searchItemsAction(storeId: string, q: string): Promise<ActionResult<PosItem[]>> {
  try {
    return ok(await salesService.searchItems(storeId, q));
  } catch (e) {
    return toFailure(e);
  }
}

/** Re-prices the cart (e.g. after PRICE_CHANGED); drops items that are no longer available. */
export async function repriceAction(storeId: string, barcodes: string[]): Promise<ActionResult<PosItem[]>> {
  try {
    const items: PosItem[] = [];
    for (const b of barcodes.slice(0, 100)) {
      try {
        items.push(await salesService.lookupBarcode(storeId, b));
      } catch {
        // no longer available -> removed from the cart
      }
    }
    return ok(items);
  } catch (e) {
    return toFailure(e);
  }
}

export async function searchCustomersAction(q: string): Promise<ActionResult<{ id: string; name: string; phone: string | null }[]>> {
  try {
    return ok(await salesService.searchCustomers(q));
  } catch (e) {
    return toFailure(e);
  }
}

export async function quickCreateCustomerAction(input: { name: string; phone: string }): Promise<ActionResult<{ id: string; name: string; phone: string | null }>> {
  try {
    return ok(await salesService.quickCreateCustomer(input), "Customer ditambahkan.");
  } catch (e) {
    return toFailure(e);
  }
}

export type CheckoutPayload = {
  storeId: string;
  customerId: string | null;
  items: { inventoryId: string; discount: string }[];
  payments: { method: string; amount: string; reference: string }[];
  expectedTotal: string;
  notes: string;
};

export async function checkoutAction(
  payload: CheckoutPayload
): Promise<ActionResult<{ sale_id: string; invoice_number: string; total: string; change_amount: string; public_token: string }>> {
  try {
    const result = await salesService.checkout(payload);
    revalidatePath("/sales");
    revalidatePath("/inventory");
    revalidatePath("/dashboard");
    return ok(result, `Transaksi ${result.invoice_number} berhasil.`);
  } catch (e) {
    return toFailure(e);
  }
}

export async function voidSaleAction(id: string, _prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  try {
    await salesService.void(id, formData.get("reason"));
    revalidatePath("/sales");
    revalidatePath(`/sales/${id}`);
    revalidatePath("/inventory");
    return ok(null, "Transaksi dibatalkan. Barang kembali tersedia.");
  } catch (e) {
    return toFailure(e);
  }
}
