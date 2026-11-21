import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { DEMO_SPOTS } from "@/lib/demo/demo-issues";

function discretizeCoordinate(coord: number): number {
  return Math.round(coord / 0.0003) * 0.0003;
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ spotCode: string }> }
) {
  try {
    const { spotCode } = await context.params;
    const supabase = await createServerSupabaseClient();

    const { data: spot, error } = await supabase
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
      .eq("spot_code", spotCode)
      .eq("public_approved", true)
      .single();

    if (!error && spot) {
      const catName = spot.category_id ? spot.category_id.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c: string) => c.toUpperCase()) : "Civic issue";
      return NextResponse.json({
        success: true,
        spot: {
          ...spot,
          category_name: catName,
          title: `${catName} Issue`,
          canonical_latitude: discretizeCoordinate(Number(spot.canonical_latitude)),
          canonical_longitude: discretizeCoordinate(Number(spot.canonical_longitude)),
          latitude: discretizeCoordinate(Number(spot.canonical_latitude)),
          longitude: discretizeCoordinate(Number(spot.canonical_longitude)),
        },
      });
    }

    // Check demo spots
    const demo = DEMO_SPOTS.find((s) => s.spot_code === spotCode);
    if (demo) {
      return NextResponse.json({
        success: true,
        spot: {
          ...demo,
          canonical_latitude: discretizeCoordinate(demo.canonical_latitude),
          canonical_longitude: discretizeCoordinate(demo.canonical_longitude),
          latitude: discretizeCoordinate(demo.canonical_latitude),
          longitude: discretizeCoordinate(demo.canonical_longitude),
          is_demo: true,
        },
      });
    }

    return NextResponse.json(
      { success: false, error: "Spot not found or not approved for public display" },
      { status: 404 }
    );
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || "Failed to fetch spot" },
      { status: 500 }
    );
  }
}
