"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ok, toFailure, type ActionResult } from "@/lib/action-result";
import { bool } from "@/lib/validation/common";
import { formToObject } from "@/lib/validation/master-data";
import { productService } from "@/server/services/product.service";

function photoOf(formData: FormData): File | null {
  const value = formData.get("photo");
  return value instanceof File && value.size > 0 ? value : null;
}

export async function saveProductAction(
  id: string | null,
  _prev: ActionResult<{ id: string }> | null,
  formData: FormData
): Promise<ActionResult<{ id: string }>> {
  let productId: string;
  try {
    const raw = formToObject(formData);
    if (id) {
      await productService.update(id, raw, photoOf(formData), bool(raw.removePhoto));
      productId = id;
    } else {
      const created = await productService.create(raw, photoOf(formData));
      productId = created.id;
      if (created.photoError) {
        revalidatePath("/products");
        // Product exists; send the user to its edit page to retry the upload.
        return ok({ id: productId }, created.photoError);
      }
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
