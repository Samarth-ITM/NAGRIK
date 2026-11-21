import fs from "fs";
import path from "path";
import { writeFileAtomic } from "@/lib/security/fs-atomic";
import { appDb, isMissingTable, onMissingTable, storeMode } from "@/lib/storage/app-db";

export interface NgoProfile {
  name: string;
  logoUrl?: string;
  verified: boolean;
  contactEmail?: string;
  lastUpdated: string;
  /** Earlier names of this NGO. Past fixes recorded under these names display the current name. */
  previousNames?: string[];
}

const TABLE = "ngo_profile";
const DATA_DIR = path.join(process.cwd(), "data");
const PROFILE_FILE = path.join(DATA_DIR, "ngo-profile.json");

const DEFAULT_PROFILE: NgoProfile = {
  name: "Your NGO",
  logoUrl: "",
  verified: true,
  lastUpdated: new Date(0).toISOString(),
  previousNames: [],
};

// Short cache so pages that list many fixes don't query the profile for each one.
const CACHE_MS = 15_000;
const g = globalThis as unknown as { __nagrikNgoProfile?: { value: NgoProfile; at: number } };

/* ----------------------------------------------------------------- file backend */

function readFileProfile(): NgoProfile | null {
  try {
    if (!fs.existsSync(PROFILE_FILE)) return null;
    return JSON.parse(fs.readFileSync(PROFILE_FILE, "utf8"));
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------- db backend */

function fromRow(r: any): NgoProfile {
  return {
    name: r.name,
    logoUrl: r.logo_url || "",
    verified: Boolean(r.verified),
    contactEmail: r.contact_email || undefined,
    previousNames: Array.isArray(r.previous_names) ? r.previous_names : [],
    lastUpdated: r.updated_at,
  };
}

function toRow(p: NgoProfile) {
  return {
    id: 1,
    name: p.name,
    logo_url: p.logoUrl || "",
    verified: p.verified,
    contact_email: p.contactEmail || null,
    previous_names: p.previousNames || [],
    updated_at: new Date().toISOString(),
  };
}

async function readDbProfile(): Promise<NgoProfile | null | "missing"> {
  const { data, error } = await appDb().from(TABLE).select("*").eq("id", 1).maybeSingle();
  if (error) {
    if (isMissingTable(error)) return "missing";
    throw error;
  }
  if (data) return fromRow(data);

  // First run against the database: carry over the profile saved on this machine, if any.
  const local = readFileProfile();
  const seed = local ? { ...DEFAULT_PROFILE, ...local } : DEFAULT_PROFILE;
  const { data: inserted, error: insErr } = await appDb()
    .from(TABLE)
    .upsert(toRow(seed), { onConflict: "id" })
    .select("*")
    .single();
  if (insErr) throw insErr;
  return fromRow(inserted);
}

/* ---------------------------------------------------------------------- public */

/** The current NGO profile. Cached for a few seconds. */
export async function getNgoProfile(options: { fresh?: boolean } = {}): Promise<NgoProfile> {
  const cached = g.__nagrikNgoProfile;
  if (!options.fresh && cached && Date.now() - cached.at < CACHE_MS) return cached.value;

  let profile: NgoProfile | null = null;
  try {
    if (storeMode(TABLE) === "db") {
      const r = await readDbProfile();
      if (r === "missing") onMissingTable(TABLE);
      else profile = r;
    }
    if (!profile && storeMode(TABLE) === "file") profile = readFileProfile();
  } catch (err) {
    console.error("[ngo-store] read failed:", err instanceof Error ? err.message : err);
    if (cached) return cached.value;
  }

  const value = { ...DEFAULT_PROFILE, ...(profile || {}) };
  g.__nagrikNgoProfile = { value, at: Date.now() };
  return value;
}

export async function saveNgoProfile(update: Partial<NgoProfile>): Promise<NgoProfile> {
  const current = await getNgoProfile({ fresh: true });
  const newName = update.name?.trim() || current.name;

  // Remember the old name on rename, so earlier fixes follow the NGO's new name.
  const previous = new Set((current.previousNames || []).map((n) => n.trim()).filter(Boolean));
  if (current.name && current.name.trim().toLowerCase() !== newName.toLowerCase()) {
    previous.add(current.name.trim());
  }
  for (const n of Array.from(previous)) {
    if (n.toLowerCase() === newName.toLowerCase()) previous.delete(n);
  }

  const updated: NgoProfile = {
    ...current,
    ...update,
    name: newName,
    previousNames: Array.from(previous).slice(-10),
    lastUpdated: new Date().toISOString(),
  };

  if (storeMode(TABLE) === "db") {
    const { error } = await appDb().from(TABLE).upsert(toRow(updated), { onConflict: "id" });
    if (error) {
      if (!isMissingTable(error)) throw error;
      onMissingTable(TABLE);
    }
  }
  if (storeMode(TABLE) === "file") {
    writeFileAtomic(PROFILE_FILE, JSON.stringify(updated, null, 2));
  }

  g.__nagrikNgoProfile = { value: updated, at: Date.now() };
  return updated;
}

/** Name to display for a fix recorded under `recordedName`, given the current profile. */
export function displayNgoNameFor(profile: NgoProfile, recordedName: string | null | undefined): string | null {
  if (!recordedName) return null;
  const key = recordedName.trim().toLowerCase();
  const known = [profile.name, ...(profile.previousNames || [])].map((n) => (n || "").trim().toLowerCase());
  return known.includes(key) ? profile.name : recordedName;
}

/**
 * Name to display for a fix recorded under `recordedName`.
 * Uses the cached profile; call `await getNgoProfile()` earlier in the request to warm it.
 */
export function displayNgoName(recordedName: string | null | undefined): string | null {
  const profile = g.__nagrikNgoProfile?.value || DEFAULT_PROFILE;
  return displayNgoNameFor(profile, recordedName);
}
