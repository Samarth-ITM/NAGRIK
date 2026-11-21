import { NextRequest, NextResponse } from "next/server";
import { transcribeVoiceWithOpenAI } from "@/lib/ai/openai-client";
import { requireNgoOrStaff } from "@/lib/auth/request-guards";
import { bodyTooLarge } from "@/lib/security/uploads";
import { clientIp, minutes, rateLimit } from "@/lib/security/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Hosting limits request bodies to ~4.5 MB; 4 MB is several minutes of compressed speech.
const MAX_AUDIO_BYTES = 4 * 1024 * 1024;
const ALLOWED_AUDIO = /^(audio\/(webm|ogg|mpeg|mp3|mp4|m4a|x-m4a|wav|x-wav|aac)|video\/webm)(;.*)?$/i;

/**
 * POST /api/ai/transcribe-voice
 * Transcribes a voice note for the NGO desk (and signed-in staff).
 * Citizen voice notes go through the Telegram bot, not this endpoint.
 */
export async function POST(req: NextRequest) {
  const denied = await requireNgoOrStaff(req);
  if (denied) return denied;

  const limit = await rateLimit(`ai-transcribe:${clientIp(req)}`, 30, 60 * 60 * 1000);
  if (!limit.ok) {
    return NextResponse.json(
      { success: false, error: `Too many voice notes. Try again in ${minutes(limit.retryAfterSeconds)} minutes.` },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } }
    );
  }

  if (bodyTooLarge(req, MAX_AUDIO_BYTES + 64 * 1024)) {
    return NextResponse.json({ success: false, error: "That recording is too long. Keep it under a few minutes." }, { status: 413 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get("audio");

    if (!file || typeof file === "string") {
      return NextResponse.json(
        { success: false, error: "Audio file is required in form-data key 'audio'" },
        { status: 400 }
      );
    }
    if (file.size === 0 || file.size > MAX_AUDIO_BYTES) {
      return NextResponse.json({ success: false, error: "That recording is empty or too long." }, { status: 413 });
    }
    const mimeType = file.type || "audio/webm";
    if (!ALLOWED_AUDIO.test(mimeType)) {
      return NextResponse.json({ success: false, error: "Send the voice note as an audio recording." }, { status: 415 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const safeName = (file.name || "voice-note.webm").replace(/[^A-Za-z0-9._-]/g, "_").slice(0, 60);

    const result = await transcribeVoiceWithOpenAI({
      audioBuffer: buffer,
      mimeType,
      filename: safeName,
    });

    return NextResponse.json({
      success: true,
      transcript: result.transcript,
      language: result.language,
    });
  } catch (err: any) {
    console.error("[API transcribe-voice exception]", err?.message || err);
    return NextResponse.json({ success: false, error: "Failed to transcribe voice note" }, { status: 500 });
  }
}
