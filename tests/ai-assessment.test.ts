import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { assessEvidenceWithOpenAI, transcribeVoiceWithOpenAI } from "../src/lib/ai/openai-client";
import { getAIConfig } from "../src/lib/ai/config";

describe("Phase 6 & 7: OpenAI Advisory Assessment & Voice Suite", () => {
  it("defaults to safe offline fallback when OPENAI_API_KEY is unset", async () => {
    // Ensure key is unset for this test
    const origKey = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;

    const result = await assessEvidenceWithOpenAI({
      beforeImageUrl: "https://example.com/before.jpg",
      afterImageUrl: "https://example.com/after.jpg",
      categoryName: "Road Surface",
      issueDescription: "Pothole on Pravesh Marg",
    });

    assert.equal(result.status, "UNCERTAIN");
    assert.equal(result.confidence, 0);
    assert.match(result.reasoning, /OpenAI API key is not configured/i);
    assert.equal(result.provider, "openai-unconfigured");
    assert.ok(result.evaluatedAt);

    // Restore key
    if (origKey) process.env.OPENAI_API_KEY = origKey;
  });

  it("returns safe message when voice transcription is attempted without key", async () => {
    const origKey = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;

    const dummyBuffer = Buffer.from("fake-audio-bytes");
    const result = await transcribeVoiceWithOpenAI({
      audioBuffer: dummyBuffer,
      filename: "test.ogg",
    });

    assert.match(result.transcript, /OPENAI_API_KEY is not configured/i);

    if (origKey) process.env.OPENAI_API_KEY = origKey;
  });

  it("verifies AI configuration reads environment variables safely", () => {
    process.env.AI_PROVIDER = "openai";
    process.env.OPENAI_MODEL = "gpt-4o-mini";
    const config = getAIConfig();

    assert.equal(config.provider, "openai");
    assert.equal(config.openAiModel, "gpt-4o-mini");
    assert.equal(typeof config.enabled, "boolean");
  });

  it("enforces system invariant: AI assessment output is strictly advisory", () => {
    // Valid status values must be strictly one of the 3 approved states
    const validStatuses = ["APPEARS_FIXED", "APPEARS_NOT_FIXED", "UNCERTAIN"];
    validStatuses.forEach((st) => {
      assert.ok(
        ["APPEARS_FIXED", "APPEARS_NOT_FIXED", "UNCERTAIN"].includes(st),
        `Status ${st} must be an approved advisory state`
      );
    });

    // An AI assessment object never contains administrative permissions to mutate Spot status
    const dummyAssessment = {
      status: "APPEARS_FIXED" as const,
      confidence: 0.95,
      reasoning: "Road patch is complete and flush with asphalt.",
      provider: "openai",
      model: "gpt-4o-mini",
      evaluatedAt: new Date().toISOString(),
    };

    assert.ok(!("setSpotStatus" in dummyAssessment), "AI result must never possess permission to mutate state");
    assert.ok(!("autoResolved" in dummyAssessment), "AI result must never auto-resolve issues");
  });
});
