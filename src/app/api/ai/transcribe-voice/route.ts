import { NextRequest, NextResponse } from "next/server";
import { transcribeVoiceWithOpenAI } from "@/lib/ai/openai-client";

/**
 * POST /api/ai/transcribe-voice
 * Transcribes citizen audio voice notes using OpenAI Whisper.
 */
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("audio") as File | null;

    if (!file) {
      return NextResponse.json(
        { success: false, error: "Audio file is required in form-data key 'audio'" },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const result = await transcribeVoiceWithOpenAI({
      audioBuffer: buffer,
      mimeType: file.type || "audio/ogg",
      filename: file.name || "voice-note.ogg",
    });

    return NextResponse.json({
      success: true,
      transcript: result.transcript,
      language: result.language,
    });
  } catch (err: any) {
    console.error("[API transcribe-voice exception]", err);
    return NextResponse.json(
      {
        success: false,
        error: err.message || "Failed to transcribe voice note",
      },
      { status: 500 }
    );
  }
}
