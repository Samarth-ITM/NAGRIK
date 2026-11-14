-- NAGRIK SCHEMA MIGRATION 2: ROW LEVEL SECURITY & TENANT ISOLATION
-- Authority: TRD Section 6, 8, 18, 21 & PRD Section 6, 8
-- Target Engine: Supabase PostgreSQL (15+)

-- ============================================================================
-- 1. HELPER FUNCTIONS FOR AUTHORISATION & TENANCY
-- ============================================================================

-- Returns the active role for the current authenticated user
create or replace function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = public, auth
as $$
  select role from public.profiles
  where user_id = auth.uid() and is_active = true
  limit 1;
$$;

-- Returns true if current user is an active super administrator
create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select coalesce((public.current_user_role() = 'super_admin'), false);
$$;

-- Returns set of active organisation IDs for the current authenticated user
create or replace function public.get_user_organisations()
returns setof uuid
language sql
stable
security definer
set search_path = public, auth
as $$
  select organisation_id from public.organisation_memberships
  where user_id = auth.uid() and is_active = true;
$$;

-- Returns true if current user is an active demo viewer
create or replace function public.is_demo_viewer()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select coalesce((public.current_user_role() = 'demo_viewer'), false);
$$;

-- ============================================================================
-- 2. ENABLE ROW LEVEL SECURITY ON ALL USER-FACING TABLES
-- ============================================================================
alter table public.organisations enable row level security;
alter table public.profiles enable row level security;
alter table public.organisation_memberships enable row level security;
alter table public.citizen_contacts enable row level security;
alter table public.spots enable row level security;
alter table public.reports enable row level security;
alter table public.evidence enable row level security;
alter table public.status_history enable row level security;
alter table public.audit_logs enable row level security;
alter table public.authority_handoffs enable row level security;
alter table public.resolution_submissions enable row level security;
alter table public.ai_assessments enable row level security;
alter table public.telegram_updates enable row level security;
alter table public.report_drafts enable row level security;
alter table public.citizen_challenges enable row level security;
alter table public.notification_outbox enable row level security;
alter table public.pilot_settings enable row level security;

-- ============================================================================
-- 3. POLICIES: PILOT SETTINGS
-- ============================================================================
-- Public and all users can view active pilot settings (boundaries, centre coordinates)
create policy "pilot_settings_public_read"
    on public.pilot_settings
    for select
    using (is_active = true);

-- Super-admin can manage pilot settings
create policy "pilot_settings_super_admin_manage"
    on public.pilot_settings
    for all
    to authenticated
    using (public.is_super_admin())
    with check (public.is_super_admin());

-- ============================================================================
-- 4. POLICIES: ORGANISATIONS
-- ============================================================================
-- Active non-demo organisations and demo org are viewable for general navigation
create policy "organisations_read_active"
    on public.organisations
    for select
    using (is_active = true);

-- Super admin has full control over organisations
create policy "organisations_super_admin_all"
    on public.organisations
    for all
    to authenticated
    using (public.is_super_admin())
    with check (public.is_super_admin());

-- ============================================================================
-- 5. POLICIES: PROFILES
-- ============================================================================
-- Users can read their own profile
create policy "profiles_read_own"
    on public.profiles
    for select
    to authenticated
    using (user_id = auth.uid());

-- Super admin can view and manage all profiles
create policy "profiles_super_admin_all"
    on public.profiles
    for all
    to authenticated
    using (public.is_super_admin())
    with check (public.is_super_admin());

-- ============================================================================
-- 6. POLICIES: ORGANISATION MEMBERSHIPS
-- ============================================================================
-- Users can view their own memberships
create policy "memberships_read_own"
    on public.organisation_memberships
    for select
    to authenticated
    using (user_id = auth.uid());

-- Super admin has full control over organisation memberships
create policy "memberships_super_admin_all"
    on public.organisation_memberships
    for all
    to authenticated
    using (public.is_super_admin())
    with check (public.is_super_admin());

-- ============================================================================
-- 7. POLICIES: CITIZEN CONTACTS (STRICT PRIVACY)
-- ============================================================================
-- Invariant: Citizen contacts are NEVER accessible to anonymous visitors or authorities.
-- Only super-admin may view contacts for legal/system audit. Mutations done via service-role.
create policy "citizen_contacts_super_admin_read"
    on public.citizen_contacts
    for select
    to authenticated
    using (public.is_super_admin());

-- ============================================================================
-- 8. POLICIES: SPOTS (PHYSICAL CIVIC ISSUES)
-- ============================================================================
-- Public approved live spots are viewable by everyone
create policy "spots_public_read"
    on public.spots
    for select
    using (public_approved = true and is_demo = false);

-- Demo spots are viewable by everyone (for synthetic demo workspace)
create policy "spots_demo_read"
    on public.spots
    for select
    using (is_demo = true);

-- Authority users can view only spots assigned to their organisation
create policy "spots_authority_read"
    on public.spots
    for select
    to authenticated
    using (
        assigned_organisation_id in (select public.get_user_organisations())
        and is_demo = false
    );

-- Super admin has full access to all spots
create policy "spots_super_admin_all"
    on public.spots
    for all
    to authenticated
    using (public.is_super_admin())
    with check (public.is_super_admin());

-- ============================================================================
-- 9. POLICIES: REPORTS (INDIVIDUAL CITIZEN TICKETS)
-- ============================================================================
-- Public approved live reports are viewable by everyone (sanitised fields)
create policy "reports_public_read"
    on public.reports
    for select
    using (public_approved = true and is_demo = false);

-- Demo reports are viewable for demonstration purposes
create policy "reports_demo_read"
    on public.reports
    for select
    using (is_demo = true);

-- Authority users can view reports only for spots assigned to their organisation
create policy "reports_authority_read"
    on public.reports
    for select
    to authenticated
    using (
        spot_id in (
            select id from public.spots
            where assigned_organisation_id in (select public.get_user_organisations())
        )
        and is_demo = false
    );

-- Super admin has full control over all reports
create policy "reports_super_admin_all"
    on public.reports
    for all
    to authenticated
    using (public.is_super_admin())
    with check (public.is_super_admin());

-- ============================================================================
-- 10. POLICIES: EVIDENCE
-- ============================================================================
-- Public can view evidence only if approved and linked to a public spot
create policy "evidence_public_read"
    on public.evidence
    for select
    using (
        public_approved_at is not null
        and (
            spot_id in (select id from public.spots where public_approved = true and is_demo = false)
            or report_id in (select id from public.reports where public_approved = true and is_demo = false)
        )
    );

-- Demo evidence is viewable for demo issues
create policy "evidence_demo_read"
    on public.evidence
    for select
    using (
        spot_id in (select id from public.spots where is_demo = true)
        or report_id in (select id from public.reports where is_demo = true)
    );

-- Authority users can view evidence for spots assigned to their organisation
create policy "evidence_authority_read"
    on public.evidence
    for select
    to authenticated
    using (
        spot_id in (
            select id from public.spots
            where assigned_organisation_id in (select public.get_user_organisations())
        )
    );

-- Authority users can insert evidence (after-photos/videos) for assigned spots
create policy "evidence_authority_insert"
    on public.evidence
    for insert
    to authenticated
    with check (
        spot_id in (
            select id from public.spots
            where assigned_organisation_id in (select public.get_user_organisations())
        )
        and uploaded_by_user_id = auth.uid()
    );

-- Super admin has full control over evidence
create policy "evidence_super_admin_all"
    on public.evidence
    for all
    to authenticated
    using (public.is_super_admin())
    with check (public.is_super_admin());

-- ============================================================================
-- 11. POLICIES: STATUS HISTORY
-- ============================================================================
-- Public can view status history for public approved spots
create policy "status_history_public_read"
    on public.status_history
    for select
    using (
        spot_id in (select id from public.spots where public_approved = true and is_demo = false)
    );

-- Demo status history is viewable
create policy "status_history_demo_read"
    on public.status_history
    for select
    using (
        spot_id in (select id from public.spots where is_demo = true)
    );

-- Authority users can view status history for assigned spots
create policy "status_history_authority_read"
    on public.status_history
    for select
    to authenticated
    using (
        spot_id in (
            select id from public.spots
            where assigned_organisation_id in (select public.get_user_organisations())
        )
    );

-- Super admin has full control over status history
create policy "status_history_super_admin_all"
    on public.status_history
    for all
    to authenticated
    using (public.is_super_admin())
    with check (public.is_super_admin());

-- ============================================================================
-- 12. POLICIES: AUTHORITY HANDOFFS
-- ============================================================================
-- Authority users can view handoffs intended for their organisation or assigned spots
create policy "authority_handoffs_authority_read"
    on public.authority_handoffs
    for select
    to authenticated
    using (
        organisation_id in (select public.get_user_organisations())
        or spot_id in (
            select id from public.spots
            where assigned_organisation_id in (select public.get_user_organisations())
        )
    );

-- Super admin has full control over authority handoffs
create policy "authority_handoffs_super_admin_all"
    on public.authority_handoffs
    for all
    to authenticated
    using (public.is_super_admin())
    with check (public.is_super_admin());

-- ============================================================================
-- 13. POLICIES: RESOLUTION SUBMISSIONS
-- ============================================================================
-- Authority users can view and insert resolution submissions for assigned spots
create policy "resolution_submissions_authority_read"
    on public.resolution_submissions
    for select
    to authenticated
    using (
        spot_id in (
            select id from public.spots
            where assigned_organisation_id in (select public.get_user_organisations())
        )
    );

create policy "resolution_submissions_authority_insert"
    on public.resolution_submissions
    for insert
    to authenticated
    with check (
        spot_id in (
            select id from public.spots
            where assigned_organisation_id in (select public.get_user_organisations())
        )
        and submitted_by = auth.uid()
    );

-- Super admin has full control over resolution submissions
create policy "resolution_submissions_super_admin_all"
    on public.resolution_submissions
    for all
    to authenticated
    using (public.is_super_admin())
    with check (public.is_super_admin());

-- ============================================================================
-- 14. POLICIES: AI ASSESSMENTS (ADVISORY)
-- ============================================================================
-- Authority users can view advisory assessments for assigned spots
create policy "ai_assessments_authority_read"
    on public.ai_assessments
    for select
    to authenticated
    using (
        spot_id in (
            select id from public.spots
            where assigned_organisation_id in (select public.get_user_organisations())
        )
    );

-- Super admin has full control over AI assessments
create policy "ai_assessments_super_admin_all"
    on public.ai_assessments
    for all
    to authenticated
    using (public.is_super_admin())
    with check (public.is_super_admin());

-- ============================================================================
-- 15. POLICIES: TELEGRAM UPDATES, REPORT DRAFTS, NOTIFICATION OUTBOX
-- ============================================================================
-- Invariant: These tables are internal bot pipeline tables.
-- Super admin may inspect for troubleshooting. Public and authorities have no access.
create policy "telegram_updates_super_admin_all"
    on public.telegram_updates
    for all
    to authenticated
    using (public.is_super_admin())
    with check (public.is_super_admin());

create policy "report_drafts_super_admin_all"
    on public.report_drafts
    for all
    to authenticated
    using (public.is_super_admin())
    with check (public.is_super_admin());

create policy "notification_outbox_super_admin_all"
    on public.notification_outbox
    for all
    to authenticated
    using (public.is_super_admin())
    with check (public.is_super_admin());

-- ============================================================================
-- 16. POLICIES: CITIZEN CHALLENGES
-- ============================================================================
-- Super admin manages citizen challenges
create policy "citizen_challenges_super_admin_all"
    on public.citizen_challenges
    for all
    to authenticated
    using (public.is_super_admin())
    with check (public.is_super_admin());

-- ============================================================================
-- 17. POLICIES: AUDIT LOGS (IMMUTABLE LOG)
-- ============================================================================
-- Super admin can view audit logs. Nobody can update or delete audit logs.
create policy "audit_logs_super_admin_read"
    on public.audit_logs
    for select
    to authenticated
    using (public.is_super_admin());
