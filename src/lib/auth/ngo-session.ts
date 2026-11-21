import crypto from "crypto";
import type { NextRequest } from "next/server";

/**
 * NGO field-desk session.
 * The NGO team signs in with the shared field access password (NGO_ACCESS_PASSWORD).
 * The server then sets a signed, httpOnly cookie that every NGO endpoint checks.
 * Cookie value: base64url(json{r:"ngo",exp}).signature
 */

export const NGO_SESSION_COOKIE = "nagrik_ngo_session";
export const NGO_SESSION_MAX_AGE = 60 * 60 * 12; // 12 hours

const FALLBACK_SECRET = crypto.randomBytes(32).toString("hex");

function getSecret(): string {
  return (
    process.env.NGO_SESSION_SECRET ||
    process.env.CITIZEN_SESSION_SECRET ||
    process.env.TELEGRAM_USER_SALT ||
    FALLBACK_SECRET
  );
}

// "ngo-session:" separates these signatures from citizen session signatures,
// so a citizen cookie can never be replayed as an NGO cookie.
function sign(payload: string): string {
  return crypto.createHmac("sha256", getSecret()).update(`ngo-session:${payload}`).digest("base64url");
}

/** True when the NGO desk has a password configured on the server. */
export function isNgoAccessConfigured(): boolean {
  return Boolean(process.env.NGO_ACCESS_PASSWORD && process.env.NGO_ACCESS_PASSWORD.length >= 8);
}

/** Constant-time comparison against NGO_ACCESS_PASSWORD. */
export function verifyNgoAccessPassword(attempt: string): boolean {
  const expected = process.env.NGO_ACCESS_PASSWORD;
  if (!expected || expected.length < 8 || typeof attempt !== "string") return false;
  const a = crypto.createHash("sha256").update(attempt).digest();
  const b = crypto.createHash("sha256").update(expected).digest();
  return crypto.timingSafeEqual(a, b);
}

export function createNgoSessionToken(): string {
  const payload = Buffer.from(
    JSON.stringify({ r: "ngo", exp: Date.now() + NGO_SESSION_MAX_AGE * 1000 }),
    "utf8"
  ).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function readNgoSessionToken(token: string | undefined | null): boolean {
  if (!token || typeof token !== "string" || token.length > 512) return false;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return false;
  const a = Buffer.from(signature);
  const b = Buffer.from(sign(payload));
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return false;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return data?.r === "ngo" && typeof data?.exp === "number" && Date.now() <= data.exp;
  } catch {
    return false;
  }
}

export function isNgoRequest(req: NextRequest): boolean {
  return readNgoSessionToken(req.cookies.get(NGO_SESSION_COOKIE)?.value);
}

export const ngoCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: NGO_SESSION_MAX_AGE,
};
