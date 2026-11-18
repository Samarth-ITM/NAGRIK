import crypto from "crypto";

/**
 * Nagrik Citizen Identity & Chat Encryption Library
 * Authority: TRD Section 8.1, 8.2, 8.3 & PRD Section 6.2
 *
 * Rules:
 * - Deterministic HMAC-SHA256 for pseudonymous citizen user hashing.
 * - AES-256-GCM authenticated encryption with a fresh 12-byte IV per encryption for Telegram chat IDs.
 * - Raw Telegram user IDs and chat IDs are NEVER stored in plaintext or logged.
 * - Uses Node.js native crypto module (no custom cryptography).
 */

/**
 * Derives a pseudonymous, deterministic citizen identity hash from a Telegram user ID.
 *
 * @param telegramUserId Numeric or string Telegram user ID
 * @param salt Secret salt string (minimum 16 bytes recommended)
 * @returns 64-character lowercase hex string representing HMAC-SHA256
 */
export function deriveCitizenUserHash(
  telegramUserId: number | string,
  salt?: string
): string {
  const effectiveSalt =
    salt ||
    process.env.TELEGRAM_USER_SALT ||
    process.env.CITIZEN_HMAC_SECRET;

  if (!effectiveSalt || effectiveSalt.trim() === "") {
    throw new Error(
      "Missing citizen identity salt: TELEGRAM_USER_SALT or CITIZEN_HMAC_SECRET must be configured."
    );
  }

  const rawId = String(telegramUserId).trim();
  if (!rawId) {
    throw new Error("Invalid Telegram user ID: empty or whitespace.");
  }

  return crypto
    .createHmac("sha256", effectiveSalt)
    .update(rawId, "utf8")
    .digest("hex");
}

/**
 * Resolves a 32-byte encryption key buffer from hex or utf8 string.
 */
function resolveEncryptionKey(key?: string): Buffer {
  const rawKey =
    key ||
    process.env.CITIZEN_ENCRYPTION_KEY ||
    process.env.TELEGRAM_CHAT_ID_ENCRYPTION_KEY;

  if (!rawKey || rawKey.trim() === "") {
    throw new Error(
      "Missing chat encryption key: CITIZEN_ENCRYPTION_KEY or TELEGRAM_CHAT_ID_ENCRYPTION_KEY must be configured."
    );
  }

  const trimmed = rawKey.trim();
  // If hex string of 64 chars (32 bytes)
  if (/^[0-9a-fA-F]{64}$/.test(trimmed)) {
    return Buffer.from(trimmed, "hex");
  }

  // If plain text key, derive exactly 32 bytes using SHA-256
  return crypto.createHash("sha256").update(trimmed, "utf8").digest();
}

/**
 * Encrypts a Telegram chat ID using AES-256-GCM with a fresh cryptographically secure 12-byte IV.
 *
 * Output format: `ivHex:authTagHex:ciphertextHex`
 *
 * @param chatId Telegram chat ID (number or string)
 * @param key Optional override encryption key (defaults to environment)
 * @returns Serialized encrypted payload string
 */
export function encryptTelegramChatId(
  chatId: number | string,
  key?: string
): string {
  const rawChatId = String(chatId).trim();
  if (!rawChatId) {
    throw new Error("Invalid Telegram chat ID: empty or whitespace.");
  }

  const keyBuffer = resolveEncryptionKey(key);
  // Fresh 12-byte IV for every single encryption operation (NIST SP 800-38D standard for GCM)
  const iv = crypto.randomBytes(12);

  const cipher = crypto.createCipheriv("aes-256-gcm", keyBuffer, iv);
  const ciphertext = Buffer.concat([
    cipher.update(rawChatId, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag(); // 16 bytes

  return `${iv.toString("hex")}:${authTag.toString("hex")}:${ciphertext.toString("hex")}`;
}

/**
 * Decrypts a serialized AES-256-GCM Telegram chat ID with authenticated tag verification.
 *
 * @param encryptedPayload Serialized string in format `ivHex:authTagHex:ciphertextHex`
 * @param key Optional override encryption key (defaults to environment)
 * @returns Plaintext chat ID string
 */
export function decryptTelegramChatId(
  encryptedPayload: string,
  key?: string
): string {
  if (!encryptedPayload || typeof encryptedPayload !== "string") {
    throw new Error("Invalid encrypted payload: empty or not a string.");
  }

  const parts = encryptedPayload.split(":");
  if (parts.length !== 3) {
    throw new Error(
      "Malformed encrypted payload: expected 3 colon-separated hex segments (iv:authTag:ciphertext)."
    );
  }

  const [ivHex, authTagHex, ciphertextHex] = parts;
  if (ivHex.length !== 24) {
    // 12 bytes = 24 hex characters
    throw new Error("Malformed encrypted payload: IV must be exactly 12 bytes (24 hex characters).");
  }
  if (authTagHex.length !== 32) {
    // 16 bytes = 32 hex characters
    throw new Error("Malformed encrypted payload: Auth tag must be exactly 16 bytes (32 hex characters).");
  }

  const keyBuffer = resolveEncryptionKey(key);
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");
  const ciphertext = Buffer.from(ciphertextHex, "hex");

  const decipher = crypto.createDecipheriv("aes-256-gcm", keyBuffer, iv);
  decipher.setAuthTag(authTag);

  try {
    const decrypted = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]);
    return decrypted.toString("utf8");
  } catch (err) {
    throw new Error(
      "Chat ID decryption failed: Authentication tag mismatch or corrupted ciphertext."
    );
  }
}

/**
 * Validates a webhook secret token using constant-time comparison.
 *
 * @param receivedHeader Value of X-Telegram-Bot-Api-Secret-Token from incoming HTTP request
 * @param expectedSecret Configured secret from environment
 * @returns boolean
 */
export function validateWebhookSecret(
  receivedHeader: string | null | undefined,
  expectedSecret?: string
): boolean {
  const secret = expectedSecret || process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!secret || secret.trim() === "") {
    return false;
  }
  if (!receivedHeader || typeof receivedHeader !== "string") {
    return false;
  }

  const receivedBuf = Buffer.from(receivedHeader, "utf8");
  const secretBuf = Buffer.from(secret, "utf8");

  if (receivedBuf.length !== secretBuf.length) {
    return false;
  }

  return crypto.timingSafeEqual(receivedBuf, secretBuf);
}
