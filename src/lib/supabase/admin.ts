import { createClient } from "@supabase/supabase-js";

/**
 * Service-role client. BYPASSES RLS — use only in server code, after the caller's
 * identity and permissions have been verified, or for privileged RPCs
 * (e.g. gold_register_tenant). Never import this from a client component.
 */
export function createSupabaseAdminClient() {
  if (typeof window !== "undefined") {
    throw new Error("createSupabaseAdminClient must not be used in the browser");
  }
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
