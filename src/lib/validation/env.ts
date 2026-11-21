import { z } from "zod";

/**
 * Server and Client Environment Schema
 * Authority: TRD Section 22.1
 */

export const envSchema = z.object({
  // Application
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
  APP_ENV: z.enum(["development", "preview", "production", "test"]).default("development"),
  PILOT_ID: z.string().default("kharghar_city_v1"),
  PILOT_RADIUS_METRES: z.coerce.number().default(6000),
  PILOT_CENTRE_LAT: z.coerce.number().default(19.0435),
  PILOT_CENTRE_LON: z.coerce.number().default(73.0680),

  // Supabase
  NEXT_PUBLIC_SUPABASE_URL: z.string().url().optional(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),

  // Telegram
  TELEGRAM_BOT_TOKEN: z.string().optional(),
  TELEGRAM_WEBHOOK_SECRET: z.string().optional(),
  TELEGRAM_BOT_USERNAME: z.string().default("NagrikCivicBot"),
  TELEGRAM_DEMO_VIDEO_URL: z.string().url().optional(),

  // Security & Cryptography
  CITIZEN_HMAC_SECRET: z.string().optional(),
  TELEGRAM_USER_SALT: z.string().optional(),
  TELEGRAM_CHAT_ID_ENCRYPTION_KEY: z.string().optional(),
  CITIZEN_ENCRYPTION_KEY: z.string().optional(),

  // Optional AI (Disabled by default per TRD Section 12)
  AI_ENABLED: z
    .string()
    .transform((val) => val === "true")
    .default("false"),
  AI_PROVIDER: z.enum(["openai", "gemini"]).default("openai"),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().default("gpt-4o-mini"),
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_MODEL: z.string().default("gemini-2.5-flash"),
  AI_VOICE_TRANSCRIPTION_ENABLED: z
    .string()
    .transform((val) => val === "true")
    .default("false"),

  // Limits
  SUPER_ADMIN_EMAIL: z.string().email().optional(),
  MAX_REPORTS_PER_TELEGRAM_USER_PER_DAY: z.coerce.number().default(5),
  MAX_PHOTO_SIZE_MB: z.coerce.number().default(8),
  MAX_VOICE_SIZE_MB: z.coerce.number().default(10),
  MAX_VOICE_DURATION_SECONDS: z.coerce.number().default(60),
  MAX_TEXT_DESCRIPTION_LENGTH: z.coerce.number().default(500),
});

export type Env = z.infer<typeof envSchema>;

let cachedEnv: Env | null = null;

export function getEnv(): Env {
  if (cachedEnv) return cachedEnv;
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    console.warn("Environment validation warnings:", parsed.error.format());
    // Fall back to defaults for optional setup in development/build
    cachedEnv = envSchema.parse({});
    return cachedEnv;
  }
  cachedEnv = parsed.data;
  return cachedEnv;
}
