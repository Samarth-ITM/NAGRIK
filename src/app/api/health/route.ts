import { NextResponse } from "next/server";
import { getEnv } from "@/lib/validation/env";

/**
 * Health Check API Endpoint
 * Authority: TRD Section 15.2
 *
 * Rules:
 * - Return basic service health status
 * - Do NOT expose database connection strings, API keys, or private secrets
 */
export async function GET() {
  const env = getEnv();

  return NextResponse.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    service: "nagrik-api",
    version: "1.0.0",
    pilot: {
      id: env.PILOT_ID,
      radius_metres: env.PILOT_RADIUS_METRES,
      anchor_configured: Boolean(env.PILOT_CENTRE_LAT && env.PILOT_CENTRE_LON),
    },
    features: {
      ai_enabled: env.AI_ENABLED,
      voice_transcription_enabled: env.AI_VOICE_TRANSCRIPTION_ENABLED,
    },
  });
}
