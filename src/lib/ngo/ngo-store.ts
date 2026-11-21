import fs from "fs";
import path from "path";

export interface NgoProfile {
  name: string;
  logoUrl?: string;
  verified: boolean;
  contactEmail?: string;
  lastUpdated: string;
  /** Earlier names of this NGO. Past fixes recorded under these names display the current name. */
  previousNames?: string[];
}

const DATA_DIR = path.join(process.cwd(), "data");
const PROFILE_FILE = path.join(DATA_DIR, "ngo-profile.json");

const DEFAULT_PROFILE: NgoProfile = {
  name: "Kharghar Citizens Welfare Forum",
  logoUrl: "",
  verified: true,
  contactEmail: "action@khargharwelfare.org",
  lastUpdated: new Date().toISOString(),
};

function ensureStorage(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(PROFILE_FILE)) {
    fs.writeFileSync(PROFILE_FILE, JSON.stringify(DEFAULT_PROFILE, null, 2), "utf8");
  }
}

export function getNgoProfile(): NgoProfile {
  ensureStorage();
  try {
    const raw = fs.readFileSync(PROFILE_FILE, "utf8");
    return JSON.parse(raw);
  } catch (err) {
    console.error("Error reading NGO profile:", err);
    return DEFAULT_PROFILE;
  }
}

export function saveNgoProfile(profile: Partial<NgoProfile>): NgoProfile {
  ensureStorage();
  const current = getNgoProfile();
  const newName = profile.name?.trim() || current.name;

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
    ...profile,
    name: newName,
    previousNames: Array.from(previous),
    lastUpdated: new Date().toISOString(),
  };
  fs.writeFileSync(PROFILE_FILE, JSON.stringify(updated, null, 2), "utf8");
  return updated;
}

/**
 * Name to display for a fix recorded under `recordedName`.
 * If it was recorded under the NGO's current or a previous name, show the current name.
 */
export function displayNgoName(recordedName: string | null | undefined): string | null {
  if (!recordedName) return null;
  try {
    const profile = getNgoProfile();
    const key = recordedName.trim().toLowerCase();
    const known = [profile.name, ...(profile.previousNames || [])].map((n) => (n || "").trim().toLowerCase());
    return known.includes(key) ? profile.name : recordedName;
  } catch {
    return recordedName;
  }
}
