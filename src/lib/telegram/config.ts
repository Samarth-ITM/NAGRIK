/**
 * Telegram Bot Service Configuration Placeholder
 * Authority: TRD Section 8 & Phase 1 Boundary
 *
 * Rules:
 * - Credentials must remain strictly server-side.
 * - Compiles safely without real API credentials.
 * - Actual bot webhook logic is implemented in Phase 5.
 */

export interface TelegramConfig {
  botToken: string;
  webhookSecret: string;
  botUsername: string;
  demoVideoUrl?: string;
  isConfigured: boolean;
}

export function getTelegramConfig(): TelegramConfig {
  const botToken = process.env.TELEGRAM_BOT_TOKEN || "";
  const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET || "";
  // Check explicit environment variable; allow fallback for development/demo
  const botUsername = process.env.TELEGRAM_BOT_USERNAME || "";
  const demoVideoUrl = process.env.TELEGRAM_DEMO_VIDEO_URL;

  return {
    botToken,
    webhookSecret,
    botUsername,
    demoVideoUrl,
    isConfigured: Boolean(botToken && webhookSecret && botUsername),
  };
}
