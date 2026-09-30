"use server";

import { revalidatePath } from "next/cache";
import { ok, toFailure, type ActionResult } from "@/lib/action-result";
import { repairService } from "@/server/services/repair.service";

export type RepairPayload = {
  storeId: string;
  customerId: string;
  itemDescription: string;
  serviceType: string;
  weightIn: string;
  estimatedCost: string;
  dueDate: string;
  payments: { method: string; amount: string; reference: string }[];
  notes: string;
};

const onePayment = (fd: FormData) => [{ method: fd.get("method"), amount: fd.get("amount"), reference: fd.get("reference") }];

function refresh(id: string) {
  revalidatePath("/repairs");
  revalidatePath(`/repairs/${id}`);
}

export async function createRepairAction(payload: RepairPayload) {
  try {
    const r = await repairService.create(payload);
    revalidatePath("/repairs");
    return ok(r, `Servis ${r.repair_number} tersimpan.`);
  } catch (e) {
    return toFailure(e);
  }
}

export async function repairStatusAction(id: string, _prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  try {
    await repairService.setStatus(id, formData.get("status"), formData.get("finalCost"));
    refresh(id);
    return ok(null, "Status diperbarui.");
  } catch (e) {
    return toFailure(e);
  }
}

export async function payRepairAction(id: string, _prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  try {
    await repairService.pay(id, onePayment(formData));
    refresh(id);
    return ok(null, "Pembayaran tercatat.");
  } catch (e) {
    return toFailure(e);
  }
}

export async function pickupRepairAction(id: string, _prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  try {
    const refund = formData.get("kind") === "refund";
    await repairService.pickup(id, {
      finalCost: formData.get("finalCost"),
      payments: refund ? [] : onePayment(formData),
      refunds: refund ? onePayment(formData) : [],
    });
    refresh(id);
    return ok(null, "Barang sudah diserahkan ke customer.");
  } catch (e) {
    return toFailure(e);
  }
}

export async function cancelRepairAction(id: string, _prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  try {
    await repairService.cancel(id, formData.get("reason"), onePayment(formData));
    refresh(id);
    return ok(null, "Servis dibatalkan.");
  } catch (e) {
    return toFailure(e);
  }
}
