"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ok, toFailure, type ActionResult } from "@/lib/action-result";
import { formToObject } from "@/lib/validation/master-data";
import { inventoryService, locationService } from "@/server/services/inventory.service";

function refresh(id?: string) {
  revalidatePath("/inventory");
  revalidatePath("/inventory/movements");
  if (id) revalidatePath(`/inventory/${id}`);
}

export async function receiveStockAction(
  _prev: ActionResult<{ items: { inventory_id: string; barcode: string }[] }> | null,
  formData: FormData
): Promise<ActionResult<{ items: { inventory_id: string; barcode: string }[] }>> {
  try {
    const items = await inventoryService.receive({
      storeId: formData.get("storeId"),
      locationId: formData.get("locationId"),
      productId: formData.get("productId"),
      notes: formData.get("notes"),
      grossWeight: formData.getAll("grossWeight"),
      stoneWeight: formData.getAll("stoneWeight"),
      serialNumber: formData.getAll("serialNumber"),
      costPrice: formData.getAll("costPrice"),
    });
    refresh();
    return ok({ items }, `${items.length} keping berhasil ditambahkan.`);
  } catch (e) {
    return toFailure(e);
  }
}

export async function changeStatusAction(id: string, _prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  try {
    await inventoryService.changeStatus(id, formToObject(formData));
    refresh(id);
    return ok(null, "Status berhasil diubah.");
  } catch (e) {
    return toFailure(e);
  }
}

export async function updateDetailsAction(id: string, _prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  try {
    await inventoryService.updateDetails(id, formToObject(formData));
    refresh(id);
    return ok(null, "Data barang berhasil disimpan.");
  } catch (e) {
    return toFailure(e);
  }
}

export async function transferOneAction(id: string, _prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  try {
    await inventoryService.transferOne(id, formToObject(formData));
    refresh(id);
    return ok(null, "Barang berhasil dipindahkan.");
  } catch (e) {
    return toFailure(e);
  }
}

export async function transferBulkAction(_prev: ActionResult<{ moved: number }> | null, formData: FormData): Promise<ActionResult<{ moved: number }>> {
  try {
    const moved = await inventoryService.transfer(formToObject(formData));
    refresh();
    return ok({ moved }, `${moved} keping berhasil dipindahkan.`);
  } catch (e) {
    return toFailure(e);
  }
}

export async function saveLocationAction(id: string | null, _prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  try {
    await locationService.save(id, formToObject(formData));
  } catch (e) {
    return toFailure(e);
  }
  revalidatePath("/inventory/locations");
  redirect("/inventory/locations");
}

export async function deleteLocationAction(id: string): Promise<ActionResult> {
  try {
    await locationService.remove(id);
  } catch (e) {
    return toFailure(e);
  }
  revalidatePath("/inventory/locations");
  redirect("/inventory/locations");
}
