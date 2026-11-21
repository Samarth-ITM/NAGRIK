import { createHash } from "node:crypto";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { displayNgoName, getNgoProfile } from "@/lib/ngo/ngo-store";
import { DEMO_SPOTS } from "@/lib/demo/demo-issues";

/**
 * Public projection of a completed repair. Deliberately excludes citizen
 * descriptions, citizen photos, ticket codes and exact coordinates.
 */
export interface PublicFix {
  id: string;
  ngoName: string;
  ngoLogoUrl: string | null;
  issueLabel: string;
  note: string | null;
  afterPhotoUrl: string | null;
  fixedAt: string | null;
  stage: "verified" | "submitted";
  isSample: boolean;
  /** True when this fix belongs to the saved NGO profile; client uses the top-level profileLogoUrl. */
  usesProfileLogo: boolean;
}

function titleCase(raw: string | null | undefined, fallback: string): string {
  if (!raw) return fallback;
  return raw
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Uploaded logos are stored as data URLs; allow raster/SVG images up to ~400 KB. */
function safeLogoUrl(url: unknown): string | null {
  if (typeof url !== "string") return null;
  if (/^https?:\/\//i.test(url) && url.length <= 2048) return url;
  if (/^data:image\/(png|jpe?g|webp|gif|svg\+xml);base64,/i.test(url) && url.length <= 400_000) return url;
  return null;
}

/** Only short http(s) URLs are safe to ship publicly (rejects huge base64 data URLs). */
function safeImageUrl(url: unknown): string | null {
  if (typeof url !== "string") return null;
  if (url.length > 2048) return null;
  return /^https?:\/\//i.test(url) ? url : null;
}

function clip(text: unknown, max = 180): string | null {
  if (typeof text !== "string" || !text.trim()) return null;
  const t = text.trim();
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}

export interface PublicFixesPayload {
  success: true;
  source: "live" | "sample";
  profileLogoUrl: string | null;
  fixes: PublicFix[];
}

/** How long a computed list is reused before the database is asked again. */
const CACHE_MS = 60_000;
/** A slow database must never hold the homepage hostage. */
const DB_TIMEOUT_MS = 4_000;
const MAX_FIXES = 12;

const g = globalThis as unknown as {
  __nagrikPublicFixes?: { at: number; value: PublicFixesPayload };
  __nagrikPublicFixesPending?: Promise<PublicFixesPayload>;
};

function withTimeout<T>(p: PromiseLike<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`timed out after ${ms} ms`)), ms);
    Promise.resolve(p).then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      }
    );
  });
}

/** Public, cacheable URL for the NGO logo (the logo itself is stored as a data URL). */
export function publicLogoUrl(raw: unknown): string | null {
  const safe = safeLogoUrl(raw);
  if (!safe) return null;
  // Remote URLs and (small) SVGs are used as they are; raster data URLs get a real image URL.
  if (/^https?:\/\//i.test(safe) || /^data:image\/svg\+xml/i.test(safe)) return safe;
  const v = createHash("sha1").update(safe).digest("hex").slice(0, 12);
  return `/api/public/ngo-logo?v=${v}`;
}

async function compute(): Promise<PublicFixesPayload> {
  let profile: { name: string; logoUrl?: string } = { name: "Partner NGO" };
  try {
    profile = await withTimeout(getNgoProfile(), DB_TIMEOUT_MS);
  } catch {
    /* keep default */
  }

  const fixes: PublicFix[] = [];
  let dbOk = false;

  try {
    const supabase = createAdminSupabaseClient();
    const { data: reports, error } = await withTimeout<any>(
      (supabase as any)
        .from("reports")
        .select("id, issue_type_id, category_id, review_status, public_summary, updated_at")
        .in("review_status", ["verified", "resolved"])
        .not("public_summary", "is", null)
        .order("updated_at", { ascending: false })
        .limit(MAX_FIXES),
      DB_TIMEOUT_MS
    );

    if (!error && Array.isArray(reports)) {
      dbOk = true;
      for (const r of reports) {
        let meta: any = null;
        try {
          meta = typeof r.public_summary === "string" ? JSON.parse(r.public_summary) : r.public_summary;
        } catch {
          meta = null;
        }
        if (!meta || !meta.fixed_by) continue;

        const ngoName = (displayNgoName(String(meta.fixed_by)) || "Partner NGO").slice(0, 80);
        fixes.push({
          id: String(r.id),
          ngoName,
          ngoLogoUrl: null,
          usesProfileLogo: ngoName.trim().toLowerCase() === profile.name.trim().toLowerCase(),
          issueLabel: titleCase(r.issue_type_id || r.category_id, "Civic repair"),
          note: clip(meta.resolution_note),
          afterPhotoUrl: safeImageUrl(meta.after_photo_url),
          fixedAt: meta.fixed_at || r.updated_at || null,
          stage: r.review_status === "resolved" ? "verified" : "submitted",
          isSample: false,
        });
      }
    }
  } catch (err) {
    console.warn("[public/fixes] database unavailable, using samples:", err instanceof Error ? err.message : err);
  }

  if (fixes.length === 0) {
    for (const d of DEMO_SPOTS) {
      if (d.status !== "RESOLVED" && d.status !== "RESOLUTION_SUBMITTED") continue;
      fixes.push({
        id: d.id,
        ngoName: profile.name,
        ngoLogoUrl: null,
        usesProfileLogo: true,
        issueLabel: d.title,
        note: clip(d.resolution_note),
        afterPhotoUrl: null,
        fixedAt: d.resolved_at || d.updated_at,
        stage: d.status === "RESOLVED" ? "verified" : "submitted",
        isSample: true,
      });
    }
  }

  const value: PublicFixesPayload = {
    success: true,
    source: fixes.some((f) => !f.isSample) ? "live" : "sample",
    profileLogoUrl: publicLogoUrl(profile.logoUrl),
    fixes,
  };
  // Only remember a result that really came from the database for the full minute.
  if (dbOk) g.__nagrikPublicFixes = { at: Date.now(), value };
  return value;
}

/**
 * Recent repairs for the homepage. Served from memory when fresh; when stale,
 * the old list is returned at once and refreshed in the background.
 */
export async function loadPublicFixes(): Promise<PublicFixesPayload> {
  const cached = g.__nagrikPublicFixes;
  const refresh = () => {
    if (!g.__nagrikPublicFixesPending) {
      g.__nagrikPublicFixesPending = compute().finally(() => {
        g.__nagrikPublicFixesPending = undefined;
      });
    }
    return g.__nagrikPublicFixesPending;
  };
  if (cached) {
    if (Date.now() - cached.at > CACHE_MS) void refresh().catch(() => {});
    return cached.value;
  }
  return refresh();
}

/** Raw logo data URL from the saved NGO profile (for the logo route). */
export async function loadNgoLogoDataUrl(): Promise<string | null> {
  try {
    const profile = await withTimeout(getNgoProfile(), DB_TIMEOUT_MS);
    return safeLogoUrl(profile.logoUrl);
  } catch {
    return null;
  }
}
