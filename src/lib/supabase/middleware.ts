import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isPlatformAdminUser } from "@/lib/auth/platform";

const AUTH_PAGES = ["/login", "/register", "/signin", "/signup"];
const PUBLIC_PREFIXES = ["/landing", "/store/", "/nota/", "/error-404", "/api/xendit", "/auth/signout"];

function isPublicPath(pathname: string) {
  return PUBLIC_PREFIXES.some((p) => pathname.startsWith(p));
}

/**
 * Refreshes the Supabase session cookie and applies coarse route protection.
 * Fine-grained authorization (tenant, role, permission) is enforced again in
 * server code and by RLS — this is only the first gate.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    }
  );

  // getUser() validates the JWT with Supabase Auth (getSession() would trust the cookie).
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  if (isPublicPath(pathname)) return response;

  const isAuthPage = AUTH_PAGES.includes(pathname);

  if (!user && !isAuthPage) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = pathname === "/" ? "" : `?next=${encodeURIComponent(pathname)}`;
    return NextResponse.redirect(url);
  }

  if (user && isAuthPage) {
    const url = request.nextUrl.clone();
    url.pathname = isPlatformAdminUser(user) ? "/platform" : "/dashboard";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}
