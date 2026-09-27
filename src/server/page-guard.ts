import { notFound, redirect } from "next/navigation";
import { AppError } from "@/lib/action-result";
import type { Permission } from "@/lib/auth/permissions";
import { requireAppSession, type AppSession } from "@/server/auth/session";

/** Runs a page data loader and turns domain errors into the right navigation. */
export async function loadPage<T>(loader: () => Promise<T>): Promise<T> {
  try {
    return await loader();
  } catch (e) {
    if (e instanceof AppError) {
      if (e.code === "NOT_FOUND") notFound();
      if (e.code === "FORBIDDEN") redirect("/forbidden");
      if (e.code === "UNAUTHENTICATED") redirect("/auth/signout");
    }
    throw e;
  }
}

/** For pages that only make sense with a permission (create/edit forms). */
export async function requirePagePermission(permission: Permission): Promise<AppSession> {
  const session = await requireAppSession();
  if (!session.permissions.includes(permission)) redirect("/forbidden");
  return session;
}
