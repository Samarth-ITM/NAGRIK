/**
 * Optional Gemini AI Service Configuration Placeholder
 * Authority: TRD Section 12 & Phase 1 Boundary
 *
 * Rules:
 * - Disabled by default (AI_ENABLED=false).
 * - Compiles safely without real API credentials.
 * - Server-side only; never expose API key to the browser.
 * - Actual advisory AI integration is implemented in Phase 6.
 */

export interface GeminiConfig {
  enabled: boolean;
  apiKey: string;
  model: string;
  voiceTranscriptionEnabled: boolean;
  isConfigured: boolean;
}

export function getGeminiConfig(): GeminiConfig {
  const enabled = process.env.AI_ENABLED === "true";
  const apiKey = process.env.GEMINI_API_KEY || "";
  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  const voiceTranscriptionEnabled = process.env.AI_VOICE_TRANSCRIPTION_ENABLED === "true";

  return {
    enabled,
    apiKey,
    model,
    voiceTranscriptionEnabled,
    isConfigured: Boolean(enabled && apiKey),
  };
}
