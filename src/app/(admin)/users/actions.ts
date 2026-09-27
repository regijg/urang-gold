"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { toFailure, type ActionResult } from "@/lib/action-result";
import { formToObject } from "@/lib/validation/master-data";
import { usersService } from "@/server/services/users.service";

export async function saveStaffAction(id: string | null, _prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  try {
    const raw = { ...formToObject(formData), storeIds: formData.getAll("storeIds") };
    if (id) await usersService.update(id, raw);
    else await usersService.create(raw);
  } catch (e) {
    return toFailure(e);
  }
  revalidatePath("/users");
  redirect("/users");
}
