"use server";

import { redirect } from "next/navigation";
import { fail, toFailure, type ActionResult } from "@/lib/action-result";
import { safeRedirectPath, validateLogin, validateRegister } from "@/lib/validation/auth";
import * as authService from "@/server/services/auth.service";

export async function loginAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const parsed = validateLogin({ email: formData.get("email"), password: formData.get("password") });
  if (!parsed.valid) return fail("VALIDATION_ERROR", "Periksa kembali isian Anda.", parsed.errors);

  let platformAdmin = false;
  try {
    ({ platformAdmin } = await authService.login(parsed.data));
  } catch (error) {
    return toFailure(error);
  }

  redirect(platformAdmin ? "/platform" : safeRedirectPath(formData.get("next")));
}

export async function registerAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const parsed = validateRegister({
    fullName: formData.get("fullName"),
    email: formData.get("email"),
    password: formData.get("password"),
    tenantName: formData.get("tenantName"),
    storeName: formData.get("storeName"),
  });
  if (!parsed.valid) return fail("VALIDATION_ERROR", "Periksa kembali isian Anda.", parsed.errors);

  try {
    await authService.registerOwner(parsed.data);
  } catch (error) {
    return toFailure(error);
  }

  redirect("/dashboard");
}

export async function logoutAction(): Promise<void> {
  await authService.logout();
  redirect("/login");
}
