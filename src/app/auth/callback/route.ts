import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { safeNextPath } from "@/lib/auth/routes";
import { isSupabaseConfigured } from "@/lib/supabase/env";

/**
 * Landing point for links in Supabase emails (sign-up confirmation,
 * password reset). Supports both the PKCE `code` flow and `token_hash`.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const next = safeNextPath(searchParams.get("next"));
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  if (!isSupabaseConfigured()) {
    return NextResponse.redirect(new URL("/login?error=link", request.url));
  }

  const supabase = await createClient();
  let ok = false;

  if (code) {
    ok = !(await supabase.auth.exchangeCodeForSession(code)).error;
  } else if (tokenHash && type) {
    ok = !(await supabase.auth.verifyOtp({ type, token_hash: tokenHash })).error;
  }

  const target = ok ? next : "/login?error=link";
  return NextResponse.redirect(new URL(target, request.url));
}
