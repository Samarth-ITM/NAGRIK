import fs from "fs";
import path from "path";
import crypto from "crypto";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { displayNgoName } from "@/lib/ngo/ngo-store";

export interface CitizenAccount {
  name: string;
  normalizedName: string;
  passwordHash: string;
  salt: string;
  telegramUserHash?: string;
  telegramUserId?: number;
  createdAt: string;
  lastLoginAt: string;
}

const DATA_DIR = path.join(process.cwd(), "data");
const ACCOUNTS_FILE = path.join(DATA_DIR, "citizen-accounts.json");

function ensureStorage(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(ACCOUNTS_FILE)) {
    // Seed with demo citizen
    const demoSalt = crypto.randomBytes(16).toString("hex");
    const demoHash = hashPassword("pass1234", demoSalt);
    const initial: CitizenAccount[] = [
      {
        name: "Daksh Srivastava",
        normalizedName: "daksh srivastava",
        passwordHash: demoHash,
        salt: demoSalt,
        telegramUserHash: "demo_citizen_hash_synthetic_kharghar",
        createdAt: new Date().toISOString(),
        lastLoginAt: new Date().toISOString(),
      },
    ];
    fs.writeFileSync(ACCOUNTS_FILE, JSON.stringify(initial, null, 2), "utf8");
  }
}

function loadAccounts(): CitizenAccount[] {
  ensureStorage();
  try {
    const raw = fs.readFileSync(ACCOUNTS_FILE, "utf8");
    return JSON.parse(raw);
  } catch (err) {
    console.error("Error loading citizen accounts:", err);
    return [];
  }
}

function saveAccounts(accounts: CitizenAccount[]): void {
  ensureStorage();
  fs.writeFileSync(ACCOUNTS_FILE, JSON.stringify(accounts, null, 2), "utf8");
}

function hashPassword(password: string, salt: string): string {
  return crypto.pbkdf2Sync(password, salt, 1000, 32, "sha256").toString("hex");
}

/**
 * Retrieves a citizen account by their Telegram user hash
 */
export function getCitizenByTelegramHash(hash: string): CitizenAccount | null {
  const accounts = loadAccounts();
  return accounts.find((a) => a.telegramUserHash === hash) || null;
}

/**
 * Retrieves a citizen account by their full name (case-insensitive)
 */
export function getCitizenByName(name: string): CitizenAccount | null {
  const accounts = loadAccounts();
  const normalized = name.trim().toLowerCase();
  return accounts.find((a) => a.normalizedName === normalized) || null;
}

/**
 * Registers or updates a citizen account with name, password, and Telegram hash
 */
export function registerCitizen(params: {
  name: string;
  password: string;
  telegramUserHash?: string;
  telegramUserId?: number;
}): CitizenAccount {
  const accounts = loadAccounts();
  const normalized = params.name.trim().toLowerCase();
  const salt = crypto.randomBytes(16).toString("hex");
  const passwordHash = hashPassword(params.password.trim(), salt);

  const existingIdx = accounts.findIndex(
    (a) =>
      a.normalizedName === normalized ||
      (params.telegramUserHash && a.telegramUserHash === params.telegramUserHash)
  );

  const newAccount: CitizenAccount = {
    name: params.name.trim(),
    normalizedName: normalized,
    passwordHash,
    salt,
    telegramUserHash: params.telegramUserHash,
    telegramUserId: params.telegramUserId,
    createdAt: existingIdx >= 0 ? accounts[existingIdx].createdAt : new Date().toISOString(),
    lastLoginAt: new Date().toISOString(),
  };

  if (existingIdx >= 0) {
    accounts[existingIdx] = newAccount;
  } else {
    accounts.push(newAccount);
  }

  saveAccounts(accounts);
  return newAccount;
}

/**
 * Verifies citizen password by name or Telegram hash
 */
export function verifyCitizenPassword(
  nameOrHash: string,
  passwordAttempt: string
): { success: boolean; account?: CitizenAccount } {
  const accounts = loadAccounts();
  const cleanTarget = nameOrHash.trim().toLowerCase();

  const account = accounts.find(
    (a) => a.normalizedName === cleanTarget || a.telegramUserHash === nameOrHash
  );

  if (!account) {
    return { success: false };
  }

  const computedHash = hashPassword(passwordAttempt.trim(), account.salt);
  if (computedHash === account.passwordHash) {
    account.lastLoginAt = new Date().toISOString();
    saveAccounts(accounts);
    return { success: true, account };
  }

  return { success: false };
}

/**
 * Fetches tickets reported by a citizen from Supabase
 */
export async function getCitizenTickets(nameOrHash: string): Promise<any[]> {
  try {
    const supabase = createAdminSupabaseClient();
    const account = getCitizenByName(nameOrHash) || getCitizenByTelegramHash(nameOrHash);

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
              .createSignedUrl(rawPath, 86400);
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
        created_at: r.created_at,
      });
    }

    return items;
  } catch (err) {
    console.error("getCitizenTickets error:", err);
    return [];
  }
}
