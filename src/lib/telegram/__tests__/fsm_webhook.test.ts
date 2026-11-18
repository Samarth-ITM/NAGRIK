import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { detectMimeType } from "../media";
import { validateWebhookSecret, deriveCitizenUserHash, encryptTelegramChatId, decryptTelegramChatId } from "../crypto";
import {
  NAGRIK_TAXONOMY_V1,
  getTaxonomyGroup,
  getTaxonomyCategory,
  getTaxonomyIssueOption,
  getResolvedLabel,
} from "../../taxonomy/nagrik-taxonomy.v1";
import { calculateHaversineDistanceMetres, classifyCandidateBand } from "../../geospatial/haversine";

describe("Phase 5: Telegram Pipeline & Integration Unit Suite", () => {
  beforeEach(() => {
    process.env.TELEGRAM_USER_SALT = "test_salt_nagrik_phase_5_secret_123456789";
    process.env.CITIZEN_ENCRYPTION_KEY = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
    process.env.TELEGRAM_WEBHOOK_SECRET = "webhook_secret_nagrik_test_999";
  });

  // 1. Webhook Security & Header Validation
  describe("Webhook Security & Secret Header Validation", () => {
    it("validates exact secret token in constant time", () => {
      assert.equal(validateWebhookSecret("webhook_secret_nagrik_test_999"), true);
      assert.equal(validateWebhookSecret("wrong_secret"), false);
      assert.equal(validateWebhookSecret(""), false);
      assert.equal(validateWebhookSecret(null), false);
      assert.equal(validateWebhookSecret(undefined), false);
    });

    it("rejects token with different length safely", () => {
      assert.equal(validateWebhookSecret("webhook_secret_nagrik_test_99"), false);
      assert.equal(validateWebhookSecret("webhook_secret_nagrik_test_9999"), false);
    });
  });

  // 2. Media Magic Bytes & Validation
  describe("Media Format Detection & Magic Bytes", () => {
    it("detects JPEG magic bytes (FF D8 FF)", () => {
      const jpegBuf = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
      assert.equal(detectMimeType(jpegBuf), "image/jpeg");
    });

    it("detects PNG magic bytes (89 50 4E 47)", () => {
      const pngBuf = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]);
      assert.equal(detectMimeType(pngBuf), "image/png");
    });

    it("detects WebP magic bytes (RIFF ... WEBP)", () => {
      const webpBuf = Buffer.concat([
        Buffer.from("RIFF", "ascii"),
        Buffer.from([0x00, 0x00, 0x00, 0x00]),
        Buffer.from("WEBP", "ascii"),
      ]);
      assert.equal(detectMimeType(webpBuf), "image/webp");
    });

    it("detects Ogg/Opus voice magic bytes (OggS)", () => {
      const oggBuf = Buffer.concat([
        Buffer.from("OggS", "ascii"),
        Buffer.from([0x00, 0x02, 0x00, 0x00]),
      ]);
      assert.equal(detectMimeType(oggBuf), "audio/ogg");
    });

    it("detects MP3 audio magic bytes (ID3)", () => {
      const mp3Buf = Buffer.from("ID3\x03\x00\x00", "ascii");
      assert.equal(detectMimeType(mp3Buf), "audio/mpeg");
    });

    it("returns application/octet-stream for unknown bytes", () => {
      const unknownBuf = Buffer.from([0x00, 0x01, 0x02, 0x03]);
      assert.equal(detectMimeType(unknownBuf), "application/octet-stream");
    });
  });

  // 3. Taxonomy Integrity in 3 Languages
  describe("Canonical Taxonomy 60-Leaf Structure & Localization", () => {
    it("has exactly 3 groups", () => {
      assert.equal(NAGRIK_TAXONOMY_V1.length, 3);
      assert.deepEqual(
        NAGRIK_TAXONOMY_V1.map((g) => g.groupId),
        ["roads_mobility", "waste_cleanliness_drainage", "utilities_lighting_greenery"]
      );
    });

    it("each group has exactly 4 categories (12 total)", () => {
      let totalCategories = 0;
      for (const group of NAGRIK_TAXONOMY_V1) {
        assert.equal(group.categories.length, 4);
        totalCategories += group.categories.length;
      }
      assert.equal(totalCategories, 12);
    });

    it("each category has exactly 5 options (4 specific + 1 other = 60 leaves total)", () => {
      let totalLeaves = 0;
      for (const group of NAGRIK_TAXONOMY_V1) {
        for (const cat of group.categories) {
          assert.equal(cat.options.length, 5);
          totalLeaves += cat.options.length;
        }
      }
      assert.equal(totalLeaves, 60);
    });

    it("all nodes provide non-empty English, Hindi, and Marathi labels", () => {
      for (const group of NAGRIK_TAXONOMY_V1) {
        assert.ok(group.label.en.length > 0);
        assert.ok(group.label.hi.length > 0);
        assert.ok(group.label.mr.length > 0);

        for (const cat of group.categories) {
          assert.ok(cat.label.en.length > 0);
          assert.ok(cat.label.hi.length > 0);
          assert.ok(cat.label.mr.length > 0);

          for (const opt of cat.options) {
            assert.ok(opt.label.en.length > 0);
            assert.ok(opt.label.hi.length > 0);
            assert.ok(opt.label.mr.length > 0);
          }
        }
      }
    });

    it("resolves labels correctly across languages", () => {
      const pothole = getTaxonomyIssueOption("roads_mobility", "road_surface", "pothole");
      assert.ok(pothole);
      assert.equal(getResolvedLabel(pothole.label, "en"), "Pothole");
      assert.equal(getResolvedLabel(pothole.label, "hi"), "सड़क पर गड्ढा");
      assert.equal(getResolvedLabel(pothole.label, "mr"), "रस्त्यावरील खड्डा");
    });
  });

  // 4. Deterministic Geospatial Matching Engine
  describe("Deterministic Haversine Distance & Candidate Classification", () => {
    const lat1 = 19.04751;
    const lon1 = 73.06994;

    it("classifies 0–5m as STRONG_CANDIDATE", () => {
      // Point 2m away
      const lat2 = 19.047528;
      const lon2 = 73.06994;
      const dist = calculateHaversineDistanceMetres(lat1, lon1, lat2, lon2);

      assert.ok(dist <= 5.0, `Expected distance <= 5m, got ${dist}`);
      assert.equal(classifyCandidateBand(dist), "STRONG_CANDIDATE");
    });

    it("classifies >5m and <=10m as POSSIBLE_CANDIDATE", () => {
      // Point ~7.8m away
      const lat2 = 19.04758;
      const lon2 = 73.06994;
      const dist = calculateHaversineDistanceMetres(lat1, lon1, lat2, lon2);

      assert.ok(dist > 5.0 && dist <= 10.0, `Expected 5m < dist <= 10m, got ${dist}`);
      assert.equal(classifyCandidateBand(dist), "POSSIBLE_CANDIDATE");
    });

    it("classifies >10m as NOT_A_CANDIDATE", () => {
      // Point ~50m away
      const lat2 = 19.04795;
      const lon2 = 73.06994;
      const dist = calculateHaversineDistanceMetres(lat1, lon1, lat2, lon2);

      assert.ok(dist > 10.0, `Expected dist > 10m, got ${dist}`);
      assert.equal(classifyCandidateBand(dist), "NOT_A_CANDIDATE");
    });
  });

  // 5. Cross-Citizen Isolation & State Cleanliness
  describe("Citizen Pseudonymity & Data Isolation", () => {
    it("ensures different Telegram users produce distinct pseudonymous hashes", () => {
      const citizen1 = deriveCitizenUserHash(888123);
      const citizen2 = deriveCitizenUserHash(888124);
      assert.notEqual(citizen1, citizen2);
    });

    it("ensures encrypted chat IDs decrypt to original values without leakage", () => {
      const chatId = "9988776655";
      const encrypted = encryptTelegramChatId(chatId);
      assert.ok(!encrypted.includes(chatId));

      const decrypted = decryptTelegramChatId(encrypted);
      assert.equal(decrypted, chatId);
    });
  });
});
