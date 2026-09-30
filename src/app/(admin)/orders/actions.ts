"use server";

import { revalidatePath } from "next/cache";
import { ok, toFailure, type ActionResult } from "@/lib/action-result";
import { orderService } from "@/server/services/order.service";

export type OrderPayload = {
  storeId: string;
  customerId: string;
  items: { inventoryId: string; discount: string }[];
  payments: { method: string; amount: string; reference: string }[];
  expectedTotal: string;
  dueDate: string;
  notes: string;
};

const onePayment = (fd: FormData, prefix = "") => [
  { method: fd.get(`${prefix}method`), amount: fd.get(`${prefix}amount`), reference: fd.get(`${prefix}reference`) },
];

function refresh(id: string) {
  revalidatePath("/orders");
  revalidatePath(`/orders/${id}`);
  revalidatePath("/inventory");
}

export async function createOrderAction(payload: OrderPayload) {
  try {
    const r = await orderService.create(payload);
    revalidatePath("/orders");
    revalidatePath("/inventory");
    return ok(r, `Pesanan ${r.order_number} tersimpan.`);
  } catch (e) {
    return toFailure(e);
  }
}

export async function payOrderAction(id: string, _prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  try {
    await orderService.pay(id, onePayment(formData));
    refresh(id);
    return ok(null, "Pembayaran tercatat.");
  } catch (e) {
    return toFailure(e);
  }
}

export async function completeOrderAction(id: string, _prev: ActionResult<{ sale_id: string }> | null, formData: FormData): Promise<ActionResult<{ sale_id: string }>> {
  try {
    const r = await orderService.complete(id, onePayment(formData));
    refresh(id);
    revalidatePath("/sales");
    return ok({ sale_id: r.sale_id }, `Pesanan selesai. Nota ${r.invoice_number} dibuat.`);
  } catch (e) {
    return toFailure(e);
  }
}

export async function cancelOrderAction(id: string, _prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  try {
    await orderService.cancel(id, formData.get("reason"), onePayment(formData));
    refresh(id);
    return ok(null, "Pesanan dibatalkan. Barang kembali tersedia.");
  } catch (e) {
    return toFailure(e);
  }
}
