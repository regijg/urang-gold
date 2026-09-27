"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { toFailure, type ActionResult } from "@/lib/action-result";
import { formToObject } from "@/lib/validation/master-data";
import { supplierService } from "@/server/services/master-data.service";

export async function saveSupplierAction(id: string | null, _prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  try {
    const raw = formToObject(formData);
    if (id) await supplierService.update(id, raw);
    else await supplierService.create(raw);
  } catch (e) {
    return toFailure(e);
  }
  revalidatePath("/suppliers");
  redirect("/suppliers");
}

export async function deleteSupplierAction(id: string): Promise<ActionResult> {
  try {
    await supplierService.remove(id);
  } catch (e) {
    return toFailure(e);
  }
  revalidatePath("/suppliers");
  redirect("/suppliers");
}
