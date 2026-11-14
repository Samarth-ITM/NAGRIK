-- NAGRIK SCHEMA MIGRATION 5: SCOPE CORRECTION & SECURITY HARDENING
-- Authority: Phase 3A Audit & TRD Section 6, 8, 9, 10, 11, 21
-- Target Engine: Supabase PostgreSQL (15+)

-- ============================================================================
-- 1. SCOPE CORRECTION: DEFER APPLICATION WORKFLOW RPC FUNCTIONS
-- Workflows are explicitly deferred to Phase 4 (Civic reporting & matching)
-- and Phase 5 (Telegram integration). We drop them from the active schema
-- while preserving database constraints, triggers, and sequences.
-- ============================================================================
drop function if exists public.create_report_submission(text, text, text, text, text, text, text, text, numeric, numeric, numeric, text, text, text, bigint, text, text, bigint, boolean);
drop function if exists public.create_spot_for_report(uuid, uuid, text, uuid);
drop function if exists public.link_report_to_spot(uuid, uuid, uuid, numeric, text);
drop function if exists public.transition_spot_status(uuid, text, text, uuid, text, text);
drop function if exists public.record_authority_handoff(uuid, text, text, uuid, text, text, uuid, uuid);
drop function if exists public.submit_resolution_request(uuid, uuid, text, uuid, date, text, uuid);
drop function if exists public.review_resolution_request(uuid, uuid, text, text);
drop function if exists public.create_citizen_challenge(uuid, uuid, text, text, uuid);

-- ============================================================================
-- 2. PUBLIC DATA EXPOSURE CORRECTION: CLOSE COLUMN-LEVEL LEAKS
-- Postgres RLS is row-level, not column-level. We drop direct anonymous SELECT
-- policies on base tables so that private citizen descriptions, contact IDs,
-- exact GPS coordinates, internal IDs, and private evidence paths cannot be selected.
-- ============================================================================

-- Drop overly permissive base table policies for anonymous users
drop policy if exists "spots_public_read" on public.spots;
drop policy if exists "reports_public_read" on public.reports;
drop policy if exists "evidence_public_read" on public.evidence;
drop policy if exists "status_history_public_read" on public.status_history;

-- Explicitly revoke direct SELECT on sensitive base tables from anon role
revoke select on public.spots from anon;
revoke select on public.reports from anon;
revoke select on public.evidence from anon;
revoke select on public.status_history from anon;
revoke select on public.audit_logs from anon;
revoke select on public.citizen_contacts from anon;
revoke select on public.citizen_challenges from anon;
revoke select on public.authority_handoffs from anon;
revoke select on public.resolution_submissions from anon;
revoke select on public.ai_assessments from anon;
revoke select on public.telegram_updates from anon;
revoke select on public.report_drafts from anon;
revoke select on public.notification_outbox from anon;

-- Ensure authenticated role has standard table-level privileges (strictly filtered by RLS policies)
grant usage on schema public to authenticated, anon;
grant select, insert, update on public.spots to authenticated;
grant select, insert on public.reports to authenticated;
grant select, insert on public.evidence to authenticated;
grant select, insert on public.status_history to authenticated;
grant select, insert, update on public.resolution_submissions to authenticated;
grant select, insert on public.authority_handoffs to authenticated;
grant select on public.organisations to authenticated, anon;
grant select, update on public.profiles to authenticated;
grant select on public.organisation_memberships to authenticated;
grant select on public.ai_assessments to authenticated;
grant select on public.pilot_settings to authenticated, anon;
grant usage on all sequences in schema public to authenticated;

-- Allow authority users to update assigned spots (e.g. progress notes/status, guarded by trigger)
drop policy if exists "spots_authority_update" on public.spots;
create policy "spots_authority_update"
    on public.spots
    for update
    to authenticated
    using (
        assigned_organisation_id in (select public.get_user_organisations())
        and is_demo = false
    )
    with check (
        assigned_organisation_id in (select public.get_user_organisations())
        and is_demo = false
    );

-- Allow authenticated users to update their own profile (guarded by prevent_role_escalation trigger)
drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
    on public.profiles
    for update
    to authenticated
    using (user_id = auth.uid())
    with check (user_id = auth.uid());

-- ============================================================================
-- 3. STRICT PUBLIC PROJECTION VIEWS
-- Explicit column allowlists for public consumption. Excludes private descriptions,
-- exact citizen coordinates, contact references, internal UUIDs, and private evidence paths.
-- ============================================================================

-- A. Live Public Spots Projection
-- Exposes only approved, non-demo physical spots with rounded proximity coordinates (~11m)
create or replace view public.public_spots as
select
    s.spot_code,
    s.pilot_id,
    s.group_id,
    s.category_id,
    s.issue_type_id,
    s.status,
    s.severity_label,
    round(s.canonical_latitude::numeric, 4) as public_latitude,
    round(s.canonical_longitude::numeric, 4) as public_longitude,
    coalesce(
        (select r.public_summary from public.reports r where r.spot_id = s.id and r.public_approved = true order by r.created_at asc limit 1),
        'Civic issue verified and tracked for resolution.'
    ) as public_summary,
    (select count(*)::int from public.reports r where r.spot_id = s.id and r.public_approved = true) as public_report_count,
    s.created_at,
    s.updated_at,
    s.resolved_at
from public.spots s
where s.public_approved = true
  and s.is_demo = false;

-- B. Live Public Spot Evidence Projection
-- Exposes only approved public derivatives from the public storage bucket (never private originals)
create or replace view public.public_spot_evidence as
select
    s.spot_code,
    e.evidence_stage,
    e.storage_path_public,
    e.mime_type,
    e.public_approved_at
from public.evidence e
join public.spots s on e.spot_id = s.id
where e.public_approved_at is not null
  and e.storage_path_public is not null
  and s.public_approved = true
  and s.is_demo = false;

-- C. Demo Workspace Spots Projection (Explicitly synthetic)
create or replace view public.public_demo_spots as
select
    s.spot_code,
    s.pilot_id,
    s.group_id,
    s.category_id,
    s.issue_type_id,
    s.status,
    s.severity_label,
    s.canonical_latitude as public_latitude,
    s.canonical_longitude as public_longitude,
    coalesce(
        (select r.public_summary from public.reports r where r.spot_id = s.id and r.is_demo = true limit 1),
        'Synthetic demonstration issue.'
    ) as public_summary,
    (select count(*)::int from public.reports r where r.spot_id = s.id and r.is_demo = true) as public_report_count,
    s.created_at,
    s.updated_at,
    s.resolved_at,
    true as is_demo
from public.spots s
where s.is_demo = true;

-- Grant SELECT on secure public views to anonymous visitors and authenticated users
grant select on public.public_spots to anon, authenticated;
grant select on public.public_spot_evidence to anon, authenticated;
grant select on public.public_demo_spots to anon, authenticated;

-- ============================================================================
-- 4. DATABASE SECURITY INVARIANTS: TRIGGERS & GUARDS
-- Enforce core security rules at the database engine level independent of application code.
-- ============================================================================

-- Guard 1: Only super-administrators can mark spots RESOLVED
create or replace function public.guard_spot_resolution()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
    if new.status = 'RESOLVED' and old.status is distinct from 'RESOLVED' then
        if auth.role() != 'service_role' and not public.is_super_admin() then
            raise exception 'Forbidden: Only super administrators can approve issue resolution';
        end if;
        new.resolved_at = coalesce(new.resolved_at, now());
    end if;

    if old.status = 'RESOLVED' and new.status != 'RESOLVED' then
        if auth.role() != 'service_role' and not public.is_super_admin() then
            raise exception 'Forbidden: Only super administrators can reopen resolved issues';
        end if;
        new.resolved_at = null;
    end if;

    return new;
end;
$$;

drop trigger if exists trg_guard_spot_resolution on public.spots;
create trigger trg_guard_spot_resolution
    before update on public.spots
    for each row execute function public.guard_spot_resolution();

-- Guard 2: Prevent role escalation on profiles table
create or replace function public.prevent_role_escalation()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
    if new.role is distinct from old.role then
        if auth.role() != 'service_role' and not public.is_super_admin() then
            raise exception 'Forbidden: User role cannot be modified without super-administrator privileges';
        end if;
    end if;
    return new;
end;
$$;

drop trigger if exists trg_prevent_role_escalation on public.profiles;
create trigger trg_prevent_role_escalation
    before update of role on public.profiles
    for each row execute function public.prevent_role_escalation();

-- Guard 3: Prevent unauthorized organisation membership assignment
create or replace function public.prevent_membership_escalation()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
    if auth.role() != 'service_role' and not public.is_super_admin() then
        raise exception 'Forbidden: Organisation memberships can only be managed by super-administrators';
    end if;
    return new;
end;
$$;

drop trigger if exists trg_prevent_membership_escalation on public.organisation_memberships;
create trigger trg_prevent_membership_escalation
    before insert or update or delete on public.organisation_memberships
    for each row execute function public.prevent_membership_escalation();

-- Guard 4: Prevent demo viewers from mutating any data
create or replace function public.guard_demo_mutations()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
    if public.is_demo_viewer() then
        raise exception 'Forbidden: Demonstration workspace is strictly read-only';
    end if;
    return coalesce(new, old);
end;
$$;

drop trigger if exists trg_guard_demo_mutations_spots on public.spots;
create trigger trg_guard_demo_mutations_spots
    before insert or update or delete on public.spots
    for each row execute function public.guard_demo_mutations();

drop trigger if exists trg_guard_demo_mutations_reports on public.reports;
create trigger trg_guard_demo_mutations_reports
    before insert or update or delete on public.reports
    for each row execute function public.guard_demo_mutations();

drop trigger if exists trg_guard_demo_mutations_evidence on public.evidence;
create trigger trg_guard_demo_mutations_evidence
    before insert or update or delete on public.evidence
    for each row execute function public.guard_demo_mutations();

drop trigger if exists trg_guard_demo_mutations_submissions on public.resolution_submissions;
create trigger trg_guard_demo_mutations_submissions
    before insert or update or delete on public.resolution_submissions
    for each row execute function public.guard_demo_mutations();

-- ============================================================================
-- 5. PILOT COORDINATE VERIFICATION GUARD
-- Ensure pilot settings explicitly mark coordinates as unverified until on-site
-- pinning is completed by the project owner.
-- ============================================================================
update public.pilot_settings
set settings_payload = settings_payload || jsonb_build_object(
    'centre_verified', false,
    'production_geofence_active', false,
    'verification_status', 'PENDING_OWNER_ON_SITE_VERIFICATION',
    'verification_requirement', 'Project owner must stand at the ITM main public pedestrian entrance, capture high-accuracy GPS coordinates (accuracy < 5m) via mobile GPS/bot, and update pilot_settings centre_latitude and centre_longitude before activating live reporting.'
)
where id = 'kharghar_itm_v1';
