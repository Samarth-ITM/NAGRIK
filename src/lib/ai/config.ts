/**
 * AI Service Configuration (OpenAI & Gemini)
 * Authority: TRD Section 12 & Phase 6 Boundary
 *
 * Rules:
 * - Server-side only; never expose API keys to browser.
 * - Supports OpenAI (gpt-4o-mini vision, whisper-1) as primary, with Gemini fallback.
 * - Defaults to safe fallback if keys are missing (compiles and runs without crashing).
 * - AI decisions are strictly advisory; human reviewers make all final decisions.
 */

export interface AIConfig {
  enabled: boolean;
  provider: "openai" | "gemini";
  openAiApiKey: string;
  openAiModel: string;
  geminiApiKey: string;
  geminiModel: string;
  voiceTranscriptionEnabled: boolean;
  isConfigured: boolean;
}

export function getAIConfig(): AIConfig {
  const provider = (process.env.AI_PROVIDER?.toLowerCase() as "openai" | "gemini") || "openai";
  const openAiApiKey = process.env.OPENAI_API_KEY || "";
  const openAiModel = process.env.OPENAI_MODEL || "gpt-4o-mini";
  const geminiApiKey = process.env.GEMINI_API_KEY || "";
  const geminiModel = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  const voiceTranscriptionEnabled = process.env.AI_VOICE_TRANSCRIPTION_ENABLED !== "false";

  // Enabled if explicit flag is true or if API key is present
  const explicitEnabled = process.env.AI_ENABLED === "true";
  const hasKey = provider === "openai" ? Boolean(openAiApiKey) : Boolean(geminiApiKey);
  const enabled = explicitEnabled || hasKey;

  return {
    enabled,
    provider,
    openAiApiKey,
    openAiModel,
    geminiApiKey,
    geminiModel,
    voiceTranscriptionEnabled,
    isConfigured: hasKey,
  };
}
