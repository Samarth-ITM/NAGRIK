import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { DEMO_SPOTS } from "@/lib/demo/demo-issues";

/**
 * Discretize coordinates to ~25-50m grid steps to protect citizen dwelling privacy
 * Formula: round(coord / 0.0003) * 0.0003 (per TRD Section 8 & Phase 5 privacy invariant)
 */
function discretizeCoordinate(coord: number): number {
  return Math.round(coord / 0.0003) * 0.0003;
}

/**
 * GET /api/public/issues
 * Public issue transparency endpoint.
 * Returns only sanitized public projections. Never exposes private citizen contact or unapproved media.
 */
export async function GET() {
  try {
    const supabase = await createServerSupabaseClient();

    // Query spots where public_approved = true, ordered by most recently updated
    const { data: dbSpots, error } = await supabase
      .from("spots")
      .select(`
        id,
        spot_code,
        group_id,
        category_id,
        issue_type_id,
        canonical_latitude,
        canonical_longitude,
        status,
        public_approved,
        is_demo,
        created_at,
        updated_at,
        resolved_at
      `)
      .eq("public_approved", true)
      .order("updated_at", { ascending: false })
      .limit(100);

    // If database returned spots, discretize coordinates and return them
    if (!error && dbSpots && dbSpots.length > 0) {
      const publicSpots = dbSpots.map((spot: any) => {
        const catName = spot.category_id ? spot.category_id.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c: string) => c.toUpperCase()) : "Civic issue";
        return {
          id: spot.id,
          spot_code: spot.spot_code,
          title: `${catName} Issue`,
          category_name: catName,
          category_id: spot.category_id,
          status: spot.status,
          latitude: discretizeCoordinate(Number(spot.canonical_latitude)),
          longitude: discretizeCoordinate(Number(spot.canonical_longitude)),
          canonical_latitude: discretizeCoordinate(Number(spot.canonical_latitude)),
          canonical_longitude: discretizeCoordinate(Number(spot.canonical_longitude)),
          is_demo: Boolean(spot.is_demo),
          created_at: spot.created_at,
          updated_at: spot.updated_at,
          resolved_at: spot.resolved_at,
        };
      });

      return NextResponse.json({
        success: true,
        source: "database",
        count: publicSpots.length,
        spots: publicSpots,
      });
    }

    // Fallback to DEMO_SPOTS if database is unpopulated or in mock mode
    const sanitizedDemoSpots = DEMO_SPOTS.map((spot) => ({
      ...spot,
      canonical_latitude: discretizeCoordinate(spot.canonical_latitude),
      canonical_longitude: discretizeCoordinate(spot.canonical_longitude),
      latitude: discretizeCoordinate(spot.canonical_latitude),
      longitude: discretizeCoordinate(spot.canonical_longitude),
      is_demo: true,
    }));

    return NextResponse.json({
      success: true,
      source: "illustrative_demo",
      count: sanitizedDemoSpots.length,
      spots: sanitizedDemoSpots,
      watermark: "DEMONSTRATION ENVIRONMENT — SAMPLE DATA",
    });
  } catch (err: any) {
    console.error("[Public Issues API Error]", err);
    // Graceful fallback to demo data
    return NextResponse.json({
      success: true,
      source: "illustrative_fallback",
      count: DEMO_SPOTS.length,
      spots: DEMO_SPOTS,
    });
  }
}
