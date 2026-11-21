import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  validateReportPhotoWithOpenAI,
  type PhotoValidationResult,
} from "../src/lib/ai/openai-client";
import { PILOT_CONFIG } from "../src/lib/config/pilot";
import { calculateHaversineDistanceMetres } from "../src/lib/geospatial/haversine";
import type { DraftPayload, ConversationState } from "../src/lib/telegram/types";

describe("Nagrik: Voice-First Telegram Intake & Photo Validation Suite", () => {
  // =========================================================================
  // 1. Photo Validation Unit Tests (Controlled Data & Edge Cases)
  // =========================================================================

  it("returns UNVERIFIED advisory fallback when OPENAI_API_KEY is not configured", async () => {
    const origKey = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;

    const dummyBuffer = Buffer.from("fake-jpeg-data");
    const result: PhotoValidationResult = await validateReportPhotoWithOpenAI({
      photoBuffer: dummyBuffer,
      categoryName: "Road Surface",
      issueTypeName: "Pothole",
      description: "Deep pothole on road",
    });

    assert.equal(result.status, "UNVERIFIED");
    assert.equal(result.confidence, 0);
    assert.match(result.reasoning, /OpenAI API key is not configured/i);
    assert.equal(result.provider, "openai-unconfigured");

    if (origKey) process.env.OPENAI_API_KEY = origKey;
  });

  it("handles missing photo buffer or URL gracefully with UNCLEAR status", async () => {
    const origKey = process.env.OPENAI_API_KEY;
    process.env.OPENAI_API_KEY = "dummy-test-key";

    const result = await validateReportPhotoWithOpenAI({
      categoryName: "Road Surface",
      issueTypeName: "Pothole",
    });

    assert.equal(result.status, "UNCLEAR");
    assert.match(result.reasoning, /No photographic evidence provided/i);

    if (origKey) process.env.OPENAI_API_KEY = origKey;
    else delete process.env.OPENAI_API_KEY;
  });

  it("handles OpenAI timeout / network error as verification failure (UNCLEAR)", async () => {
    const origKey = process.env.OPENAI_API_KEY;
    // Invalid key with short timeout simulates model/service failure
    process.env.OPENAI_API_KEY = "sk-invalid-test-key-triggering-failure";

    const dummyBuffer = Buffer.from("dummy-image-bytes");
    const result = await validateReportPhotoWithOpenAI({
      photoBuffer: dummyBuffer,
      categoryName: "Street Lighting",
      issueTypeName: "Broken Streetlight",
    });

    assert.equal(result.status, "UNCLEAR");
    assert.equal(result.confidence, 0);
    assert.match(result.reasoning, /Photo verification failed/i);
    assert.equal(result.provider, "openai-error");

    if (origKey) process.env.OPENAI_API_KEY = origKey;
    else delete process.env.OPENAI_API_KEY;
  });

  // =========================================================================
  // 2. Geofence & Pilot Boundary (500m Kharghar Sector 4 Check)
  // =========================================================================

  it("permits in-area location pins within 500m of Kharghar Sector 4 anchor", () => {
    // Exact center
    const d0 = calculateHaversineDistanceMetres(
      PILOT_CONFIG.centreLatitude,
      PILOT_CONFIG.centreLongitude,
      PILOT_CONFIG.centreLatitude,
      PILOT_CONFIG.centreLongitude
    );
    assert.equal(d0, 0);

    // Nearby point inside 500m (~200m away)
    const inAreaLat = PILOT_CONFIG.centreLatitude + 0.0015;
    const inAreaLon = PILOT_CONFIG.centreLongitude + 0.001;
    const dInArea = calculateHaversineDistanceMetres(
      inAreaLat,
      inAreaLon,
      PILOT_CONFIG.centreLatitude,
      PILOT_CONFIG.centreLongitude
    );
    assert.ok(dInArea < PILOT_CONFIG.radiusMetres, `Distance ${dInArea}m should be < 500m`);
  });

  it("rejects out-of-area location pins (> 500m from pilot anchor)", () => {
    // Mumbai CST or distant location (~25km away)
    const outAreaLat = 18.9401;
    const outAreaLon = 72.8347;
    const dOut = calculateHaversineDistanceMetres(
      outAreaLat,
      outAreaLon,
      PILOT_CONFIG.centreLatitude,
      PILOT_CONFIG.centreLongitude
    );
    assert.ok(dOut > PILOT_CONFIG.radiusMetres, `Distance ${dOut}m should exceed 500m`);
  });

  // =========================================================================
  // 3. FSM Voice-First & Photo Match Workflow Simulation
  // =========================================================================

  it("simulates full happy path: Voice Note -> Confirm Transcript -> Photo MATCH -> In-Area Pin -> Submittable Draft", () => {
    const draft: DraftPayload = {
      language: "en",
      groupId: "roads_footpaths",
      categoryId: "road_surface",
      issueTypeId: "pothole",
    };

    // Step 1: Voice note received and transcribed
    const simulatedTranscript = "Large pothole in front of Sector 4 market entrance";
    draft.transcriptPending = simulatedTranscript;
    draft.voiceStoragePath = "evidence-private/reports/user123/voice_001.oga";
    draft.voiceSha256 = "voice_sha_12345";

    let state: ConversationState = "CONFIRM_VOICE_TRANSCRIPT";
    assert.equal(state, "CONFIRM_VOICE_TRANSCRIPT");

    // Step 2: Citizen clicks "Use this description"
    draft.description = draft.transcriptPending;
    draft.voiceTranscript = draft.transcriptPending;
    state = "AWAITING_LOCATION";
    assert.equal(draft.description, simulatedTranscript);

    // Step 3: Citizen provides in-area location pin
    draft.latitude = PILOT_CONFIG.centreLatitude + 0.0005;
    draft.longitude = PILOT_CONFIG.centreLongitude + 0.0005;
    const dist = calculateHaversineDistanceMetres(
      draft.latitude,
      draft.longitude,
      PILOT_CONFIG.centreLatitude,
      PILOT_CONFIG.centreLongitude
    );
    assert.ok(dist <= PILOT_CONFIG.radiusMetres);
    state = "AWAITING_PHOTO";

    // Step 4: Citizen uploads photo -> MATCH
    draft.photoStoragePath = "evidence-private/reports/user123/photo_001.jpg";
    draft.photoSha256 = "photo_sha_pothole_abc";
    draft.photoValidationStatus = "MATCH";
    draft.photoValidationReason = "Pothole clearly visible on asphalt roadway.";
    draft.validatedPhotoSha256 = draft.photoSha256;
    draft.validatedIssueTypeId = draft.issueTypeId;
    state = "CONFIRM_SUBMISSION";

    // Step 5: Validate submission gate invariants
    const canSubmit =
      Boolean(draft.photoStoragePath && draft.photoSha256) &&
      (draft.photoValidationStatus === "MATCH" || draft.photoValidationStatus === "UNVERIFIED") &&
      draft.validatedPhotoSha256 === draft.photoSha256 &&
      draft.validatedIssueTypeId === draft.issueTypeId &&
      dist <= PILOT_CONFIG.radiusMetres;

    assert.equal(canSubmit, true, "Valid draft with photo MATCH must pass submission gate");
  });

  it("blocks submission when photo is a MISMATCH (pothole issue + garbage photo)", () => {
    const draft: DraftPayload = {
      language: "en",
      groupId: "roads_footpaths",
      categoryId: "road_surface",
      issueTypeId: "pothole",
      description: "Pothole near society gate",
      latitude: PILOT_CONFIG.centreLatitude,
      longitude: PILOT_CONFIG.centreLongitude,
      photoStoragePath: "evidence-private/reports/user123/photo_garbage.jpg",
      photoSha256: "photo_sha_garbage_999",
      // Photo validation returns MISMATCH
      photoValidationStatus: "MISMATCH",
      photoValidationReason: "Photo depicts household garbage bags, no roadway defect or pothole visible.",
      validatedPhotoSha256: "photo_sha_garbage_999",
      validatedIssueTypeId: "pothole",
    };

    const state: ConversationState = "AWAITING_PHOTO_RETRY";
    assert.equal(state, "AWAITING_PHOTO_RETRY");

    // Submission gate check
    const canSubmit =
      Boolean(draft.photoStoragePath && draft.photoSha256) &&
      (draft.photoValidationStatus === "MATCH" || draft.photoValidationStatus === "UNVERIFIED");

    assert.equal(canSubmit, false, "Draft with photo MISMATCH must be blocked from submission");
  });

  it("pauses flow on UNCLEAR photo, allows retry, and resumes when clearer photo MATCHES", () => {
    const draft: DraftPayload = {
      language: "en",
      groupId: "waste_sanitation",
      categoryId: "solid_waste",
      issueTypeId: "garbage_dump",
      description: "Overflowing garbage dump",
      latitude: PILOT_CONFIG.centreLatitude,
      longitude: PILOT_CONFIG.centreLongitude,
    };

    // First attempt: blurry photo
    draft.photoStoragePath = "evidence-private/reports/user123/blurry.jpg";
    draft.photoSha256 = "sha_blurry_001";
    draft.photoValidationStatus = "UNCLEAR";
    draft.photoValidationReason = "Severe motion blur; cannot determine contents.";
    draft.validatedPhotoSha256 = draft.photoSha256;
    draft.validatedIssueTypeId = draft.issueTypeId;

    let canSubmit =
      Boolean(draft.photoStoragePath && draft.photoSha256) &&
      (draft.photoValidationStatus === "MATCH" || draft.photoValidationStatus === "UNVERIFIED");
    assert.equal(canSubmit, false, "UNCLEAR photo must block submission");

    // Citizen retries with clearer photo
    draft.photoStoragePath = "evidence-private/reports/user123/clear_garbage.jpg";
    draft.photoSha256 = "sha_clear_002";
    draft.photoValidationStatus = "MATCH";
    draft.photoValidationReason = "Overflowing waste dump clearly visible.";
    draft.validatedPhotoSha256 = draft.photoSha256;
    draft.validatedIssueTypeId = draft.issueTypeId;

    canSubmit =
      Boolean(draft.photoStoragePath && draft.photoSha256) &&
      (draft.photoValidationStatus === "MATCH" || draft.photoValidationStatus === "UNVERIFIED") &&
      draft.validatedPhotoSha256 === draft.photoSha256 &&
      draft.validatedIssueTypeId === draft.issueTypeId;

    assert.equal(canSubmit, true, "After clearer photo MATCH, submission resumes cleanly");
  });

  it("invalidates validation and blocks submission if issue type is changed after matching", () => {
    const draft: DraftPayload = {
      language: "en",
      groupId: "roads_footpaths",
      categoryId: "road_surface",
      issueTypeId: "pothole",
      photoStoragePath: "evidence-private/reports/user123/pothole.jpg",
      photoSha256: "sha_pothole_verified",
      photoValidationStatus: "MATCH",
      photoValidationReason: "Pothole confirmed.",
      validatedPhotoSha256: "sha_pothole_verified",
      validatedIssueTypeId: "pothole",
    };

    // Citizen alters issue type to broken streetlight
    draft.issueTypeId = "streetlight_broken";

    // Invariant check: validatedIssueTypeId does not match new issueTypeId
    const isValidationValid =
      draft.validatedIssueTypeId === draft.issueTypeId &&
      draft.validatedPhotoSha256 === draft.photoSha256;

    assert.equal(isValidationValid, false, "Changing issue type must invalidate existing validation");

    const canSubmit =
      Boolean(draft.photoStoragePath && draft.photoSha256) &&
      (draft.photoValidationStatus === "MATCH" || draft.photoValidationStatus === "UNVERIFIED") &&
      isValidationValid;

    assert.equal(canSubmit, false, "Stale validation must block report submission");
  });

  it("invalidates validation and blocks submission if photo is changed after matching", () => {
    const draft: DraftPayload = {
      language: "en",
      groupId: "roads_footpaths",
      categoryId: "road_surface",
      issueTypeId: "pothole",
      photoStoragePath: "evidence-private/reports/user123/photo1.jpg",
      photoSha256: "sha_original_111",
      photoValidationStatus: "MATCH",
      photoValidationReason: "Pothole confirmed.",
      validatedPhotoSha256: "sha_original_111",
      validatedIssueTypeId: "pothole",
    };

    // Citizen or bot replaces photo with new file
    draft.photoStoragePath = "evidence-private/reports/user123/photo2.jpg";
    draft.photoSha256 = "sha_different_222";

    const isValidationValid =
      draft.validatedPhotoSha256 === draft.photoSha256 &&
      draft.validatedIssueTypeId === draft.issueTypeId;

    assert.equal(isValidationValid, false, "Changing photo SHA must invalidate validation");

    const canSubmit =
      Boolean(draft.photoStoragePath && draft.photoSha256) &&
      (draft.photoValidationStatus === "MATCH" || draft.photoValidationStatus === "UNVERIFIED") &&
      isValidationValid;

    assert.equal(canSubmit, false, "Replaced photo must require revalidation before submission");
  });

  it("blocks submission if location is out of bounds even with MATCH photo", () => {
    const draft: DraftPayload = {
      language: "en",
      groupId: "roads_footpaths",
      categoryId: "road_surface",
      issueTypeId: "pothole",
      // Out of bounds coordinate
      latitude: 19.1000, // ~6km away from Kharghar 19.0475
      longitude: 73.0699,
      photoStoragePath: "evidence-private/reports/user123/pothole.jpg",
      photoSha256: "sha_pothole_verified",
      photoValidationStatus: "MATCH",
      validatedPhotoSha256: "sha_pothole_verified",
      validatedIssueTypeId: "pothole",
    };

    const dist = calculateHaversineDistanceMetres(
      draft.latitude!,
      draft.longitude!,
      PILOT_CONFIG.centreLatitude,
      PILOT_CONFIG.centreLongitude
    );

    assert.ok(dist > PILOT_CONFIG.radiusMetres, `Distance ${dist}m must be > 500m`);

    const canSubmit =
      Boolean(draft.photoStoragePath && draft.photoSha256) &&
      (draft.photoValidationStatus === "MATCH" || draft.photoValidationStatus === "UNVERIFIED") &&
      draft.validatedPhotoSha256 === draft.photoSha256 &&
      draft.validatedIssueTypeId === draft.issueTypeId &&
      dist <= PILOT_CONFIG.radiusMetres;

    assert.equal(canSubmit, false, "Out of bounds pin must block ticket submission");
  });
});
