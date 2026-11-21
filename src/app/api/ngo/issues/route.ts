import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { DEMO_SPOTS } from "@/lib/demo/demo-issues";
import { displayNgoName, getNgoProfile } from "@/lib/ngo/ngo-store";
import { requireNgoOrStaff, requireNgo } from "@/lib/auth/request-guards";
import { bodyTooLarge, checkRepairPhoto } from "@/lib/security/uploads";
import { resolveJurisdiction } from "@/lib/geo/kharghar-jurisdiction";

/**
 * GET /api/ngo/issues
 * Fetches all live citizen reports submitted via Telegram joined with evidence photos,
 * plus physical spots in Kharghar Sector 4.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  // Private citizen descriptions, exact locations and photos: NGO desk or staff only.
  const denied = await requireNgoOrStaff(req);
  if (denied) return denied;
  try {
    await getNgoProfile(); // warms the cache used by displayNgoName below
    const supabase = createAdminSupabaseClient();

    // 1. Fetch live citizen reports from Telegram
    const { data: dbReports, error: rErr } = await (supabase as any)
      .from("reports")
      .select(`
        id,
        ticket_code,
        group_id,
        category_id,
        issue_type_id,
        description_private,
        language,
        latitude,
        longitude,
        location_source,
        review_status,
        public_summary,
        created_at,
        updated_at,
        evidence (
          id,
          storage_path_private,
          storage_path_public,
          mime_type,
          evidence_stage
        )
      `)
      .order("created_at", { ascending: false });

    // 2. Fetch physical spots
    const { data: dbSpots } = await (supabase as any)
      .from("spots")
      .select("*")
      .order("updated_at", { ascending: false });

    const liveItems: any[] = [];

    // Process live citizen reports and generate signed URLs for private photos
    if (dbReports && dbReports.length > 0) {
      for (const rep of dbReports) {
        let beforePhotoUrl: string | null = null;

        if (rep.evidence && rep.evidence.length > 0) {
          const ev = rep.evidence[0];
          const rawPath = ev.storage_path_private || ev.storage_path_public;
          if (rawPath) {
            try {
              const { data: signed } = await supabase.storage
                .from("evidence-private")
                .createSignedUrl(rawPath, 3600); // 1 hour; the desk refetches on load
              if (signed?.signedUrl) {
                beforePhotoUrl = signed.signedUrl;
              }
            } catch (err) {
              console.warn("Signed URL generation notice:", err);
            }
          }
        }

        const categoryName = rep.category_id
          ? rep.category_id.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c: string) => c.toUpperCase())
          : "Civic issue";
        const issueName = rep.issue_type_id
          ? rep.issue_type_id.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c: string) => c.toUpperCase())
          : "Civic issue";

        // Check if resolution proof was recorded in public_summary
        let afterPhotoUrl: string | null = null;
        let resNote: string | null = null;
        let fixedBy: string | null = null;
        let fixedAt: string | null = null;

        if (rep.public_summary) {
          try {
            const parsed = JSON.parse(rep.public_summary);
            if (parsed.after_photo_url) afterPhotoUrl = parsed.after_photo_url;
            if (parsed.resolution_note) resNote = parsed.resolution_note;
            if (parsed.fixed_by) fixedBy = displayNgoName(parsed.fixed_by);
            if (parsed.fixed_at) fixedAt = parsed.fixed_at;
          } catch {
            // raw string summary
          }
        }

        const isResolvedOrSubmitted =
          rep.review_status === "verified" || Boolean(afterPhotoUrl);

        const repLat = Number(rep.latitude) || 19.0435;
        const repLon = Number(rep.longitude) || 73.0680;
        const repJur = resolveJurisdiction(repLat, repLon, rep.description_private || "");

        liveItems.push({
          id: rep.id,
          code: rep.ticket_code,
          title: issueName,
          category_name: categoryName,
          issue_type_id: rep.issue_type_id || "pothole",
          description: rep.description_private || "Reported via Telegram bot.",
          latitude: repLat,
          longitude: repLon,
          location_name: "Kharghar, Navi Mumbai",
          ward: repJur.wardName,
          ward_code: repJur.wardCode,
          police_station: repJur.policeStation,
          police_phone: repJur.policePhone,
          police_address: repJur.policeAddress,
          beat_chowki: repJur.beatChowki,
          status: isResolvedOrSubmitted ? "RESOLUTION_SUBMITTED" : "IN_PROGRESS",
          source: "telegram_live",
          is_live: true,
          // No stand-in images: if the resident sent no photo, say so rather than show a stock picture.
          before_photo_url: beforePhotoUrl,
          after_photo_url: afterPhotoUrl,
          resolution_note: resNote,
          fixed_by: fixedBy,
          fixed_at: fixedAt,
          created_at: rep.created_at,
          updated_at: rep.updated_at,
        });
      }
    }

    // Process database spots
    if (dbSpots && dbSpots.length > 0) {
      for (const sp of dbSpots) {
        const catName = sp.category_id
          ? sp.category_id.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c: string) => c.toUpperCase())
          : "Infrastructure";
        const spLat = Number(sp.canonical_latitude) || 19.0435;
        const spLon = Number(sp.canonical_longitude) || 73.0680;
        const spJur = resolveJurisdiction(spLat, spLon, sp.location_name || sp.public_summary || "");

        liveItems.push({
          id: sp.id,
          code: sp.spot_code,
          title: `${catName} on ${sp.location_name || "Pravesh Marg"}`,
          category_name: catName,
          issue_type_id: sp.issue_type_id || "defect",
          description: sp.public_summary || "Municipal infrastructure defect tracked for repair.",
          latitude: spLat,
          longitude: spLon,
          location_name: sp.location_name || "Kharghar, Navi Mumbai",
          ward: spJur.wardName,
          ward_code: spJur.wardCode,
          police_station: spJur.policeStation,
          police_phone: spJur.policePhone,
          police_address: spJur.policeAddress,
          beat_chowki: spJur.beatChowki,
          status: sp.status || "IN_PROGRESS",
          source: "spot_database",
          is_live: !sp.is_demo,
          before_photo_url: null,
          after_photo_url: null,
          resolution_note: sp.resolution_note || null,
          created_at: sp.created_at,
          updated_at: sp.updated_at,
        });
      }
    }

    // If no spots/reports found, fall back to sample DEMO_SPOTS
    if (liveItems.length === 0) {
      for (const d of DEMO_SPOTS) {
        liveItems.push({
          id: d.id,
          code: d.spot_code,
          title: d.title,
          category_name: d.category_name,
          issue_type_id: d.issue_type_id,
          description: d.public_summary,
          latitude: d.canonical_latitude,
          longitude: d.canonical_longitude,
          location_name: d.location_name,
          status: d.status,
          source: "demo",
          is_live: false,
          before_photo_url: null,
          after_photo_url: null,
          resolution_note: d.resolution_note || null,
          created_at: d.created_at,
          updated_at: d.updated_at,
        });
      }
    }

    return NextResponse.json({
      success: true,
      count: liveItems.length,
      live_reports_count: dbReports?.length || 0,
      issues: liveItems,
    });
  } catch (err: any) {
    console.error("[API /api/ngo/issues error]", err);
    return NextResponse.json(
      { success: false, error: "Failed to load issues" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/ngo/issues
 * Marks an issue/report as fixed, records the after-photo and completion note.
 */
export async function POST(req: NextRequest) {
  const denied = requireNgo(req);
  if (denied) return denied;

  if (bodyTooLarge(req, 4 * 1024 * 1024)) {
    return NextResponse.json(
      { success: false, error: "The repair photo is too large. Use a photo under 2.5 MB." },
      { status: 413 }
    );
  }

  try {
    const body = await req.json().catch(() => null);
    const id = typeof body?.id === "string" ? body.id.trim() : "";
    const resolutionNote =
      typeof body?.resolutionNote === "string" ? body.resolutionNote.trim().slice(0, 2000) : "";

    if (!id || id.length > 80 || !/^[A-Za-z0-9_-]+$/.test(id)) {
      return NextResponse.json({ success: false, error: "Missing or invalid issue ID" }, { status: 400 });
    }

    const photo = checkRepairPhoto(body?.afterPhotoUrl);
    if (!photo.ok) {
      return NextResponse.json({ success: false, error: photo.error }, { status: 400 });
    }
    const afterPhotoUrl = photo.value;

    if (!afterPhotoUrl && !resolutionNote) {
      return NextResponse.json(
        { success: false, error: "Add a repair photo or a note describing the fix." },
        { status: 400 }
      );
    }

    // The fix is always credited to the signed-in NGO, never to a name sent by the browser.
    const fixedBy = (await getNgoProfile()).name;
    const now = new Date().toISOString();

    const supabase = createAdminSupabaseClient();

    const resolutionMeta = JSON.stringify({
      resolution_note: resolutionNote || null,
      after_photo_url: afterPhotoUrl,
      fixed_by: fixedBy,
      fixed_at: now,
    });

    // 1. Report (citizen ticket): only if it exists and is not rejected.
    let ticketCode: string | undefined;
    const { data: report } = await (supabase as any)
      .from("reports")
      .select("id, ticket_code, review_status")
      .eq("id", id)
      .maybeSingle();

    if (report) {
      if (report.review_status === "rejected") {
        return NextResponse.json(
          { success: false, error: "This report was rejected by a reviewer and can't be marked fixed." },
          { status: 409 }
        );
      }
      const { data: updatedReport } = await (supabase as any)
        .from("reports")
        .update({ review_status: "verified", public_summary: resolutionMeta, updated_at: now })
        .eq("id", id)
        .select("id, ticket_code")
        .single();
      ticketCode = updatedReport?.ticket_code;
    }

    // 2. Spot: an NGO can only *submit* a resolution for review. It can never close
    //    (RESOLVED) or reopen a spot; that stays with the super-admin reviewer.
    let spotUpdated = false;
    const { data: spot } = await (supabase as any)
      .from("spots")
      .select("id, status")
      .eq("id", id)
      .maybeSingle();

    if (spot) {
      if (spot.status === "RESOLVED" || spot.status === "CLOSED") {
        return NextResponse.json(
          { success: false, error: "This issue is already closed by a reviewer." },
          { status: 409 }
        );
      }
      await (supabase as any)
        .from("spots")
        .update({ status: "RESOLUTION_SUBMITTED", resolution_note: resolutionNote || null, updated_at: now })
        .eq("id", id)
        .neq("status", "RESOLVED");
      spotUpdated = true;
    }

    if (!report && !spotUpdated) {
      return NextResponse.json({ success: false, error: "Issue not found." }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: "Resolution submitted successfully",
      id,
      ticket_code: ticketCode,
      afterPhotoUrl,
      resolutionNote,
      fixedBy,
      status: "RESOLUTION_SUBMITTED",
      timestamp: now,
    });
  } catch (err: any) {
    console.error("[API /api/ngo/issues POST error]", err?.message || err);
    return NextResponse.json({ success: false, error: "Failed to submit resolution" }, { status: 500 });
  }
}
