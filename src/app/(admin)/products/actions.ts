"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { toFailure, type ActionResult } from "@/lib/action-result";
import { formToObject } from "@/lib/validation/master-data";
import { productService } from "@/server/services/product.service";

export async function saveProductAction(
  id: string | null,
  _prev: ActionResult<{ id: string }> | null,
  formData: FormData
): Promise<ActionResult<{ id: string }>> {
  let productId: string;
  try {
    const raw = formToObject(formData);
    if (id) {
      // photo upload is disabled (saves storage); product photos are no longer accepted
      await productService.update(id, raw, null, false);
      productId = id;
    } else {
      const created = await productService.create(raw, null);
      productId = created.id;
    }
  } catch (e) {
    return toFailure(e);
  }
  revalidatePath("/products");
  revalidatePath(`/products/${productId}`);
  redirect("/products");
}

export async function deleteProductAction(id: string): Promise<ActionResult> {
  try {
    await productService.remove(id);
  } catch (e) {
    return toFailure(e);
  }
  revalidatePath("/products");
  redirect("/products");
}
