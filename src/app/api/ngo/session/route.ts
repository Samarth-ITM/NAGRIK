import { NextRequest, NextResponse } from "next/server";
import {
  NGO_SESSION_COOKIE,
  createNgoSessionToken,
  isNgoAccessConfigured,
  isNgoRequest,
  ngoCookieOptions,
  verifyNgoAccessPassword,
} from "@/lib/auth/ngo-session";
import { clientIp, minutes, rateLimit, resetRateLimit } from "@/lib/security/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000;

/** GET /api/ngo/session: is this browser signed in to the NGO desk? */
export async function GET(req: NextRequest) {
  return NextResponse.json({ success: true, authenticated: isNgoRequest(req) });
}

/** POST /api/ngo/session { password }: signs in to the NGO field desk. */
export async function POST(req: NextRequest) {
  if (!isNgoAccessConfigured()) {
    return NextResponse.json(
      {
        success: false,
        error: "The NGO desk isn't set up yet. Ask the Nagrik admin to set NGO_ACCESS_PASSWORD on the server.",
      },
      { status: 503 }
    );
  }

  const key = `ngo-login:${clientIp(req)}`;
  const limit = await rateLimit(key, MAX_ATTEMPTS, WINDOW_MS);
  if (!limit.ok) {
    return NextResponse.json(
      {
        success: false,
        error: `Too many wrong passwords. Try again in ${minutes(limit.retryAfterSeconds)} minutes.`,
      },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } }
    );
  }

  let body: any = null;
  try {
    body = await req.json();
  } catch {
    /* handled below */
  }
  // Ignore spaces copied in by accident around the password.
  const password = typeof body?.password === "string" ? body.password.trim() : "";
  if (!password || password.length > 200) {
    return NextResponse.json({ success: false, error: "Enter the field access password." }, { status: 400 });
  }

  if (!verifyNgoAccessPassword(password)) {
    return NextResponse.json(
      {
        success: false,
        error: `That field access password is wrong. Check it with your Nagrik admin. ${limit.remaining} ${limit.remaining === 1 ? "try" : "tries"} left before a 15-minute wait.`,
      },
      { status: 401 }
    );
  }

  await resetRateLimit(key);
  const res = NextResponse.json({ success: true, authenticated: true });
  res.cookies.set(NGO_SESSION_COOKIE, createNgoSessionToken(), ngoCookieOptions);
  return res;
}

/** DELETE /api/ngo/session: signs out of the NGO desk. */
export async function DELETE() {
  const res = NextResponse.json({ success: true, authenticated: false });
  res.cookies.set(NGO_SESSION_COOKIE, "", { ...ngoCookieOptions, maxAge: 0 });
  return res;
}
