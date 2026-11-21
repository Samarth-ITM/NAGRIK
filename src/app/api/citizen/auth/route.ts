import { NextRequest, NextResponse } from "next/server";
import { clientIp, minutes, rateLimit, resetRateLimit } from "@/lib/security/rate-limit";
import {
  getCitizenByTelegramHash,
  getCitizenTickets,
  verifyCitizenPassword,
} from "@/lib/auth/citizen-store";
import {
  CITIZEN_SESSION_COOKIE,
  CITIZEN_SESSION_MAX_AGE,
  createCitizenSessionToken,
  readCitizenSessionToken,
} from "@/lib/auth/citizen-session";

// Uses the filesystem (citizen store) and crypto — must run on Node, never cached.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function safeTickets(name: string) {
  try {
    return await getCitizenTickets(name);
  } catch (err) {
    console.error("[citizen/auth] ticket lookup failed:", err);
    return [];
  }
}

/**
 * GET /api/citizen/auth
 * Restores an existing web session from the signed cookie.
 */
export async function GET(req: NextRequest) {
  try {
    // The session is tied to the citizen's Telegram identity, not their display name.
    const telegramHash = readCitizenSessionToken(req.cookies.get(CITIZEN_SESSION_COOKIE)?.value);
    if (!telegramHash) {
      return NextResponse.json({ success: false, authenticated: false });
    }
    const account = await getCitizenByTelegramHash(telegramHash);
    if (!account) {
      const res = NextResponse.json({ success: false, authenticated: false });
      res.cookies.delete(CITIZEN_SESSION_COOKIE);
      return res;
    }
    const tickets = await safeTickets(telegramHash);
    return NextResponse.json({
      success: true,
      authenticated: true,
      citizen: { name: account.name },
      tickets,
    });
  } catch (err) {
    console.error("[citizen/auth GET]", err);
    return NextResponse.json(
      { success: false, error: "Could not restore your session. Sign in again." },
      { status: 500 }
    );
  }
}

/**
 * POST /api/citizen/auth  { name, password }
 * Verifies the name + password the citizen set on the Telegram bot.
 */
export async function POST(req: NextRequest) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { success: false, error: "Send your name and password as JSON." },
      { status: 400 }
    );
  }

  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const password = typeof body?.password === "string" ? body.password : "";

  if (name.length < 2 || name.length > 120) {
    return NextResponse.json(
      { success: false, error: "Enter the full name you registered on the Telegram bot." },
      { status: 400 }
    );
  }
  if (!password.trim() || password.length > 200) {
    return NextResponse.json(
      { success: false, error: "Enter your bot password." },
      { status: 400 }
    );
  }

  // Brute-force protection: per network and per account name.
  const ipKey = `citizen-login-ip:${clientIp(req)}`;
  const nameKey = `citizen-login-name:${name.toLowerCase()}`;
  const ipLimit = await rateLimit(ipKey, 20, 15 * 60 * 1000);
  const nameLimit = await rateLimit(nameKey, 6, 15 * 60 * 1000);
  if (!ipLimit.ok || !nameLimit.ok) {
    const wait = Math.max(ipLimit.ok ? 0 : ipLimit.retryAfterSeconds, nameLimit.ok ? 0 : nameLimit.retryAfterSeconds);
    return NextResponse.json(
      { success: false, error: `Too many sign-in attempts. Try again in ${minutes(wait)} minutes.` },
      { status: 429, headers: { "Retry-After": String(wait) } }
    );
  }

  try {
    const result = await verifyCitizenPassword(name, password);
    if (!result.success || !result.account || !result.account.telegramUserHash) {
      // Same message for unknown name and wrong password — don't reveal which.
      return NextResponse.json(
        {
          success: false,
          error:
            "That name and password don't match. Use exactly what you set on the Telegram bot, or open the bot to register.",
        },
        { status: 401 }
      );
    }

    await resetRateLimit(nameKey);
    const tickets = await safeTickets(result.account.telegramUserHash);
    const res = NextResponse.json({
      success: true,
      citizen: { name: result.account.name },
      tickets,
    });
    res.cookies.set(CITIZEN_SESSION_COOKIE, createCitizenSessionToken(result.account.telegramUserHash), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: CITIZEN_SESSION_MAX_AGE,
    });
    return res;
  } catch (err) {
    console.error("[citizen/auth POST]", err instanceof Error ? err.message : err);
    return NextResponse.json(
      { success: false, error: "Sign-in is temporarily unavailable. Try again in a minute." },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/citizen/auth — signs the citizen out.
 */
export async function DELETE() {
  const res = NextResponse.json({ success: true });
  res.cookies.delete(CITIZEN_SESSION_COOKIE);
  return res;
}
