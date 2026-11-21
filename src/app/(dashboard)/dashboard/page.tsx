import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { isSuperAdmin, isAuthorityUser, isDemoViewer } from "@/lib/permissions";
import {
  DashboardView,
  type DashboardSpot,
  type DashboardReport,
} from "@/components/dashboard/dashboard-view";
import { DEMO_SPOTS } from "@/lib/demo/demo-issues";
import {
  calculateHaversineDistanceMetres,
  classifyCandidateBand,
} from "@/lib/geospatial/haversine";

export const metadata = {
  title: "Operational Dashboard — Nagrik",
  description: "Civic intelligence governance and authority resolution workflow engine.",
};

export default async function DashboardPage() {
  const supabase = await createServerSupabaseClient();

  // 1. Authenticate user: Must have valid session
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect("/login?next=/dashboard");
  }

  // 2. Fetch user profile and verify active status
  const { data: profile } = await (supabase as any)
    .from("profiles")
    .select("role, is_active")
    .eq("user_id", user.id)
    .single();

  if (!profile || profile.is_active === false) {
    redirect("/login?error=account_inactive");
  }

  // 3. Verify allowed dashboard roles
  const isSuper = isSuperAdmin(profile.role);
  const isAuthority = isAuthorityUser(profile.role);
  const isDemo = isDemoViewer(profile.role);

  if (!isSuper && !isAuthority && !isDemo) {
    redirect("/?error=unauthorized");
  }

  // 4. Fetch organisation memberships for authority users
  let assignedOrgIds: string[] = [];
  if (isAuthority) {
    const { data: memberships } = await (supabase as any)
      .from("organisation_memberships")
      .select("organisation_id")
      .eq("user_id", user.id)
      .eq("is_active", true);

    assignedOrgIds = (memberships as any[])?.map((m: any) => m.organisation_id) || [];
  }

  let spots: DashboardSpot[] = [];
  let unlinkedReports: DashboardReport[] = [];

  try {
    // 5. Query scoped spots strictly according to authenticated role
    let spotsQuery = (supabase as any)
      .from("spots")
      .select(`
 id,
 spot_code,
 category_id,
 issue_type_id,
 status,
 severity_label,
 canonical_latitude,
 canonical_longitude,
 assigned_organisation_id,
 public_approved,
 is_demo,
 created_at,
 updated_at,
 resolved_at,
 organisations ( name )
 `)
      .order("updated_at", { ascending: false });

    if (isDemo) {
      spotsQuery = spotsQuery.eq("is_demo", true);
    } else if (isAuthority) {
      // Scoped exclusively to assigned organisations and live issues
      spotsQuery = spotsQuery
        .eq("is_demo", false)
        .in(
          "assigned_organisation_id",
          assignedOrgIds.length > 0
            ? assignedOrgIds
            : ["00000000-0000-0000-0000-000000000000"]
        );
    }

    const { data: spotsData } = await spotsQuery;

    if (spotsData && spotsData.length > 0) {
      spots = (spotsData as any[]).map((s: any) => ({
        id: s.id,
        spot_code: s.spot_code,
        category_id: s.category_id,
        category_name: s.category_id.replace(/_/g, " ").toUpperCase(),
        issue_type_id: s.issue_type_id,
        status: s.status,
        severity_label: s.severity_label,
        canonical_latitude: Number(s.canonical_latitude),
        canonical_longitude: Number(s.canonical_longitude),
        assigned_organisation_id: s.assigned_organisation_id,
        assigned_organisation_name:
          (s.organisations as { name: string } | null)?.name || null,
        public_approved: s.public_approved,
        is_demo: s.is_demo,
        created_at: s.created_at,
        updated_at: s.updated_at,
        resolved_at: s.resolved_at,
        public_summary: `Civic issue in Kharghar Sector 4 tracked for physical repair.`,
      }));
    }

    // 6. Fetch unlinked reports (strictly super-admin only)
    if (isSuper) {
      const { data: reportsData } = await (supabase as any)
        .from("reports")
        .select(`
 id,
 ticket_code,
 category_id,
 description_private,
 latitude,
 longitude,
 review_status,
 created_at,
 evidence ( storage_path_private )
 `)
        .is("spot_id", null)
        .eq("is_demo", false)
        .order("created_at", { ascending: false });

      if (reportsData && reportsData.length > 0) {
        unlinkedReports = (reportsData as any[]).map((r: any) => {
          const lat = Number(r.latitude || 19.0338);
          const lon = Number(r.longitude || 73.0630);

          // Deterministic duplicate candidate calculation against existing spots
          const candidates = spots
            .filter((s) => s.category_id === r.category_id)
            .map((s) => {
              const dist = calculateHaversineDistanceMetres(
                lat,
                lon,
                s.canonical_latitude,
                s.canonical_longitude
              );
              return {
                spot_id: s.id,
                spot_code: s.spot_code,
                distance_m: Math.round(dist * 10) / 10,
                candidate_band: classifyCandidateBand(dist),
              };
            })
            .filter((c) => c.candidate_band !== "NOT_A_CANDIDATE")
            .sort((a, b) => a.distance_m - b.distance_m);

          const evList = r.evidence as { storage_path_private: string }[] | null;
          const evPath = evList && evList.length > 0 ? evList[0].storage_path_private : null;

          return {
            id: r.id,
            ticket_code: r.ticket_code,
            category_id: r.category_id,
            category_name: r.category_id.replace(/_/g, " ").toUpperCase(),
            description_private: r.description_private,
            latitude: lat,
            longitude: lon,
            review_status: r.review_status || "new",
            evidence_path: evPath,
            created_at: r.created_at,
            candidate_spots: candidates,
          };
        });
      }
    }
  } catch {
    // Graceful error handling
  }

  // If demo viewer has no database demo spots, supply synthetic demo spots
  if (spots.length === 0 && isDemo) {
    spots = DEMO_SPOTS as unknown as DashboardSpot[];
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <DashboardView
        initialSpots={spots}
        initialUnlinkedReports={unlinkedReports}
        initialUserRole={profile.role}
      />
    </div>
  );
}
