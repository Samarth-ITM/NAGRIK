import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Development helper: shows where Telegram is delivering bot updates and the last
 * delivery error. Never returns the bot token. Disabled in production.
 */
export async function GET() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available in production." }, { status: 404 });
  }
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return NextResponse.json({ error: "TELEGRAM_BOT_TOKEN is not set." }, { status: 500 });

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`, { cache: "no-store" });
    const data = await res.json();
    const r = data?.result || {};
    const url: string = r.url || "";
    return NextResponse.json({
      webhook_host: url ? url.replace(/^(https?:\/\/[^/]+).*$/, "$1") : null,
      webhook_path: url ? url.replace(/^https?:\/\/[^/]+/, "") : null,
      pending_update_count: r.pending_update_count ?? null,
      last_error_at: r.last_error_date ? new Date(r.last_error_date * 1000).toISOString() : null,
      last_error_message: r.last_error_message ?? null,
      allowed_updates: r.allowed_updates ?? "all (default)",
    });
  } catch (err) {
    return NextResponse.json(
      { error: "Couldn't reach Telegram.", detail: err instanceof Error ? err.message : String(err) },
      { status: 502 }
    );
  }
}
