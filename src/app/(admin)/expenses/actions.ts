"use server";

import { revalidatePath } from "next/cache";
import { ok, toFailure, type ActionResult } from "@/lib/action-result";
import { formToObject } from "@/lib/validation/master-data";
import { expenseService } from "@/server/services/expense.service";

export async function createExpenseAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  try {
    await expenseService.create(formToObject(formData));
    revalidatePath("/expenses");
    return ok(null, "Biaya tersimpan.");
  } catch (e) {
    return toFailure(e);
  }
}

export async function voidExpenseAction(id: string, reason: string): Promise<ActionResult> {
  try {
    await expenseService.void(id, reason);
    revalidatePath("/expenses");
    return ok(null, "Biaya dibatalkan.");
  } catch (e) {
    return toFailure(e);
  }
}
