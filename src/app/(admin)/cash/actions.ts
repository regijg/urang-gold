"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ok, toFailure, type ActionResult } from "@/lib/action-result";
import { cashService } from "@/server/services/cash.service";

export async function openCashAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  let id: string;
  try {
    id = await cashService.open({ storeId: formData.get("storeId"), openingAmount: formData.get("openingAmount"), notes: formData.get("notes") });
  } catch (e) {
    return toFailure(e);
  }
  revalidatePath("/cash");
  redirect(`/cash/${id}`);
}

export async function cashMovementAction(id: string, _prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  try {
    await cashService.addMovement(id, { direction: formData.get("direction"), amount: formData.get("amount"), reason: formData.get("reason") });
    revalidatePath(`/cash/${id}`);
    return ok(null, "Tercatat.");
  } catch (e) {
    return toFailure(e);
  }
}

export async function closeCashAction(id: string, _prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  try {
    await cashService.close(id, { countedAmount: formData.get("countedAmount"), notes: formData.get("notes") });
    revalidatePath(`/cash/${id}`);
    revalidatePath("/cash");
    return ok(null, "Kas ditutup.");
  } catch (e) {
    return toFailure(e);
  }
}

/** Opens the drawer from the POS / buyback / trade-in screen: no redirect, the screen refreshes itself. */
export async function openCashHereAction(storeId: string, _prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  try {
    await cashService.open({ storeId, openingAmount: formData.get("openingAmount"), notes: null });
  } catch (e) {
    return toFailure(e);
  }
  for (const path of ["/cash", "/sales/new", "/buybacks/new", "/trade-ins/new"]) revalidatePath(path);
  return ok(null, "Kas dibuka.");
}
