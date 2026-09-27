"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { toFailure, type ActionResult } from "@/lib/action-result";
import { formToObject } from "@/lib/validation/master-data";
import { customerService } from "@/server/services/master-data.service";

export async function saveCustomerAction(id: string | null, _prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  try {
    const raw = formToObject(formData);
    if (id) await customerService.update(id, raw);
    else await customerService.create(raw);
  } catch (e) {
    return toFailure(e);
  }
  revalidatePath("/customers");
  redirect("/customers");
}

export async function deleteCustomerAction(id: string): Promise<ActionResult> {
  try {
    await customerService.remove(id);
  } catch (e) {
    return toFailure(e);
  }
  revalidatePath("/customers");
  redirect("/customers");
}
