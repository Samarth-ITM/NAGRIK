import { NextRequest, NextResponse } from "next/server";
import { assessEvidenceWithOpenAI } from "@/lib/ai/openai-client";
import { z } from "zod";

const AssessEvidenceSchema = z.object({
  beforePhotoUrl: z.string().url("Valid beforePhotoUrl required"),
  afterPhotoUrl: z.string().url("Valid afterPhotoUrl required"),
  categoryName: z.string().optional(),
  description: z.string().optional(),
});

/**
 * POST /api/ai/assess-evidence
 * Evaluates before/after municipal repair photographic evidence using OpenAI Vision.
 * Strict System Rule: Advisory only. All decisions remain with human Super-Admin.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = AssessEvidenceSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid request payload",
          details: parsed.error.flatten(),
        },
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
    console.error("[API assess-evidence exception]", err);
    return NextResponse.json(
      {
        success: false,
        error: err.message || "Failed to process AI evidence assessment",
      },
      { status: 500 }
    );
  }
}
