import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  // Only same-site paths: "/x" is fine; "//evil.com", "/\\evil.com" and full URLs are not.
  const rawNext = requestUrl.searchParams.get("next") || "/dashboard";
  const next =
    rawNext.startsWith("/") && !rawNext.startsWith("//") && !rawNext.startsWith("/\\") && !/[\r\n\t]/.test(rawNext)
      ? rawNext
      : "/dashboard";

  if (code) {
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const target = new URL(next, requestUrl.origin);
      // Belt and braces: never leave this site after sign-in.
      if (target.origin !== requestUrl.origin) {
        return NextResponse.redirect(new URL("/dashboard", requestUrl.origin));
      }
      return NextResponse.redirect(target);
    }
    console.error("[Auth Callback Error]", error.message);
  }

  // Return the user to login with an error message if auth exchange failed
  return NextResponse.redirect(new URL("/login?error=auth_failed", requestUrl.origin));
}
