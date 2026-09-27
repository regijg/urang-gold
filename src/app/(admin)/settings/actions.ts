"use server";

import { revalidatePath } from "next/cache";
import { ok, toFailure, type ActionResult } from "@/lib/action-result";
import { settingsService } from "@/server/services/settings.service";

export async function renameTenantAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  try {
    await settingsService.renameTenant(formData.get("name"));
    // tenant name is shown in the header/dashboard of every page
    revalidatePath("/", "layout");
    return ok(null, "Profil toko disimpan.");
  } catch (e) {
    return toFailure(e);
  }
}

export async function saveRolePermissionsAction(roleCode: string, permissions: string[] | null): Promise<ActionResult> {
  try {
    await settingsService.setRolePermissions(roleCode, permissions);
    // menus & page access follow the new permissions on the next render
    revalidatePath("/", "layout");
    return ok(null, permissions === null ? "Hak akses dikembalikan ke bawaan." : "Hak akses disimpan.");
  } catch (e) {
    return toFailure(e);
  }
}
