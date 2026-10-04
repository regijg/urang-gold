"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ok, toFailure, type ActionResult } from "@/lib/action-result";
import { platformService } from "@/server/services/platform.service";

export async function setTenantStatusAction(id: string, status: string): Promise<ActionResult> {
  try {
    await platformService.setStatus(id, status);
    revalidatePath("/platform");
    return ok(null, status === "ACTIVE" ? "Toko diaktifkan." : "Toko ditangguhkan.");
  } catch (e) {
    return toFailure(e);
  }
}

export async function setTenantPlanAction(id: string, plan: string): Promise<ActionResult> {
  try {
    await platformService.setPlan(id, plan);
    revalidatePath("/platform");
    return ok(null, "Paket diubah.");
  } catch (e) {
    return toFailure(e);
  }
}

export async function createTenantAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  try {
    await platformService.create({
      fullName: formData.get("fullName"),
      email: formData.get("email"),
      password: formData.get("password"),
      tenantName: formData.get("tenantName"),
      storeName: formData.get("storeName"),
      plan: formData.get("plan"),
    });
  } catch (e) {
    return toFailure(e);
  }
  revalidatePath("/platform");
  redirect("/platform?created=1");
}
