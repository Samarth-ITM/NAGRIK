import { NextRequest, NextResponse } from "next/server";
import { assessEvidenceWithOpenAI } from "@/lib/ai/openai-client";
import { z } from "zod";
import { requireNgoOrStaff } from "@/lib/auth/request-guards";
import { bodyTooLarge } from "@/lib/security/uploads";
import { clientIp, minutes, rateLimit } from "@/lib/security/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Only https links or inline images up to ~4 MB each are sent to the vision model.
const imageRef = z
  .string()
  .max(6 * 1024 * 1024, "Image is too large")
  .refine(
    (v) => /^https:\/\//i.test(v) || /^data:image\/(png|jpeg|jpg|webp);base64,/i.test(v),
    "Use an https image link or an uploaded image"
  );

const AssessEvidenceSchema = z.object({
  beforePhotoUrl: imageRef,
  afterPhotoUrl: imageRef,
  categoryName: z.string().max(120).optional(),
  description: z.string().max(1000).optional(),
});

/**
 * POST /api/ai/assess-evidence
 * Evaluates before/after repair photos using OpenAI Vision. Signed-in staff or NGO desk only.
 * Advisory only. All decisions remain with the human reviewer.
 */
export async function POST(req: NextRequest) {
  const denied = await requireNgoOrStaff(req);
  if (denied) return denied;

  const limit = await rateLimit(`ai-assess:${clientIp(req)}`, 30, 60 * 60 * 1000);
  if (!limit.ok) {
    return NextResponse.json(
      { success: false, error: `Too many checks. Try again in ${minutes(limit.retryAfterSeconds)} minutes.` },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } }
    );
  }

  if (bodyTooLarge(req, 13 * 1024 * 1024)) {
    return NextResponse.json({ success: false, error: "Those images are too large." }, { status: 413 });
  }

  try {
    const body = await req.json().catch(() => null);
    const parsed = AssessEvidenceSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Invalid request payload", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const assessment = await assessEvidenceWithOpenAI({
      beforeImageUrl: parsed.data.beforePhotoUrl,
      afterImageUrl: parsed.data.afterPhotoUrl,
      categoryName: parsed.data.categoryName,
      issueDescription: parsed.data.description,
    });

    return NextResponse.json({
      success: true,
      assessment,
      disclaimer: "Advisory suggestion only. Final verification remains with the authenticated human reviewer.",
    });
  } catch (err: any) {
    console.error("[API assess-evidence exception]", err?.message || err);
    return NextResponse.json({ success: false, error: "Failed to process AI evidence assessment" }, { status: 500 });
  }
}
