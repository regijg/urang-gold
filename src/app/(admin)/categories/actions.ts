"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { toFailure, type ActionResult } from "@/lib/action-result";
import { formToObject } from "@/lib/validation/master-data";
import { categoryService } from "@/server/services/master-data.service";

export async function saveCategoryAction(id: string | null, _prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  try {
    const raw = formToObject(formData);
    if (id) await categoryService.update(id, raw);
    else await categoryService.create(raw);
  } catch (e) {
    return toFailure(e);
  }
  revalidatePath("/categories");
  redirect("/categories");
}

export async function deleteCategoryAction(id: string): Promise<ActionResult> {
  try {
    await categoryService.remove(id);
  } catch (e) {
    return toFailure(e);
  }
  revalidatePath("/categories");
  redirect("/categories");
}
