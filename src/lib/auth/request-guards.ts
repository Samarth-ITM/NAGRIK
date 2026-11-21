import { NextResponse, type NextRequest } from "next/server";
import { isNgoRequest } from "@/lib/auth/ngo-session";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { isAuthorityUser, isSuperAdmin } from "@/lib/permissions";

/** True when the request comes from a signed-in admin or authority user (Supabase auth). */
export async function isStaffRequest(): Promise<boolean> {
  try {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) return false;
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return false;
    const { data: profile } = await supabase.from("profiles").select("role").eq("user_id", user.id).single();
    return isSuperAdmin(profile?.role) || isAuthorityUser(profile?.role);
  } catch {
    return false;
  }
}

export function unauthorized(message = "Sign in to the NGO desk to do this.") {
  return NextResponse.json({ success: false, error: message, code: "AUTH_REQUIRED" }, { status: 401 });
}

/** Allows the NGO field desk session or a signed-in staff user. */
export async function requireNgoOrStaff(req: NextRequest): Promise<NextResponse | null> {
  if (isNgoRequest(req)) return null;
  if (await isStaffRequest()) return null;
  return unauthorized();
}

/** Allows only the NGO field desk session. */
export function requireNgo(req: NextRequest): NextResponse | null {
  return isNgoRequest(req) ? null : unauthorized();
}
