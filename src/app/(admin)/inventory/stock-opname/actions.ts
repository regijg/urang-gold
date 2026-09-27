"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ok, toFailure, type ActionResult } from "@/lib/action-result";
import { stockOpnameService } from "@/server/services/stock-opname.service";

const refresh = (id?: string) => {
  revalidatePath("/inventory/stock-opname");
  if (id) revalidatePath(`/inventory/stock-opname/${id}`);
};

export async function startOpnameAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  let id: string;
  try {
    id = await stockOpnameService.start({ storeId: formData.get("storeId"), locationId: formData.get("locationId"), notes: formData.get("notes") });
  } catch (e) {
    return toFailure(e);
  }
  refresh();
  redirect(`/inventory/stock-opname/${id}`);
}

export async function scanOpnameAction(id: string, barcode: string, weight: string) {
  try {
    const row = await stockOpnameService.scan(id, barcode, weight);
    refresh(id);
    return ok(row);
  } catch (e) {
    return toFailure(e);
  }
}

export async function unscanOpnameAction(id: string, inventoryId: string) {
  try {
    await stockOpnameService.unscan(id, inventoryId);
    refresh(id);
    return ok(null);
  } catch (e) {
    return toFailure(e);
  }
}

export async function submitOpnameAction(id: string): Promise<ActionResult> {
  try {
    await stockOpnameService.submit(id);
    refresh(id);
    return ok(null, "Stock opname dikirim untuk persetujuan.");
  } catch (e) {
    return toFailure(e);
  }
}

export async function reviewOpnameAction(id: string, _prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const decision = formData.get("decision");
  try {
    if (decision === "APPROVE") {
      const n = await stockOpnameService.approve(id, formData.get("notes"));
      refresh(id);
      revalidatePath("/inventory");
      return ok(null, `Disetujui. ${n} penyesuaian stok diterapkan.`);
    }
    await stockOpnameService.review(id, decision === "CANCEL" ? "CANCEL" : "REJECT", formData.get("notes"));
    refresh(id);
    return ok(null, decision === "CANCEL" ? "Stock opname dibatalkan." : "Dikembalikan untuk dihitung ulang.");
  } catch (e) {
    return toFailure(e);
  }
}
