import { NextResponse, type NextRequest } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Developer-only: points the Telegram bot at a deployed site, e.g.
 *   POST { "url": "https://nagrik.vercel.app" }
 * Uses this machine's TELEGRAM_BOT_TOKEN and TELEGRAM_WEBHOOK_SECRET, so no secret is
 * ever typed into a browser. Works only in dev mode, opened directly on localhost.
 */
export async function POST(req: NextRequest) {
  const host = (req.headers.get("host") || "").split(":")[0];
  const viaProxy = Boolean(req.headers.get("cf-connecting-ip") || req.headers.get("cf-ray"));
  const isLocalHost = host === "localhost" || host === "127.0.0.1" || host === "[::1]";
  if (process.env.NODE_ENV === "production" || viaProxy || !isLocalHost) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const token = process.env.TELEGRAM_BOT_TOKEN;
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!token || !secret) {
    return NextResponse.json({ error: "TELEGRAM_BOT_TOKEN or TELEGRAM_WEBHOOK_SECRET is not set." }, { status: 500 });
  }

  let base = "";
  try {
    const body = await req.json();
    const u = new URL(String(body?.url || ""));
    if (u.protocol !== "https:") throw new Error("https only");
    base = u.origin;
  } catch {
    return NextResponse.json({ error: 'Send { "url": "https://your-site" }.' }, { status: 400 });
  }

  const webhookUrl = `${base}/api/telegram/webhook`;
  const res = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      url: webhookUrl,
      secret_token: secret,
      allowed_updates: ["message", "callback_query"],
      drop_pending_updates: false,
    }),
  });
  const data = await res.json().catch(() => ({}));
  return NextResponse.json({ ok: Boolean(data?.ok), description: data?.description || null, webhook: webhookUrl });
}
