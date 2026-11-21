import fs from "fs";
import path from "path";
import crypto from "crypto";
import { writeFileAtomic } from "@/lib/security/fs-atomic";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { displayNgoName, getNgoProfile } from "@/lib/ngo/ngo-store";
import { resolveJurisdiction } from "@/lib/geo/kharghar-jurisdiction";
import { appDb, isMissingTable, onMissingTable, storeMode } from "@/lib/storage/app-db";

export interface CitizenAccount {
  name: string;
  normalizedName: string;
  passwordHash: string;
  salt: string;
  /** "scrypt" for current hashes; missing means the old PBKDF2 (1,000 rounds) hash. */
  hashAlgo?: "scrypt";
  telegramUserHash?: string;
  telegramUserId?: number;
  createdAt: string;
  lastLoginAt: string;
}

const TABLE = "citizen_accounts";
const DATA_DIR = path.join(process.cwd(), "data");
const ACCOUNTS_FILE = path.join(DATA_DIR, "citizen-accounts.json");

/** Old builds seeded a shared demo account. It is never accepted. */
const RETIRED_DEMO_HASHES = new Set(["demo_citizen_hash_synthetic_kharghar"]);

export const PASSWORD_MIN_LENGTH = 6;
export const PASSWORD_MAX_LENGTH = 128;
const COMMON_PASSWORDS = new Set([
  "123456", "1234567", "12345678", "123456789", "1234567890", "111111", "000000", "123123",
  "654321", "password", "password1", "pass1234", "qwerty", "qwerty123", "abc123", "abcdef",
  "iloveyou", "admin", "admin123", "nagrik", "nagrik123", "kharghar", "india123", "welcome",
]);

export class CitizenNameTakenError extends Error {
  constructor() {
    super("NAME_TAKEN");
    this.name = "CitizenNameTakenError";
  }
}

/* ======================================================================== storage */

/** Accounts live in Supabase (citizen_accounts). data/citizen-accounts.json is a local-dev fallback. */
interface AccountRepo {
  findByHash(hash: string): Promise<CitizenAccount | null>;
  findByName(normalizedName: string): Promise<CitizenAccount | null>;
  /** Insert or replace the account for account.telegramUserHash. Throws CitizenNameTakenError. */
  save(account: CitizenAccount): Promise<void>;
}

function usable(a: CitizenAccount | null | undefined): CitizenAccount | null {
  if (!a || typeof a.normalizedName !== "string") return null;
  if (RETIRED_DEMO_HASHES.has(a.telegramUserHash || "")) return null;
  return a;
}

/* ---- file (local development only) ---- */

function readFileAccounts(): CitizenAccount[] {
  try {
    if (!fs.existsSync(ACCOUNTS_FILE)) return [];
    const parsed = JSON.parse(fs.readFileSync(ACCOUNTS_FILE, "utf8"));
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error("Error loading citizen accounts:", err instanceof Error ? err.message : err);
    return [];
  }
}

const fileRepo: AccountRepo = {
  async findByHash(hash) {
    return usable(readFileAccounts().find((a) => a.telegramUserHash === hash));
  },
  async findByName(name) {
    return usable(readFileAccounts().find((a) => a.normalizedName === name));
  },
  async save(account) {
    const accounts = readFileAccounts().filter((a) => !RETIRED_DEMO_HASHES.has(a.telegramUserHash || ""));
    const byName = accounts.find((a) => a.normalizedName === account.normalizedName);
    if (byName && byName.telegramUserHash !== account.telegramUserHash) throw new CitizenNameTakenError();
    const idx = accounts.findIndex((a) => a.telegramUserHash === account.telegramUserHash);
    if (idx >= 0) accounts[idx] = account;
    else accounts.push(account);
    writeFileAtomic(ACCOUNTS_FILE, JSON.stringify(accounts, null, 2));
  },
};

/* ---- Supabase ---- */

function fromRow(r: any): CitizenAccount {
  return {
    name: r.name,
    normalizedName: r.normalized_name,
    passwordHash: r.password_hash,
    salt: r.salt,
    hashAlgo: r.hash_algo === "scrypt" ? "scrypt" : undefined,
    telegramUserHash: r.telegram_user_hash,
    telegramUserId: r.telegram_user_id ?? undefined,
    createdAt: r.created_at,
    lastLoginAt: r.last_login_at,
  };
}

function toRow(a: CitizenAccount) {
  return {
    telegram_user_hash: a.telegramUserHash,
    name: a.name,
    normalized_name: a.normalizedName,
    password_hash: a.passwordHash,
    salt: a.salt,
    hash_algo: a.hashAlgo || null,
    telegram_user_id: a.telegramUserId ?? null,
    created_at: a.createdAt || new Date().toISOString(),
    last_login_at: a.lastLoginAt || new Date().toISOString(),
  };
}

class MissingTable extends Error {}

const g = globalThis as unknown as { __nagrikAccountsImported?: boolean };

/** One-time: copy accounts saved on this machine (data/citizen-accounts.json) into Supabase. */
async function importLocalAccountsOnce(): Promise<void> {
  if (g.__nagrikAccountsImported) return;
  g.__nagrikAccountsImported = true;
  const local = readFileAccounts().filter((a) => usable(a) && a.telegramUserHash);
  if (!local.length) return;
  for (const a of local) {
    const { data: byHash } = await appDb().from(TABLE).select("telegram_user_hash").eq("telegram_user_hash", a.telegramUserHash).limit(1);
    if (byHash && byHash.length) continue;
    const { data: byName } = await appDb().from(TABLE).select("telegram_user_hash").eq("normalized_name", a.normalizedName).limit(1);
    if (byName && byName.length) continue;
    const { error } = await appDb().from(TABLE).insert(toRow(a));
    if (error && !/duplicate key/i.test(String(error.message))) {
      console.error("[citizen-store] import failed for one account:", error.message);
    }
  }
  console.info(`[citizen-store] checked ${local.length} local account(s) for import into Supabase.`);
}

async function dbQuery(column: "telegram_user_hash" | "normalized_name", value: string) {
  await importLocalAccountsOnce().catch(() => {});
  const { data, error } = await appDb().from(TABLE).select("*").eq(column, value).maybeSingle();
  if (error) {
    if (isMissingTable(error)) throw new MissingTable();
    throw error;
  }
  return data ? usable(fromRow(data)) : null;
}

const dbRepo: AccountRepo = {
  findByHash: (hash) => dbQuery("telegram_user_hash", hash),
  findByName: (name) => dbQuery("normalized_name", name),
  async save(account) {
    const { error } = await appDb().from(TABLE).upsert(toRow(account), { onConflict: "telegram_user_hash" });
    if (error) {
      if (isMissingTable(error)) throw new MissingTable();
      // Unique index on normalized_name: someone else owns this name.
      if (String(error.code) === "23505" || /duplicate key/i.test(String(error.message))) {
        throw new CitizenNameTakenError();
      }
      throw error;
    }
  },
};

/** Runs `fn` on the right backend, switching to files locally if the table isn't there yet. */
async function withRepo<T>(fn: (repo: AccountRepo) => Promise<T>): Promise<T> {
  if (storeMode(TABLE) === "db") {
    try {
      return await fn(dbRepo);
    } catch (err) {
      if (!(err instanceof MissingTable)) throw err;
      onMissingTable(TABLE);
    }
  }
  return fn(fileRepo);
}

/* ======================================================================= hashing */

/** Current hash: scrypt (N=16384, r=8, p=1), 32-byte key. */
function hashPassword(password: string, salt: string): string {
  return crypto.scryptSync(password, salt, 32, { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }).toString("hex");
}

/** Hash used by accounts created before the upgrade. Only for verifying and then re-hashing. */
function legacyHashPassword(password: string, salt: string): string {
  return crypto.pbkdf2Sync(password, salt, 1000, 32, "sha256").toString("hex");
}

function safeEqualHex(a: string, b: string): boolean {
  const ba = Buffer.from(a, "hex");
  const bb = Buffer.from(b, "hex");
  return ba.length === bb.length && ba.length > 0 && crypto.timingSafeEqual(ba, bb);
}

export function normalizeCitizenName(name: string): string {
  return name.normalize("NFKC").replace(/\s+/g, " ").trim().toLowerCase();
}

/** Returns a reason the password is not acceptable, or null if it is fine. */
export function passwordProblem(password: string): string | null {
  if (password.length < PASSWORD_MIN_LENGTH) return `at least ${PASSWORD_MIN_LENGTH} characters`;
  if (password.length > PASSWORD_MAX_LENGTH) return `at most ${PASSWORD_MAX_LENGTH} characters`;
  if (COMMON_PASSWORDS.has(password.toLowerCase())) return "not a common password like 123456";
  if (/^(.)\1+$/.test(password)) return "not the same character repeated";
  return null;
}

/** Cleans a display name typed on the bot. Returns null if it isn't usable. */
export function cleanCitizenName(name: string): string | null {
  const clean = name.normalize("NFKC").replace(/[\u0000-\u001f<>]/g, "").replace(/\s+/g, " ").trim();
  if (clean.length < 2 || clean.length > 60) return null;
  return clean;
}

/* ======================================================================== public */

export async function getCitizenByTelegramHash(hash: string): Promise<CitizenAccount | null> {
  if (!hash || RETIRED_DEMO_HASHES.has(hash)) return null;
  return withRepo((r) => r.findByHash(hash));
}

export async function getCitizenByName(name: string): Promise<CitizenAccount | null> {
  const normalized = normalizeCitizenName(name || "");
  if (!normalized) return null;
  return withRepo((r) => r.findByName(normalized));
}

/** True when nobody else (another Telegram account) has registered this name. */
export async function isCitizenNameAvailable(name: string, telegramUserHash: string): Promise<boolean> {
  const existing = await getCitizenByName(name);
  return !existing || existing.telegramUserHash === telegramUserHash;
}

/**
 * Registers a citizen, or updates the account that belongs to the same Telegram user.
 * An account is owned by its Telegram identity: a different Telegram user can never
 * take over an existing name (throws CitizenNameTakenError).
 */
export async function registerCitizen(params: {
  name: string;
  password: string;
  telegramUserHash: string;
  telegramUserId?: number;
}): Promise<CitizenAccount> {
  if (!params.telegramUserHash) throw new Error("telegramUserHash is required");
  const display = cleanCitizenName(params.name);
  if (!display) throw new Error("INVALID_NAME");
  if (passwordProblem(params.password)) throw new Error("WEAK_PASSWORD");

  const normalized = normalizeCitizenName(display);
  const byName = await getCitizenByName(normalized);
  if (byName && byName.telegramUserHash !== params.telegramUserHash) throw new CitizenNameTakenError();

  const existing = await getCitizenByTelegramHash(params.telegramUserHash);
  const salt = crypto.randomBytes(16).toString("hex");
  const now = new Date().toISOString();
  const account: CitizenAccount = {
    name: display,
    normalizedName: normalized,
    passwordHash: hashPassword(params.password, salt),
    salt,
    hashAlgo: "scrypt",
    telegramUserHash: params.telegramUserHash,
    telegramUserId: params.telegramUserId,
    createdAt: existing?.createdAt || now,
    lastLoginAt: now,
  };
  await withRepo((r) => r.save(account));
  return account;
}

function checkPassword(account: CitizenAccount, attempt: string): { ok: boolean; upgrade: boolean } {
  if (account.hashAlgo === "scrypt") {
    return { ok: safeEqualHex(hashPassword(attempt, account.salt), account.passwordHash), upgrade: false };
  }
  // Old accounts saved the trimmed password with PBKDF2 x1000.
  const ok = safeEqualHex(legacyHashPassword(attempt, account.salt), account.passwordHash);
  return { ok, upgrade: ok };
}

async function verifyAccount(
  account: CitizenAccount | null,
  passwordAttempt: string
): Promise<{ success: boolean; account?: CitizenAccount }> {
  if (typeof passwordAttempt !== "string" || !passwordAttempt || passwordAttempt.length > 200) {
    return { success: false };
  }
  // The bot stores passwords without surrounding spaces; match that on every sign-in path.
  const attempt = passwordAttempt.trim();
  if (!account) {
    // Spend about the same time as a real check so unknown names aren't detectable by timing.
    hashPassword(attempt, "0000000000000000");
    return { success: false };
  }

  const { ok, upgrade } = checkPassword(account, attempt);
  if (!ok) return { success: false };

  const updated: CitizenAccount = { ...account, lastLoginAt: new Date().toISOString() };
  if (upgrade) {
    // Re-hash old PBKDF2 x1000 passwords with scrypt on the first successful sign-in.
    updated.salt = crypto.randomBytes(16).toString("hex");
    updated.passwordHash = hashPassword(attempt, updated.salt);
    updated.hashAlgo = "scrypt";
  }
  try {
    await withRepo((r) => r.save(updated));
  } catch (err) {
    // Sign-in still succeeds if only the "last login" update fails.
    console.error("[citizen-store] could not update account after sign-in:", err instanceof Error ? err.message : err);
  }
  return { success: true, account: updated };
}

/** Web sign-in: verifies by registered name only. */
export async function verifyCitizenPassword(
  name: string,
  passwordAttempt: string
): Promise<{ success: boolean; account?: CitizenAccount }> {
  return verifyAccount(await getCitizenByName(name || ""), passwordAttempt);
}

/** Bot unlock: verifies the account that belongs to this Telegram user. */
export async function verifyCitizenPasswordByTelegramHash(
  telegramUserHash: string,
  passwordAttempt: string
): Promise<{ success: boolean; account?: CitizenAccount }> {
  return verifyAccount(await getCitizenByTelegramHash(telegramUserHash), passwordAttempt);
}

/**
 * Fetches tickets reported by a citizen from Supabase
 */
export async function getCitizenTickets(telegramHashOrName: string): Promise<any[]> {
  try {
    const supabase = createAdminSupabaseClient();
    // Prefer the Telegram identity; the name lookup is kept for older callers.
    await getNgoProfile(); // warms the cache used by displayNgoName below
    const account =
      (await getCitizenByTelegramHash(telegramHashOrName)) || (await getCitizenByName(telegramHashOrName));
    if (!account?.telegramUserHash) return [];

    const { data: reports, error } = await (supabase as any)
      .from("reports")
      .select(`
        id,
        ticket_code,
        citizen_contact_id,
        group_id,
        category_id,
        issue_type_id,
        description_private,
        latitude,
        longitude,
        review_status,
        public_summary,
        created_at,
        evidence (
          id,
          storage_path_private,
          mime_type
        )
      `)
      .order("created_at", { ascending: false });

    if (error || !reports) {
      return [];
    }

    // Only ever return this citizen's own reports. If we can't match them, return none
    // (previously this fell back to ALL reports, leaking other citizens' descriptions/photos).
    let userReports: any[] = [];
    if (account?.telegramUserHash) {
      const { data: contacts } = await (supabase as any)
        .from("citizen_contacts")
        .select("id")
        .eq("telegram_user_hash", account.telegramUserHash)
        .limit(1);

      if (contacts && contacts.length > 0) {
        const contactId = contacts[0].id;
        userReports = reports.filter((r: any) => r.citizen_contact_id === contactId);
      }
    }

    const items = [];
    for (const r of userReports) {
      let photoUrl = null;
      if (r.evidence && r.evidence.length > 0) {
        const rawPath = r.evidence[0].storage_path_private;
        if (rawPath) {
          try {
            const { data: signed } = await supabase.storage
              .from("evidence-private")
              .createSignedUrl(rawPath, 3600);
            photoUrl = signed?.signedUrl || null;
          } catch (e) {
            // ignore signed url error
          }
        }
      }

      let fixedBy = null;
      let resolutionNote = null;
      let afterPhotoUrl = null;
      if (r.public_summary) {
        try {
          const meta =
            typeof r.public_summary === "string"
              ? JSON.parse(r.public_summary)
              : r.public_summary;
          fixedBy = displayNgoName(meta.fixed_by) || null;
          resolutionNote = meta.resolution_note || null;
          afterPhotoUrl = meta.after_photo_url || null;
        } catch (e) {}
      }

      const jur = resolveJurisdiction(
        Number(r.latitude) || 19.0435,
        Number(r.longitude) || 73.0680,
        r.description_private || ""
      );

      items.push({
        id: r.id,
        ticket_code: r.ticket_code,
        category: r.category_id?.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c: string) => c.toUpperCase()) || "Civic issue",
        description: r.description_private,
        review_status: r.review_status,
        status_label:
          r.review_status === "verified"
            ? "RESOLUTION SUBMITTED 🛠️"
            : r.review_status === "resolved"
            ? "RESOLVED ✅"
            : "IN PROGRESS ⚠️",
        photo_url: photoUrl,
        fixed_by: fixedBy,
        resolution_note: resolutionNote,
        after_photo_url: afterPhotoUrl,
        ward: jur.wardName,
        ward_code: jur.wardCode,
        police_station: jur.policeStation,
        police_phone: jur.policePhone,
        police_address: jur.policeAddress,
        beat_chowki: jur.beatChowki,
        created_at: r.created_at,
      });
    }

    return items;
  } catch (err) {
    console.error("getCitizenTickets error:", err);
    return [];
  }
}
