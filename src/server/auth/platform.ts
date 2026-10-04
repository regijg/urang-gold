import { cache } from "react";
import { redirect } from "next/navigation";
import { AppError } from "@/lib/action-result";
import { isPlatformAdminUser } from "@/lib/auth/platform";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type PlatformAdmin = { userId: string; email: string };

/** The signed-in user when listed in PLATFORM_ADMIN_EMAILS (verified by Supabase Auth), else null. */
export const getPlatformAdmin = cache(async (): Promise<PlatformAdmin | null> => {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !isPlatformAdminUser(user)) return null;
  return { userId: user.id, email: user.email! };
});

/** For platform pages: not signed in goes to /login, signed in but not a platform admin goes back to the app. */
export async function requirePlatformAdmin(): Promise<PlatformAdmin> {
  const admin = await getPlatformAdmin();
  if (admin) return admin;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  redirect(user ? "/dashboard" : "/login?next=%2Fplatform");
}

/** For platform server actions / services: throws instead of redirecting. Always call it first. */
export async function assertPlatformAdmin(): Promise<PlatformAdmin> {
  const admin = await getPlatformAdmin();
  if (!admin) throw new AppError("FORBIDDEN", "Anda tidak memiliki akses ke konsol platform.");
  return admin;
}
