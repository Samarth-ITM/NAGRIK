import { describe, it, expect, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import {
  deriveCitizenUserHash,
  encryptTelegramChatId,
  decryptTelegramChatId,
  validateWebhookSecret,
} from "../crypto";

const TEST_SALT = "test_salt_nagrik_civic_salt_123456789";
const TEST_KEY = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

describe("Citizen Identity & Cryptography Suite", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env.TELEGRAM_USER_SALT = TEST_SALT;
    process.env.CITIZEN_ENCRYPTION_KEY = TEST_KEY;
    process.env.TELEGRAM_WEBHOOK_SECRET = "secret_token_12345";
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("produces deterministic HMAC-SHA256 for the same user ID", () => {
    const hash1 = deriveCitizenUserHash(123456789);
    const hash2 = deriveCitizenUserHash("123456789");
    const hash3 = deriveCitizenUserHash(123456789, TEST_SALT);

    assert.equal(hash1, hash2);
    assert.equal(hash1, hash3);
    assert.match(hash1, /^[0-9a-f]{64}$/);
    assert.ok(!hash1.includes("123456789"), "Hash must never leak plaintext user ID");
  });

  it("produces distinct pseudonymous identities for different user IDs", () => {
    const hashA = deriveCitizenUserHash(10001);
    const hashB = deriveCitizenUserHash(10002);
    assert.notEqual(hashA, hashB);
  });

  it("throws when salt is missing or empty", () => {
    delete process.env.TELEGRAM_USER_SALT;
    delete process.env.CITIZEN_HMAC_SECRET;
    assert.throws(
      () => deriveCitizenUserHash(12345),
      /Missing citizen identity salt/
    );
  });

  it("encrypts and decrypts Telegram chat ID reliably (round-trip)", () => {
    const chatId = 9876543210;
    const encrypted = encryptTelegramChatId(chatId);
    assert.ok(encrypted.includes(":"));
    assert.ok(!encrypted.includes("9876543210"), "Ciphertext must not contain plaintext chat ID");

    const decrypted = decryptTelegramChatId(encrypted);
    assert.equal(decrypted, "9876543210");
  });

  it("generates a fresh random IV on every encryption call (never reuses nonces)", () => {
    const chatId = "9876543210";
    const enc1 = encryptTelegramChatId(chatId);
    const enc2 = encryptTelegramChatId(chatId);

    assert.notEqual(enc1, enc2);
    const iv1 = enc1.split(":")[0];
    const iv2 = enc2.split(":")[0];
    assert.notEqual(iv1, iv2, "IVs must be distinct across encryption operations");
    assert.equal(iv1.length, 24, "IV must be exactly 12 bytes (24 hex characters)");
  });

  it("rejects tampered ciphertext with an authentication failure", () => {
    const encrypted = encryptTelegramChatId("55555555");
    const parts = encrypted.split(":");
    // Tamper with the ciphertext segment
    const tamperedCipher = parts[2].slice(0, -2) + (parts[2].endsWith("0") ? "1" : "0");
    const tamperedPayload = `${parts[0]}:${parts[1]}:${tamperedCipher}`;

    assert.throws(
      () => decryptTelegramChatId(tamperedPayload),
      /Chat ID decryption failed: Authentication tag mismatch/
    );
  });

  it("rejects tampered auth tag", () => {
    const encrypted = encryptTelegramChatId("55555555");
    const parts = encrypted.split(":");
    // Tamper with the auth tag
    const tamperedTag = "ff" + parts[1].slice(2);
    const tamperedPayload = `${parts[0]}:${tamperedTag}:${parts[2]}`;

    assert.throws(
      () => decryptTelegramChatId(tamperedPayload),
      /Chat ID decryption failed: Authentication tag mismatch/
    );
  });

  it("rejects malformed payload structure", () => {
    assert.throws(() => decryptTelegramChatId("not-a-valid-payload"), /Malformed encrypted payload/);
    assert.throws(() => decryptTelegramChatId("part1:part2"), /Malformed encrypted payload/);
    assert.throws(() => decryptTelegramChatId("badiv:0123456789abcdef0123456789abcdef:ciphertext"), /IV must be exactly 12 bytes/);
  });

  it("throws when encryption key is missing", () => {
    delete process.env.CITIZEN_ENCRYPTION_KEY;
    delete process.env.TELEGRAM_CHAT_ID_ENCRYPTION_KEY;
    assert.throws(
      () => encryptTelegramChatId("12345"),
      /Missing chat encryption key/
    );
  });

  it("validates Telegram webhook secret token using constant-time comparison", () => {
    const secret = "correct_secret_token_12345";
    process.env.TELEGRAM_WEBHOOK_SECRET = secret;

    assert.equal(validateWebhookSecret(secret), true);
    assert.equal(validateWebhookSecret("wrong_secret_token"), false);
    assert.equal(validateWebhookSecret("correct_secret_token_1234"), false); // different length
    assert.equal(validateWebhookSecret(null), false);
    assert.equal(validateWebhookSecret(undefined), false);
    assert.equal(validateWebhookSecret(""), false);
  });
});
