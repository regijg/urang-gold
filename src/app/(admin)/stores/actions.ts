"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { toFailure, type ActionResult } from "@/lib/action-result";
import { formToObject } from "@/lib/validation/master-data";
import { storeService } from "@/server/services/inventory.service";

export async function saveStoreAction(id: string | null, _prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  try {
    const raw = formToObject(formData);
    if (id) await storeService.update(id, raw);
    else await storeService.create(raw);
  } catch (e) {
    return toFailure(e);
  }
  revalidatePath("/stores");
  revalidatePath("/dashboard");
  redirect("/stores");
}
