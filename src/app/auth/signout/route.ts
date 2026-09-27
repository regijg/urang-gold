import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Clears the Supabase session cookie, then goes to /login.
 * Used when a user is authenticated with Supabase but has no usable GoldPOS
 * session (no profile, deactivated, tenant suspended). Server Components cannot
 * write cookies, so they redirect here instead of straight to /login — which
 * the middleware would bounce back to /dashboard.
 */
export async function GET(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();

  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.search = "?error=session";
  return NextResponse.redirect(url);
}
