"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { toFailure, type ActionResult } from "@/lib/action-result";
import { formToObject } from "@/lib/validation/master-data";
import { purityService } from "@/server/services/master-data.service";

export async function savePurityAction(id: string | null, _prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  try {
    const raw = formToObject(formData);
    if (id) await purityService.update(id, raw);
    else await purityService.create(raw);
  } catch (e) {
    return toFailure(e);
  }
  revalidatePath("/purities");
  redirect("/purities");
}

export async function deletePurityAction(id: string): Promise<ActionResult> {
  try {
    await purityService.remove(id);
  } catch (e) {
    return toFailure(e);
  }
  revalidatePath("/purities");
  redirect("/purities");
}
