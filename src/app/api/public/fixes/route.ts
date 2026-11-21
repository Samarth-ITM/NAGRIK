import { NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { displayNgoName, getNgoProfile } from "@/lib/ngo/ngo-store";
import { DEMO_SPOTS } from "@/lib/demo/demo-issues";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

export async function GET() {
  let profile: { name: string; logoUrl?: string } = { name: "Partner NGO" };
  try {
    profile = await getNgoProfile();
  } catch {
    /* keep default */
  }
  const profileLogo = safeLogoUrl(profile.logoUrl);

  const fixes: PublicFix[] = [];

  try {
    const supabase = createAdminSupabaseClient();
    const { data: reports, error } = await (supabase as any)
      .from("reports")
      .select("id, issue_type_id, category_id, review_status, public_summary, updated_at")
      .in("review_status", ["verified", "resolved"])
      .order("updated_at", { ascending: false })
      .limit(30);

    if (!error && Array.isArray(reports)) {
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
    console.warn("[public/fixes] database unavailable, using samples:", err);
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

  return NextResponse.json({
    success: true,
    source: fixes.some((f) => !f.isSample) ? "live" : "sample",
    profileLogoUrl: profileLogo,
    fixes,
  });
}
