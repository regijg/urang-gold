"use server";

import { revalidatePath } from "next/cache";
import { ok, toFailure, type ActionResult } from "@/lib/action-result";
import { formToObject } from "@/lib/validation/master-data";
import { goldRateService } from "@/server/services/gold-rate.service";

export async function updateGoldRatesAction(_prev: ActionResult<{ count: number }> | null, formData: FormData): Promise<ActionResult<{ count: number }>> {
  try {
    const count = await goldRateService.update(formToObject(formData));
    revalidatePath("/gold-rates");
    revalidatePath("/products");
    revalidatePath("/dashboard");
    return ok({ count }, `Harga ${count} kadar berhasil diperbarui.`);
  } catch (e) {
    return toFailure(e);
  }
}
