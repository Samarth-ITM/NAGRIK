import crypto from "crypto";

/**
 * Stateless, HMAC-signed citizen web session.
 * Replaces the old approach of keeping the plaintext password in localStorage.
 * Cookie value: base64url(json{n,exp}).signature
 */

export const CITIZEN_SESSION_COOKIE = "nagrik_citizen_session";
export const CITIZEN_SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

// Per-process fallback keeps dev working without env vars (sessions reset on restart).
const FALLBACK_SECRET = crypto.randomBytes(32).toString("hex");

function getSecret(): string {
  return (
    process.env.CITIZEN_SESSION_SECRET ||
    process.env.CITIZEN_HMAC_SECRET ||
    process.env.TELEGRAM_USER_SALT ||
    FALLBACK_SECRET
  );
}

function sign(payload: string): string {
  return crypto.createHmac("sha256", getSecret()).update(payload).digest("base64url");
}

export function createCitizenSessionToken(normalizedName: string): string {
  const payload = Buffer.from(
    JSON.stringify({ n: normalizedName, exp: Date.now() + CITIZEN_SESSION_MAX_AGE * 1000 }),
    "utf8"
  ).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

/** Returns the normalized citizen name, or null if the token is missing/invalid/expired. */
export function readCitizenSessionToken(token: string | undefined | null): string | null {
  if (!token || typeof token !== "string") return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;

  const expected = sign(payload);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (typeof data?.n !== "string" || typeof data?.exp !== "number") return null;
    if (Date.now() > data.exp) return null;
    return data.n;
  } catch {
    return null;
  }
}
