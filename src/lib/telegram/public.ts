/**
 * Browser-safe Telegram bot details.
 * TELEGRAM_BOT_USERNAME is server-only, so client components read the
 * NEXT_PUBLIC_ variant (falls back to the production bot handle).
 */
export const PUBLIC_BOT_USERNAME =
  process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME || "NagrikKhargharBot";

export const PUBLIC_BOT_URL = `https://t.me/${PUBLIC_BOT_USERNAME}`;
