import OpenAI, { toFile } from "openai";
import { getAIConfig } from "./config";

export interface AIAssessmentResult {
  status: "APPEARS_FIXED" | "APPEARS_NOT_FIXED" | "UNCERTAIN";
  confidence: number;
  reasoning: string;
  suggestedFollowup?: string;
  provider: string;
  model: string;
  evaluatedAt: string;
}

export interface AssessEvidenceParams {
  beforeImageUrl: string;
  afterImageUrl: string;
  categoryName?: string;
  issueDescription?: string;
}

export interface VoiceTranscriptionParams {
  audioBuffer: Buffer;
  mimeType?: string;
  filename?: string;
  language?: string;
  issueTypeName?: string;
  categoryName?: string;
}

/**
 * Evaluates before/after municipal repair photographic evidence using OpenAI Vision.
 * Strict System Rule: Advisory only. All decisions remain with human Super-Admin.
 */
export async function assessEvidenceWithOpenAI(
  params: AssessEvidenceParams
): Promise<AIAssessmentResult> {
  const config = getAIConfig();

  // Safe fallback if API key is not yet configured
  if (!config.openAiApiKey) {
    return {
      status: "UNCERTAIN",
      confidence: 0,
      reasoning:
        "OpenAI API key is not configured in .env.local. Advisory vision assessment is currently running in offline fallback mode.",
      provider: "openai-unconfigured",
      model: config.openAiModel,
      evaluatedAt: new Date().toISOString(),
    };
  }

  const openai = new OpenAI({ apiKey: config.openAiApiKey });

  const systemPrompt = `You are a strict, objective civic infrastructure repair assessment assistant for Nagrik (Kharghar, Navi Mumbai).
You are comparing two images of a reported municipal problem:
1. "Before" image: The citizen's initial report of a defect (e.g., pothole, broken streetlight, overflowing garbage, cracked footpath).
2. "After" image: The maintenance authority's submitted proof of repair.

Your job is to assess whether the physical defect shown in the Before image has been genuinely repaired in the After image.
You must return your output ONLY as a valid JSON object matching this schema:
{
  "status": "APPEARS_FIXED" | "APPEARS_NOT_FIXED" | "UNCERTAIN",
  "confidence": <number between 0.0 and 1.0>,
  "reasoning": "<clear concise explanation of visual changes observed>",
  "suggestedFollowup": "<optional recommendation if evidence is ambiguous or incomplete>"
}

Rules:
- If the defect clearly appears patched, cleaned, repaired, or replaced: status is "APPEARS_FIXED".
- If the defect is still visibly present, unresolved, or untouched: status is "APPEARS_NOT_FIXED".
- If the after photo is too blurry, taken from an unrelated location, staged, or too close/far to tell: status is "UNCERTAIN".
- Be conservative and objective. Do not make assumptions. Do not include markdown codeblocks, only pure JSON.`;

  const userText = `Category: ${params.categoryName || "Civic Defect"}
Description: ${params.issueDescription || "None provided"}
Please compare the Before photo and After photo and provide your assessment.`;

  try {
    const response = await openai.chat.completions.create({
      model: config.openAiModel,
      temperature: 0.1,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: [
            { type: "text", text: userText },
            {
              type: "image_url",
              image_url: { url: params.beforeImageUrl, detail: "high" },
            },
            {
              type: "image_url",
              image_url: { url: params.afterImageUrl, detail: "high" },
            },
          ],
        },
      ],
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("Empty response from OpenAI");
    }

    const parsed = JSON.parse(content);
    const validStatuses = ["APPEARS_FIXED", "APPEARS_NOT_FIXED", "UNCERTAIN"];
    const status = validStatuses.includes(parsed.status) ? parsed.status : "UNCERTAIN";

    return {
      status,
      confidence: typeof parsed.confidence === "number" ? Math.max(0, Math.min(1, parsed.confidence)) : 0.5,
      reasoning: parsed.reasoning || "Visual evaluation completed.",
      suggestedFollowup: parsed.suggestedFollowup,
      provider: "openai",
      model: config.openAiModel,
      evaluatedAt: new Date().toISOString(),
    };
  } catch (err: any) {
    console.error("[OpenAI Evidence Assessment Error]", err.message);
    return {
      status: "UNCERTAIN",
      confidence: 0,
      reasoning: `AI evaluation failed: ${err.message || "Network or model timeout"}. Human inspection required.`,
      provider: "openai-error",
      model: config.openAiModel,
      evaluatedAt: new Date().toISOString(),
    };
  }
}

/**
 * Transcribes citizen audio voice notes using OpenAI Whisper.
 */
/**
 * Collapse a phrase repeated 3+ times in a row (a Whisper decoding glitch) to a single copy.
 * Words are never changed, reordered or dropped otherwise.
 */
function collapseRepeatedPhrases(text: string): string {
  const words = text.split(/\s+/).filter(Boolean);
  const out: string[] = [];
  let i = 0;
  while (i < words.length) {
    let collapsed = false;
    for (let n = 1; n <= 6 && i + n * 3 <= words.length; n++) {
      const phrase = words.slice(i, i + n).join(" ");
      let reps = 1;
      while (words.slice(i + reps * n, i + (reps + 1) * n).join(" ") === phrase) reps++;
      if (reps >= 3) {
        out.push(...words.slice(i, i + n));
        i += reps * n;
        collapsed = true;
        break;
      }
    }
    if (!collapsed) {
      out.push(words[i]);
      i++;
    }
  }
  return out.join(" ");
}

export async function transcribeVoiceWithOpenAI(
  params: VoiceTranscriptionParams
): Promise<{ transcript: string; language?: string; duration?: number }> {
  const config = getAIConfig();

  if (!config.openAiApiKey) {
    return {
      transcript: "[Transcription disabled: OPENAI_API_KEY is not configured]",
    };
  }

  const openai = new OpenAI({ apiKey: config.openAiApiKey });

  try {
    const file = await toFile(params.audioBuffer, params.filename || "voice.oga", {
      type: params.mimeType || "audio/ogg",
    });

    // Vocabulary hint only (helps spelling of local words). It never includes the chosen
    // problem name, so Whisper isn't nudged into saying something the citizen didn't.
    // No sector numbers here: a number in the hint makes Whisper write that sector even
    // when the resident said a different one.
    let domainPrompt =
      "Kharghar, Navi Mumbai. Sector, Central Park, Utsav Chowk, Shilp Chowk, Belpada, ITM. Pothole, garbage, streetlight, drain, footpath, water leak.";
    if (params.language === "hi") {
      domainPrompt = "खारघर, नवी मुंबई। सेक्टर, सेंट्रल पार्क, उत्सव चौक। गड्ढा, कचरा, स्ट्रीट लाइट, नाली, फुटपाथ, पानी।";
    } else if (params.language === "mr") {
      domainPrompt = "खारघर, नवी मुंबई. सेक्टर, सेंट्रल पार्क, उत्सव चौक. खड्डा, कचरा, पथदिवा, गटार, पदपथ, पाणी.";
    }

    const transcription = await openai.audio.transcriptions.create({
      file,
      model: "whisper-1",
      temperature: 0,
      prompt: domainPrompt,
      ...(params.language && ["en", "hi", "mr"].includes(params.language)
        ? { language: params.language }
        : {}),
    });

    // Verbatim: exactly what was said. No AI rewriting, polishing or summarising.
    // The only clean-up is collapsing Whisper's known glitch of looping the same phrase.
    const rawTranscript = collapseRepeatedPhrases(transcription.text?.trim() || "");
    if (!rawTranscript) {
      return { transcript: "" };
    }

    return {
      transcript: rawTranscript,
    };
  } catch (err: any) {
    console.error("[OpenAI Whisper Transcription Error]", err.message);
    return {
      transcript: `[Transcription error: ${err.message}]`,
    };
  }
}

export interface ValidateReportPhotoParams {
  photoBuffer?: Buffer;
  photoUrl?: string;
  mimeType?: string;
  categoryName?: string;
  issueTypeName?: string;
  description?: string;
}

export type PhotoValidationStatus = "MATCH" | "MISMATCH" | "UNCLEAR" | "UNVERIFIED";

export interface PhotoValidationResult {
  status: PhotoValidationStatus;
  confidence: number;
  reasoning: string;
  provider: string;
  model: string;
  evaluatedAt: string;
}

/**
 * Validates whether citizen photographic evidence visibly supports the selected issue type.
 * Strict System Rule: Advisory gate. Mismatch or Unclear blocks automated submission.
 */
export async function validateReportPhotoWithOpenAI(
  params: ValidateReportPhotoParams
): Promise<PhotoValidationResult> {
  const config = getAIConfig();

  // Safe fallback if API key is not configured (manual review fallback)
  if (!config.openAiApiKey) {
    return {
      status: "UNVERIFIED",
      confidence: 0,
      reasoning: "OpenAI API key is not configured. Photo marked as UNVERIFIED for manual super-admin review.",
      provider: "openai-unconfigured",
      model: config.openAiModel,
      evaluatedAt: new Date().toISOString(),
    };
  }

  const imageUrl = params.photoBuffer
    ? `data:${params.mimeType || "image/jpeg"};base64,${params.photoBuffer.toString("base64")}`
    : params.photoUrl;

  if (!imageUrl) {
    return {
      status: "UNCLEAR",
      confidence: 0,
      reasoning: "No photographic evidence provided for validation.",
      provider: "openai-error",
      model: config.openAiModel,
      evaluatedAt: new Date().toISOString(),
    };
  }

  const openai = new OpenAI({ apiKey: config.openAiApiKey });

  const systemPrompt = `You are an objective civic infrastructure photo verification assistant for Nagrik (Kharghar, Navi Mumbai).
A citizen is reporting a municipal infrastructure defect. Your job is to verify whether the provided photograph visibly supports the selected issue type.

Citizen Report Details:
- Category: ${params.categoryName || "Civic Defect"}
- Issue Type: ${params.issueTypeName || "General Municipal Issue"}
- Citizen Description: ${params.description || "None provided"}

You must return your output ONLY as a valid JSON object matching this schema:
{
  "status": "MATCH" | "MISMATCH" | "UNCLEAR",
  "confidence": <number between 0.0 and 1.0>,
  "reasoning": "<clear concise explanation of visual elements in the photo>"
}

Rules:
- "MATCH": The photo visibly shows the reported defect or related municipal issue (e.g., pothole visible for road pothole, garbage heap visible for waste, damaged pole/light for streetlight issue).
- "MISMATCH": The photo clearly depicts an unrelated subject (e.g., an indoor room, pet/animal, personal selfie, paper document, food, a clean undamaged surface when reporting a severe defect, or garbage when reporting a broken streetlight).
- "UNCLEAR": The photo is too blurry, too dark, obstructed, taken from moving vehicle with severe motion blur, or lacks sufficient visual detail to confirm the defect.
- Be conservative and objective. Do not output markdown code blocks, only raw JSON.`;

  try {
    const response = await openai.chat.completions.create({
      model: config.openAiModel,
      temperature: 0.1,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Please verify if this photograph shows: ${params.issueTypeName || params.categoryName || "Civic Issue"}.`,
            },
            {
              type: "image_url",
              image_url: { url: imageUrl, detail: "low" },
            },
          ],
        },
      ],
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("Empty response from OpenAI Vision");
    }

    const parsed = JSON.parse(content);
    const validStatuses = ["MATCH", "MISMATCH", "UNCLEAR"];
    const status = validStatuses.includes(parsed.status) ? parsed.status : "UNCLEAR";

    return {
      status,
      confidence: typeof parsed.confidence === "number" ? Math.max(0, Math.min(1, parsed.confidence)) : 0.5,
      reasoning: parsed.reasoning || "Photo visual verification completed.",
      provider: "openai",
      model: config.openAiModel,
      evaluatedAt: new Date().toISOString(),
    };
  } catch (err: any) {
    console.error("[OpenAI Photo Validation Error]", err.message);
    return {
      status: "UNCLEAR",
      confidence: 0,
      reasoning: `Photo verification failed: ${err.message || "Timeout or network failure"}. Please provide a clearer photo.`,
      provider: "openai-error",
      model: config.openAiModel,
      evaluatedAt: new Date().toISOString(),
    };
  }
}
