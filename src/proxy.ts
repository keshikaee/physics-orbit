import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isAuthPage, isProtectedPath, legacyAdminRedirect } from "@/lib/auth/routes";

/**
 * Runs before every matched request:
 *   1. Refreshes the Supabase session cookie.
 *   2. Optimistically redirects signed-out users away from protected pages.
 *
 * This is NOT the authorization boundary — role checks happen on the server
 * in src/lib/auth/dal.ts and in database RLS policies.
 */
export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  const legacy = legacyAdminRedirect(pathname);
  if (legacy) {
    return NextResponse.redirect(new URL(legacy + search, request.url), 308);
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    // Not configured yet: keep protected pages unreachable.
    if (isProtectedPath(pathname)) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
    return NextResponse.next();
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
        Object.entries(headers).forEach(([key, value]) => response.headers.set(key, value));
      },
    },
  });

  // Validates the JWT (and refreshes it if needed). Do not run code between
  // createServerClient and this call.
  const { data } = await supabase.auth.getClaims();
  const signedIn = Boolean(data?.claims?.sub);

  const redirectTo = (path: string) => {
    const redirect = NextResponse.redirect(new URL(path, request.url));
    response.cookies.getAll().forEach((c) => redirect.cookies.set(c));
    return redirect;
  };

  if (!signedIn && isProtectedPath(pathname)) {
    return redirectTo(`/login?next=${encodeURIComponent(pathname + search)}`);
  }

  if (signedIn && isAuthPage(pathname)) {
    return redirectTo("/dashboard"); // the DAL forwards admins to /admin/dashboard
  }

  return response;
}

export const config = {
  matcher: [
    // Everything except static files and images.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
