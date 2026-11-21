-- NAGRIK SCHEMA MIGRATION 1: CORE TABLES, CONSTRAINTS & INDEXES
-- Authority: TRD Section 6 & PRD Section 4, 8, 9, 10
-- Target Engine: Supabase PostgreSQL (15+)

-- Enable UUID extension if not already enabled
create extension if not exists "pgcrypto";

-- ============================================================================
-- 1. SEQUENCES FOR HUMAN-READABLE CODES
-- ============================================================================
create sequence if not exists nagrik_ticket_seq start with 1 increment by 1;
create sequence if not exists nagrik_spot_seq start with 1 increment by 1;

-- ============================================================================
-- 2. ORGANISATIONS & MEMBERSHIPS
-- ============================================================================
create table if not exists public.organisations (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    slug text not null unique,
    organisation_type text not null check (organisation_type in ('government_authority', 'demo_authority', 'internal')),
    is_demo boolean not null default false,
    is_active boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.profiles (
    user_id uuid primary key references auth.users(id) on delete cascade,
    display_name text not null,
    role text not null check (role in ('super_admin', 'authority_admin', 'authority_operator', 'demo_viewer')),
    is_active boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.organisation_memberships (
    id uuid primary key default gen_random_uuid(),
    organisation_id uuid not null references public.organisations(id) on delete cascade,
    user_id uuid not null references auth.users(id) on delete cascade,
    membership_role text not null check (membership_role in ('authority_admin', 'authority_operator', 'demo_viewer')),
    is_active boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint uq_org_membership_user unique (organisation_id, user_id)
);

-- ============================================================================
-- 3. CITIZEN IDENTITY (PSEUDONYMOUS STORAGE)
-- ============================================================================
create table if not exists public.citizen_contacts (
    id uuid primary key default gen_random_uuid(),
    telegram_user_hash text not null unique,
    encrypted_chat_id text not null,
    language text not null default 'en' check (language in ('en', 'hi', 'mr')),
    consent_version text not null default 'v1.0',
    consent_at timestamptz not null default now(),
    created_at timestamptz not null default now(),
    last_seen_at timestamptz not null default now()
);

-- ============================================================================
-- 4. SPOTS (PHYSICAL CIVIC ISSUES)
-- ============================================================================
create table if not exists public.spots (
    id uuid primary key default gen_random_uuid(),
    spot_code text not null unique,
    pilot_id text not null default 'kharghar_itm_v1',
    group_id text not null,
    category_id text not null,
    issue_type_id text not null,
    canonical_latitude numeric(10, 7) not null,
    canonical_longitude numeric(10, 7) not null,
    anchor_accuracy_m numeric(6, 2) null,
    status text not null default 'NEW' check (
        status in (
            'NEW',
            'UNDER_REVIEW',
            'VERIFIED',
            'ASSIGNED',
            'HANDED_OFF',
            'AUTHORITY_ACKNOWLEDGED',
            'IN_PROGRESS',
            'RESOLUTION_SUBMITTED',
            'RESOLVED',
            'REOPENED',
            'REJECTED'
        )
    ),
    severity_label text null check (severity_label in ('low', 'medium', 'high')),
    assigned_organisation_id uuid null references public.organisations(id) on delete set null,
    public_approved boolean not null default false,
    is_demo boolean not null default false,
    resolved_at timestamptz null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

-- ============================================================================
-- 5. REPORTS (INDIVIDUAL CITIZEN SUBMISSIONS)
-- ============================================================================
create table if not exists public.reports (
    id uuid primary key default gen_random_uuid(),
    ticket_code text not null unique,
    citizen_contact_id uuid not null references public.citizen_contacts(id) on delete restrict,
    pilot_id text not null default 'kharghar_itm_v1',
    group_id text not null,
    category_id text not null,
    issue_type_id text not null,
    description_private text null,
    language text not null default 'en' check (language in ('en', 'hi', 'mr')),
    latitude numeric(10, 7) null,
    longitude numeric(10, 7) null,
    horizontal_accuracy_m numeric(6, 2) null,
    location_source text not null default 'telegram_location' check (location_source in ('telegram_location', 'manual_pin', 'landmark')),
    location_review_status text not null default 'unreviewed' check (location_review_status in ('unreviewed', 'confirmed', 'corrected', 'insufficient')),
    spot_id uuid null references public.spots(id) on delete set null,
    match_method text null check (match_method in ('manual_confirmed', 'manual_new_spot', 'admin_override')),
    match_distance_m numeric(8, 2) null,
    matched_by uuid null references auth.users(id) on delete set null,
    matched_at timestamptz null,
    match_note text null,
    review_status text not null default 'new' check (review_status in ('new', 'under_review', 'verified', 'rejected')),
    public_summary text null,
    public_approved boolean not null default false,
    is_demo boolean not null default false,
    telegram_update_id bigint unique null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

-- ============================================================================
-- 6. EVIDENCE
-- ============================================================================
create table if not exists public.evidence (
    id uuid primary key default gen_random_uuid(),
    report_id uuid null references public.reports(id) on delete cascade,
    spot_id uuid null references public.spots(id) on delete cascade,
    evidence_stage text not null check (evidence_stage in ('citizen_initial', 'authority_after', 'authority_video', 'other')),
    storage_path_private text not null,
    storage_path_public text null,
    mime_type text not null,
    file_size_bytes bigint not null check (file_size_bytes > 0),
    sha256 text not null,
    telegram_file_unique_id text null,
    uploaded_by_user_id uuid null references auth.users(id) on delete set null,
    uploaded_by_contact_id uuid null references public.citizen_contacts(id) on delete set null,
    server_received_at timestamptz not null default now(),
    public_approved_at timestamptz null,
    delete_after timestamptz null,
    constraint chk_evidence_parent check (report_id is not null or spot_id is not null)
);

-- ============================================================================
-- 7. STATUS HISTORY & AUDIT LOGS
-- ============================================================================
create table if not exists public.status_history (
    id uuid primary key default gen_random_uuid(),
    spot_id uuid not null references public.spots(id) on delete cascade,
    previous_status text null check (
        previous_status is null or previous_status in (
            'NEW', 'UNDER_REVIEW', 'VERIFIED', 'ASSIGNED', 'HANDED_OFF',
            'AUTHORITY_ACKNOWLEDGED', 'IN_PROGRESS', 'RESOLUTION_SUBMITTED',
            'RESOLVED', 'REOPENED', 'REJECTED'
        )
    ),
    new_status text not null check (
        new_status in (
            'NEW', 'UNDER_REVIEW', 'VERIFIED', 'ASSIGNED', 'HANDED_OFF',
            'AUTHORITY_ACKNOWLEDGED', 'IN_PROGRESS', 'RESOLUTION_SUBMITTED',
            'RESOLVED', 'REOPENED', 'REJECTED'
        )
    ),
    actor_type text not null check (actor_type in ('system', 'super_admin', 'authority_user')),
    actor_user_id uuid null references auth.users(id) on delete set null,
    note text not null default '',
    source text not null default 'system' check (source in ('telegram', 'admin_dashboard', 'authority_dashboard', 'system')),
    created_at timestamptz not null default now()
);

create table if not exists public.audit_logs (
    id uuid primary key default gen_random_uuid(),
    actor_type text not null check (actor_type in ('system', 'super_admin', 'authority_user')),
    actor_user_id uuid null references auth.users(id) on delete set null,
    action text not null,
    entity_type text not null,
    entity_id uuid null,
    before_value jsonb null,
    after_value jsonb null,
    reason text null,
    created_at timestamptz not null default now()
);

-- ============================================================================
-- 8. AUTHORITY WORKFLOW (HANDOFFS & RESOLUTION)
-- ============================================================================
create table if not exists public.authority_handoffs (
    id uuid primary key default gen_random_uuid(),
    spot_id uuid not null references public.spots(id) on delete cascade,
    organisation_id uuid null references public.organisations(id) on delete set null,
    destination_name text not null,
    handoff_method text not null check (handoff_method in ('official_portal', 'email', 'letter', 'in_person', 'other')),
    submitted_at timestamptz not null default now(),
    official_reference text null,
    proof_evidence_id uuid null references public.evidence(id) on delete set null,
    recorded_by uuid not null references auth.users(id) on delete restrict,
    note text not null,
    created_at timestamptz not null default now()
);

create table if not exists public.resolution_submissions (
    id uuid primary key default gen_random_uuid(),
    spot_id uuid not null references public.spots(id) on delete cascade,
    submitted_by uuid not null references auth.users(id) on delete restrict,
    completion_note text not null,
    completion_date date null,
    work_order_reference text null,
    after_photo_evidence_id uuid not null references public.evidence(id) on delete restrict,
    video_evidence_id uuid null references public.evidence(id) on delete set null,
    review_status text not null default 'pending' check (review_status in ('pending', 'approved', 'rejected', 'more_info_required')),
    reviewed_by uuid null references auth.users(id) on delete set null,
    review_note text null,
    created_at timestamptz not null default now(),
    reviewed_at timestamptz null
);

-- ============================================================================
-- 9. AI ASSESSMENTS (ADVISORY ONLY)
-- ============================================================================
create table if not exists public.ai_assessments (
    id uuid primary key default gen_random_uuid(),
    spot_id uuid not null references public.spots(id) on delete cascade,
    resolution_submission_id uuid null references public.resolution_submissions(id) on delete set null,
    assessment_type text not null check (assessment_type in ('image_eligibility', 'repair_comparison', 'voice_transcription', 'other_category_suggestion')),
    model_name text not null,
    input_evidence_ids jsonb not null default '[]'::jsonb,
    result_code text not null,
    result_text text not null,
    is_advisory_only boolean not null default true check (is_advisory_only = true),
    requested_by uuid not null references auth.users(id) on delete restrict,
    created_at timestamptz not null default now()
);

-- ============================================================================
-- 10. TELEGRAM & NOTIFICATIONS
-- ============================================================================
create table if not exists public.telegram_updates (
    update_id bigint primary key,
    received_at timestamptz not null default now(),
    processed_at timestamptz null,
    processing_status text not null default 'received' check (processing_status in ('received', 'processed', 'failed', 'ignored_duplicate')),
    failure_reason text null
);

create table if not exists public.report_drafts (
    id uuid primary key default gen_random_uuid(),
    citizen_contact_id uuid not null references public.citizen_contacts(id) on delete cascade,
    conversation_state text not null,
    draft_payload jsonb not null default '{}'::jsonb,
    expires_at timestamptz not null,
    updated_at timestamptz not null default now()
);

create table if not exists public.citizen_challenges (
    id uuid primary key default gen_random_uuid(),
    spot_id uuid not null references public.spots(id) on delete cascade,
    report_id uuid null references public.reports(id) on delete set null,
    citizen_contact_id uuid not null references public.citizen_contacts(id) on delete restrict,
    challenge_type text not null check (challenge_type in ('still_not_fixed', 'wrong_location', 'other')),
    note text null,
    status text not null default 'new' check (status in ('new', 'under_review', 'accepted', 'rejected')),
    reviewed_by uuid null references auth.users(id) on delete set null,
    review_note text null,
    created_at timestamptz not null default now(),
    reviewed_at timestamptz null
);

create table if not exists public.notification_outbox (
    id uuid primary key default gen_random_uuid(),
    citizen_contact_id uuid not null references public.citizen_contacts(id) on delete cascade,
    event_type text not null,
    payload jsonb not null default '{}'::jsonb,
    delivery_status text not null default 'pending' check (delivery_status in ('pending', 'sent', 'failed')),
    attempt_count integer not null default 0,
    last_attempt_at timestamptz null,
    last_error text null,
    created_at timestamptz not null default now()
);

-- ============================================================================
-- 11. PILOT SETTINGS
-- ============================================================================
create table if not exists public.pilot_settings (
    id text primary key default 'kharghar_itm_v1',
    pilot_name text not null,
    anchor_description text not null,
    centre_latitude numeric(10, 7) not null,
    centre_longitude numeric(10, 7) not null,
    radius_m integer not null default 500,
    is_active boolean not null default true,
    settings_payload jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

-- ============================================================================
-- 12. PERFORMANCE INDEXES
-- ============================================================================
create index if not exists idx_organisations_slug on public.organisations(slug);
create index if not exists idx_organisations_is_demo on public.organisations(is_demo);
create index if not exists idx_profiles_role on public.profiles(role);
create index if not exists idx_memberships_user on public.organisation_memberships(user_id);
create index if not exists idx_memberships_org on public.organisation_memberships(organisation_id);

create index if not exists idx_citizen_contacts_hash on public.citizen_contacts(telegram_user_hash);

create index if not exists idx_spots_spot_code on public.spots(spot_code);
create index if not exists idx_spots_status on public.spots(status);
create index if not exists idx_spots_pilot_status on public.spots(pilot_id, status);
create index if not exists idx_spots_assigned_org on public.spots(assigned_organisation_id);
create index if not exists idx_spots_geo on public.spots(canonical_latitude, canonical_longitude);
create index if not exists idx_spots_issue_type on public.spots(pilot_id, issue_type_id, status);
create index if not exists idx_spots_public_approved on public.spots(public_approved) where public_approved = true;

create index if not exists idx_reports_ticket_code on public.reports(ticket_code);
create index if not exists idx_reports_created_at on public.reports(created_at desc);
create index if not exists idx_reports_review_status on public.reports(review_status);
create index if not exists idx_reports_spot_id on public.reports(spot_id);
create index if not exists idx_reports_contact_id on public.reports(citizen_contact_id);
create index if not exists idx_reports_geo on public.reports(latitude, longitude);

create index if not exists idx_evidence_report_id on public.evidence(report_id);
create index if not exists idx_evidence_spot_id on public.evidence(spot_id);
create index if not exists idx_evidence_sha256 on public.evidence(sha256);

create index if not exists idx_status_history_spot on public.status_history(spot_id, created_at desc);
create index if not exists idx_authority_handoffs_spot on public.authority_handoffs(spot_id);
create index if not exists idx_resolution_submissions_spot on public.resolution_submissions(spot_id);
create index if not exists idx_ai_assessments_spot on public.ai_assessments(spot_id);
create index if not exists idx_notification_outbox_delivery on public.notification_outbox(delivery_status, created_at);
create index if not exists idx_audit_logs_entity on public.audit_logs(entity_type, entity_id, created_at desc);
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
-- NAGRIK SCHEMA MIGRATION 3: STORAGE BUCKETS & STORAGE RLS POLICIES
-- Authority: TRD Section 11 & PRD Section 8, 10
-- Target Engine: Supabase PostgreSQL (15+) Storage Schema

-- ============================================================================
-- 1. PROVISION STORAGE BUCKETS
-- ============================================================================

-- evidence-private: Private citizen originals & authority uploads (Not publicly readable)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
    'evidence-private',
    'evidence-private',
    false,
    10485760, -- 10MB limit
    array['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'audio/ogg', 'audio/mpeg', 'audio/mp4', 'application/pdf']
)
on conflict (id) do update set
    public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- evidence-public-approved: Sanitised, super-admin-approved derivatives (Publicly readable)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
    'evidence-public-approved',
    'evidence-public-approved',
    true,
    5242880, -- 5MB limit
    array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
    public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- demo-evidence: Synthetic demonstration images completely isolated from live evidence (Publicly readable)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
    'demo-evidence',
    'demo-evidence',
    true,
    5242880, -- 5MB limit
    array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
    public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- ============================================================================
-- 2. STORAGE ROW LEVEL SECURITY POLICIES
-- ============================================================================

-- A. Public read access for public buckets
create policy "storage_public_read_approved"
    on storage.objects
    for select
    using (bucket_id in ('evidence-public-approved', 'demo-evidence'));

-- B. Super-admin full access across all storage buckets
create policy "storage_super_admin_all"
    on storage.objects
    for all
    to authenticated
    using (
        bucket_id in ('evidence-private', 'evidence-public-approved', 'demo-evidence')
        and public.is_super_admin()
    )
    with check (
        bucket_id in ('evidence-private', 'evidence-public-approved', 'demo-evidence')
        and public.is_super_admin()
    );

-- C. Authority access to private bucket:
-- Read private evidence linked to spots assigned to their organisation
create policy "storage_authority_read_private"
    on storage.objects
    for select
    to authenticated
    using (
        bucket_id = 'evidence-private'
        and exists (
            select 1 from public.evidence e
            join public.spots s on e.spot_id = s.id
            where e.storage_path_private = storage.objects.name
            and s.assigned_organisation_id in (select public.get_user_organisations())
        )
    );

-- Upload after-photo/video evidence to private bucket
create policy "storage_authority_insert_private"
    on storage.objects
    for insert
    to authenticated
    with check (
        bucket_id = 'evidence-private'
        and exists (
            select 1 from public.organisation_memberships
            where user_id = auth.uid()
            and is_active = true
            and membership_role in ('authority_admin', 'authority_operator')
        )
    );
-- NAGRIK SCHEMA MIGRATION 4: TRANSACTIONAL FUNCTIONS & TRIGGERS
-- Authority: TRD Section 6.4, 9, 10 & PRD Section 8, 9, 10
-- Target Engine: Supabase PostgreSQL (15+)

-- ============================================================================
-- 1. UPDATED_AT TRIGGER FUNCTION & ATTACHMENTS
-- ============================================================================
create or replace function public.handle_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

create trigger trg_organisations_updated_at
    before update on public.organisations
    for each row execute function public.handle_updated_at();

create trigger trg_profiles_updated_at
    before update on public.profiles
    for each row execute function public.handle_updated_at();

create trigger trg_organisation_memberships_updated_at
    before update on public.organisation_memberships
    for each row execute function public.handle_updated_at();

create trigger trg_spots_updated_at
    before update on public.spots
    for each row execute function public.handle_updated_at();

create trigger trg_reports_updated_at
    before update on public.reports
    for each row execute function public.handle_updated_at();

create trigger trg_report_drafts_updated_at
    before update on public.report_drafts
    for each row execute function public.handle_updated_at();

create trigger trg_pilot_settings_updated_at
    before update on public.pilot_settings
    for each row execute function public.handle_updated_at();

-- ============================================================================
-- 2. CODE GENERATOR FUNCTIONS
-- ============================================================================

-- Format: NAG-KHR-YYYY-XXXXXX
create or replace function public.generate_ticket_code(p_pilot_prefix text default 'KHR')
returns text
language plpgsql
as $$
declare
    v_year text;
    v_seq bigint;
begin
    v_year := to_char(now(), 'YYYY');
    v_seq := nextval('public.nagrik_ticket_seq');
    return 'NAG-' || upper(p_pilot_prefix) || '-' || v_year || '-' || lpad(v_seq::text, 6, '0');
end;
$$;

-- Format: SPT-KHR-XXXXXX
create or replace function public.generate_spot_code(p_pilot_prefix text default 'KHR')
returns text
language plpgsql
as $$
declare
    v_seq bigint;
begin
    v_seq := nextval('public.nagrik_spot_seq');
    return 'SPT-' || upper(p_pilot_prefix) || '-' || lpad(v_seq::text, 6, '0');
end;
$$;

-- ============================================================================
-- 3. TRANSACTIONAL OPERATION: create_report_submission
-- Creates citizen contact, report, evidence metadata, audit event, and notification outbox atomically.
-- ============================================================================
create or replace function public.create_report_submission(
    p_telegram_user_hash text,
    p_encrypted_chat_id text,
    p_language text,
    p_pilot_id text,
    p_group_id text,
    p_category_id text,
    p_issue_type_id text,
    p_description_private text,
    p_latitude numeric,
    p_longitude numeric,
    p_horizontal_accuracy_m numeric,
    p_location_source text,
    p_storage_path_private text default null,
    p_mime_type text default null,
    p_file_size_bytes bigint default null,
    p_sha256 text default null,
    p_telegram_file_unique_id text default null,
    p_telegram_update_id bigint default null,
    p_is_demo boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
    v_contact_id uuid;
    v_ticket_code text;
    v_report_id uuid;
    v_evidence_id uuid;
begin
    -- 1. Upsert citizen contact
    insert into public.citizen_contacts (
        telegram_user_hash,
        encrypted_chat_id,
        language,
        last_seen_at
    )
    values (
        p_telegram_user_hash,
        p_encrypted_chat_id,
        coalesce(p_language, 'en'),
        now()
    )
    on conflict (telegram_user_hash) do update set
        encrypted_chat_id = excluded.encrypted_chat_id,
        language = excluded.language,
        last_seen_at = now()
    returning id into v_contact_id;

    -- 2. Generate ticket code
    v_ticket_code := public.generate_ticket_code('KHR');

    -- 3. Insert report record
    insert into public.reports (
        ticket_code,
        citizen_contact_id,
        pilot_id,
        group_id,
        category_id,
        issue_type_id,
        description_private,
        language,
        latitude,
        longitude,
        horizontal_accuracy_m,
        location_source,
        location_review_status,
        review_status,
        is_demo,
        telegram_update_id
    )
    values (
        v_ticket_code,
        v_contact_id,
        coalesce(p_pilot_id, 'kharghar_itm_v1'),
        p_group_id,
        p_category_id,
        p_issue_type_id,
        p_description_private,
        coalesce(p_language, 'en'),
        p_latitude,
        p_longitude,
        p_horizontal_accuracy_m,
        coalesce(p_location_source, 'telegram_location'),
        'unreviewed',
        'new',
        p_is_demo,
        p_telegram_update_id
    )
    returning id into v_report_id;

    -- 4. Insert evidence if file metadata provided
    if p_storage_path_private is not null and p_sha256 is not null then
        insert into public.evidence (
            report_id,
            evidence_stage,
            storage_path_private,
            mime_type,
            file_size_bytes,
            sha256,
            telegram_file_unique_id,
            uploaded_by_contact_id
        )
        values (
            v_report_id,
            'citizen_initial',
            p_storage_path_private,
            p_mime_type,
            p_file_size_bytes,
            p_sha256,
            p_telegram_file_unique_id,
            v_contact_id
        )
        returning id into v_evidence_id;
    end if;

    -- 5. Write audit log
    insert into public.audit_logs (
        actor_type,
        action,
        entity_type,
        entity_id,
        after_value
    )
    values (
        'system',
        'REPORT_CREATED',
        'report',
        v_report_id,
        jsonb_build_object(
            'ticket_code', v_ticket_code,
            'issue_type_id', p_issue_type_id,
            'is_demo', p_is_demo
        )
    );

    -- 6. Enqueue initial confirmation notification
    insert into public.notification_outbox (
        citizen_contact_id,
        event_type,
        payload
    )
    values (
        v_contact_id,
        'report_received',
        jsonb_build_object(
            'ticket_code', v_ticket_code,
            'language', p_language
        )
    );

    -- 7. Mark Telegram update processed if supplied
    if p_telegram_update_id is not null then
        insert into public.telegram_updates (update_id, processed_at, processing_status)
        values (p_telegram_update_id, now(), 'processed')
        on conflict (update_id) do update set
            processed_at = now(),
            processing_status = 'processed';
    end if;

    return jsonb_build_object(
        'report_id', v_report_id,
        'ticket_code', v_ticket_code,
        'evidence_id', v_evidence_id
    );
end;
$$;

-- ============================================================================
-- 4. TRANSACTIONAL OPERATION: create_spot_for_report
-- Super-admin action: creates physical spot anchor from verified report.
-- ============================================================================
create or replace function public.create_spot_for_report(
    p_report_id uuid,
    p_actor_user_id uuid,
    p_severity_label text default null,
    p_assigned_organisation_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
    v_report record;
    v_spot_id uuid;
    v_spot_code text;
begin
    -- 1. Authorization check
    if not public.is_super_admin() then
        raise exception 'Unauthorized: Only super administrators can create spots';
    end if;

    -- 2. Fetch report
    select * into v_report from public.reports where id = p_report_id;
    if not found then
        raise exception 'Report not found: %', p_report_id;
    end if;

    if v_report.spot_id is not null then
        raise exception 'Report % is already linked to spot %', p_report_id, v_report.spot_id;
    end if;

    if v_report.latitude is null or v_report.longitude is null then
        raise exception 'Cannot create spot: Report has no coordinates';
    end if;

    -- 3. Generate spot code
    v_spot_code := public.generate_spot_code('KHR');

    -- 4. Insert spot record
    insert into public.spots (
        spot_code,
        pilot_id,
        group_id,
        category_id,
        issue_type_id,
        canonical_latitude,
        canonical_longitude,
        anchor_accuracy_m,
        status,
        severity_label,
        assigned_organisation_id,
        public_approved,
        is_demo
    )
    values (
        v_spot_code,
        v_report.pilot_id,
        v_report.group_id,
        v_report.category_id,
        v_report.issue_type_id,
        v_report.latitude,
        v_report.longitude,
        v_report.horizontal_accuracy_m,
        case when p_assigned_organisation_id is not null then 'ASSIGNED' else 'VERIFIED' end,
        p_severity_label,
        p_assigned_organisation_id,
        false,
        v_report.is_demo
    )
    returning id into v_spot_id;

    -- 5. Link report to the newly created spot
    update public.reports
    set spot_id = v_spot_id,
        match_method = 'manual_new_spot',
        match_distance_m = 0,
        matched_by = p_actor_user_id,
        matched_at = now(),
        review_status = 'verified',
        location_review_status = 'confirmed'
    where id = p_report_id;

    -- 6. Link evidence to spot
    update public.evidence
    set spot_id = v_spot_id
    where report_id = p_report_id;

    -- 7. Record status history
    insert into public.status_history (
        spot_id,
        previous_status,
        new_status,
        actor_type,
        actor_user_id,
        note,
        source
    )
    values (
        v_spot_id,
        null,
        case when p_assigned_organisation_id is not null then 'ASSIGNED' else 'VERIFIED' end,
        'super_admin',
        p_actor_user_id,
        'Initial spot created from verified citizen report ' || v_report.ticket_code,
        'admin_dashboard'
    );

    -- 8. Write audit log
    insert into public.audit_logs (
        actor_type,
        actor_user_id,
        action,
        entity_type,
        entity_id,
        after_value
    )
    values (
        'super_admin',
        p_actor_user_id,
        'SPOT_CREATED',
        'spot',
        v_spot_id,
        jsonb_build_object(
            'spot_code', v_spot_code,
            'source_report_id', p_report_id,
            'source_ticket_code', v_report.ticket_code
        )
    );

    return jsonb_build_object(
        'spot_id', v_spot_id,
        'spot_code', v_spot_code
    );
end;
$$;

-- ============================================================================
-- 5. TRANSACTIONAL OPERATION: link_report_to_spot
-- Super-admin action: links citizen report to existing physical spot anchor.
-- ============================================================================
create or replace function public.link_report_to_spot(
    p_report_id uuid,
    p_spot_id uuid,
    p_actor_user_id uuid,
    p_match_distance_m numeric,
    p_match_note text default null
)
returns boolean
language plpgsql
security definer
set search_path = public, auth
as $$
declare
    v_report record;
    v_spot record;
begin
    -- 1. Authorization check
    if not public.is_super_admin() then
        raise exception 'Unauthorized: Only super administrators can link reports';
    end if;

    -- 2. Fetch and validate report and spot
    select * into v_report from public.reports where id = p_report_id;
    if not found then
        raise exception 'Report not found: %', p_report_id;
    end if;

    select * into v_spot from public.spots where id = p_spot_id;
    if not found then
        raise exception 'Spot not found: %', p_spot_id;
    end if;

    -- 3. Link report
    update public.reports
    set spot_id = p_spot_id,
        match_method = 'manual_confirmed',
        match_distance_m = p_match_distance_m,
        matched_by = p_actor_user_id,
        matched_at = now(),
        match_note = p_match_note,
        review_status = 'verified'
    where id = p_report_id;

    -- 4. Associate evidence with spot
    update public.evidence
    set spot_id = p_spot_id
    where report_id = p_report_id and spot_id is null;

    -- 5. Write audit log
    insert into public.audit_logs (
        actor_type,
        actor_user_id,
        action,
        entity_type,
        entity_id,
        after_value
    )
    values (
        'super_admin',
        p_actor_user_id,
        'REPORT_LINKED_TO_SPOT',
        'report',
        p_report_id,
        jsonb_build_object(
            'ticket_code', v_report.ticket_code,
            'spot_id', p_spot_id,
            'spot_code', v_spot.spot_code,
            'match_distance_m', p_match_distance_m,
            'note', p_match_note
        )
    );

    return true;
end;
$$;

-- ============================================================================
-- 6. TRANSACTIONAL OPERATION: transition_spot_status
-- Validates state transition rules, updates status, writes history, audit, and notifications.
-- ============================================================================
create or replace function public.transition_spot_status(
    p_spot_id uuid,
    p_new_status text,
    p_actor_type text,
    p_actor_user_id uuid,
    p_note text,
    p_source text default 'admin_dashboard'
)
returns boolean
language plpgsql
security definer
set search_path = public, auth
as $$
declare
    v_spot record;
    v_is_super boolean;
    v_has_membership boolean;
    v_valid_transition boolean := false;
    v_report record;
begin
    select * into v_spot from public.spots where id = p_spot_id;
    if not found then
        raise exception 'Spot not found: %', p_spot_id;
    end if;

    v_is_super := public.is_super_admin();

    -- Validate user permissions
    if p_actor_type = 'authority_user' then
        select exists (
            select 1 from public.organisation_memberships
            where user_id = p_actor_user_id
            and organisation_id = v_spot.assigned_organisation_id
            and is_active = true
        ) into v_has_membership;

        if not v_has_membership then
            raise exception 'Unauthorized: Authority user is not an active member of the assigned organisation';
        end if;
    elsif p_actor_type = 'super_admin' then
        if not v_is_super then
            raise exception 'Unauthorized: Super admin role required';
        end if;
    elsif p_actor_type != 'system' then
        raise exception 'Invalid actor type: %', p_actor_type;
    end if;

    -- Validate TRD Section 9 state machine
    case v_spot.status
        when 'NEW' then
            if p_new_status in ('UNDER_REVIEW', 'VERIFIED', 'REJECTED') then v_valid_transition := true; end if;
        when 'UNDER_REVIEW' then
            if p_new_status in ('VERIFIED', 'REJECTED') then v_valid_transition := true; end if;
        when 'VERIFIED' then
            if p_new_status in ('ASSIGNED', 'HANDED_OFF', 'REJECTED') then v_valid_transition := true; end if;
        when 'ASSIGNED' then
            if p_new_status in ('AUTHORITY_ACKNOWLEDGED', 'IN_PROGRESS', 'HANDED_OFF', 'REOPENED') then v_valid_transition := true; end if;
        when 'AUTHORITY_ACKNOWLEDGED' then
            if p_new_status in ('IN_PROGRESS', 'HANDED_OFF') then v_valid_transition := true; end if;
        when 'IN_PROGRESS' then
            if p_new_status in ('RESOLUTION_SUBMITTED', 'HANDED_OFF') then v_valid_transition := true; end if;
        when 'HANDED_OFF' then
            if p_new_status in ('IN_PROGRESS', 'RESOLUTION_SUBMITTED', 'RESOLVED') and v_is_super then v_valid_transition := true; end if;
        when 'RESOLUTION_SUBMITTED' then
            if p_new_status in ('RESOLVED', 'IN_PROGRESS') and v_is_super then v_valid_transition := true; end if;
        when 'RESOLVED' then
            if p_new_status = 'REOPENED' and v_is_super then v_valid_transition := true; end if;
        when 'REOPENED' then
            if p_new_status in ('IN_PROGRESS', 'ASSIGNED', 'HANDED_OFF') then v_valid_transition := true; end if;
        when 'REJECTED' then
            if p_new_status = 'UNDER_REVIEW' and v_is_super then v_valid_transition := true; end if;
        else
            v_valid_transition := false;
    end case;

    if not v_valid_transition then
        raise exception 'Illegal status transition from % to % for spot %', v_spot.status, p_new_status, p_spot_id;
    end if;

    -- Invariant: Authority users CANNOT directly mark RESOLVED
    if p_new_status = 'RESOLVED' and p_actor_type != 'super_admin' then
        raise exception 'Forbidden: Only super administrators can resolve issues';
    end if;

    -- Update spot status
    update public.spots
    set status = p_new_status,
        resolved_at = case when p_new_status = 'RESOLVED' then now() else null end
    where id = p_spot_id;

    -- Record status history
    insert into public.status_history (
        spot_id,
        previous_status,
        new_status,
        actor_type,
        actor_user_id,
        note,
        source
    )
    values (
        p_spot_id,
        v_spot.status,
        p_new_status,
        p_actor_type,
        p_actor_user_id,
        coalesce(p_note, ''),
        coalesce(p_source, 'admin_dashboard')
    );

    -- Write audit log
    insert into public.audit_logs (
        actor_type,
        actor_user_id,
        action,
        entity_type,
        entity_id,
        before_value,
        after_value,
        reason
    )
    values (
        p_actor_type,
        p_actor_user_id,
        'SPOT_STATUS_TRANSITION',
        'spot',
        p_spot_id,
        jsonb_build_object('status', v_spot.status),
        jsonb_build_object('status', p_new_status),
        p_note
    );

    -- Enqueue notification outbox for all citizens who submitted reports linked to this spot
    for v_report in select citizen_contact_id, ticket_code, language from public.reports where spot_id = p_spot_id loop
        insert into public.notification_outbox (
            citizen_contact_id,
            event_type,
            payload
        )
        values (
            v_report.citizen_contact_id,
            'status_updated',
            jsonb_build_object(
                'ticket_code', v_report.ticket_code,
                'previous_status', v_spot.status,
                'new_status', p_new_status,
                'language', v_report.language
            )
        );
    end loop;

    return true;
end;
$$;

-- ============================================================================
-- 7. TRANSACTIONAL OPERATION: record_authority_handoff
-- Super-admin records verified physical handoff with proof evidence.
-- ============================================================================
create or replace function public.record_authority_handoff(
    p_spot_id uuid,
    p_destination_name text,
    p_handoff_method text,
    p_recorded_by uuid,
    p_note text,
    p_official_reference text default null,
    p_proof_evidence_id uuid default null,
    p_organisation_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
    v_handoff_id uuid;
begin
    -- 1. Authorization check
    if not public.is_super_admin() then
        raise exception 'Unauthorized: Only super administrators can record handoffs';
    end if;

    if coalesce(trim(p_destination_name), '') = '' then
        raise exception 'Destination name is mandatory for handoff';
    end if;

    if coalesce(trim(p_note), '') = '' then
        raise exception 'Handoff note is mandatory';
    end if;

    -- 2. Insert handoff record
    insert into public.authority_handoffs (
        spot_id,
        organisation_id,
        destination_name,
        handoff_method,
        submitted_at,
        official_reference,
        proof_evidence_id,
        recorded_by,
        note
    )
    values (
        p_spot_id,
        p_organisation_id,
        p_destination_name,
        p_handoff_method,
        now(),
        p_official_reference,
        p_proof_evidence_id,
        p_recorded_by,
        p_note
    )
    returning id into v_handoff_id;

    -- 3. Transition spot to HANDED_OFF
    perform public.transition_spot_status(
        p_spot_id,
        'HANDED_OFF',
        'super_admin',
        p_recorded_by,
        'Handoff recorded to ' || p_destination_name || ' via ' || p_handoff_method,
        'admin_dashboard'
    );

    return v_handoff_id;
end;
$$;

-- ============================================================================
-- 8. TRANSACTIONAL OPERATION: submit_resolution_request
-- Authority user submits repair completion with mandatory after-photo evidence.
-- ============================================================================
create or replace function public.submit_resolution_request(
    p_spot_id uuid,
    p_submitted_by uuid,
    p_completion_note text,
    p_after_photo_evidence_id uuid,
    p_completion_date date default null,
    p_work_order_reference text default null,
    p_video_evidence_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
    v_spot record;
    v_evidence record;
    v_submission_id uuid;
    v_has_membership boolean;
begin
    -- 1. Fetch spot and check assignment
    select * into v_spot from public.spots where id = p_spot_id;
    if not found then
        raise exception 'Spot not found: %', p_spot_id;
    end if;

    select exists (
        select 1 from public.organisation_memberships
        where user_id = p_submitted_by
        and organisation_id = v_spot.assigned_organisation_id
        and is_active = true
    ) into v_has_membership;

    if not v_has_membership and not public.is_super_admin() then
        raise exception 'Unauthorized: User is not an active member of assigned organisation';
    end if;

    -- 2. Validate mandatory after-photo evidence
    select * into v_evidence from public.evidence
    where id = p_after_photo_evidence_id and spot_id = p_spot_id;
    if not found then
        raise exception 'Mandatory after-photo evidence must belong to spot %', p_spot_id;
    end if;

    if coalesce(trim(p_completion_note), '') = '' then
        raise exception 'Completion note is mandatory for resolution request';
    end if;

    -- 3. Insert resolution submission
    insert into public.resolution_submissions (
        spot_id,
        submitted_by,
        completion_note,
        completion_date,
        work_order_reference,
        after_photo_evidence_id,
        video_evidence_id,
        review_status
    )
    values (
        p_spot_id,
        p_submitted_by,
        p_completion_note,
        coalesce(p_completion_date, current_date),
        p_work_order_reference,
        p_after_photo_evidence_id,
        p_video_evidence_id,
        'pending'
    )
    returning id into v_submission_id;

    -- 4. Transition spot to RESOLUTION_SUBMITTED
    perform public.transition_spot_status(
        p_spot_id,
        'RESOLUTION_SUBMITTED',
        case when public.is_super_admin() then 'super_admin' else 'authority_user' end,
        p_submitted_by,
        'Resolution submitted by authority. Note: ' || p_completion_note,
        'authority_dashboard'
    );

    return v_submission_id;
end;
$$;

-- ============================================================================
-- 9. TRANSACTIONAL OPERATION: review_resolution_request
-- Super-admin exclusive review: approve (RESOLVED) or reject/request more info (IN_PROGRESS).
-- ============================================================================
create or replace function public.review_resolution_request(
    p_submission_id uuid,
    p_reviewed_by uuid,
    p_decision text, -- 'approved', 'rejected', 'more_info_required'
    p_review_note text
)
returns boolean
language plpgsql
security definer
set search_path = public, auth
as $$
declare
    v_sub record;
begin
    -- 1. Authorization check
    if not public.is_super_admin() then
        raise exception 'Unauthorized: Only super administrators can review resolution requests';
    end if;

    if p_decision not in ('approved', 'rejected', 'more_info_required') then
        raise exception 'Invalid decision: %. Allowed: approved, rejected, more_info_required', p_decision;
    end if;

    if p_decision in ('rejected', 'more_info_required') and coalesce(trim(p_review_note), '') = '' then
        raise exception 'Review note is mandatory on rejection or info request';
    end if;

    -- 2. Fetch submission
    select * into v_sub from public.resolution_submissions where id = p_submission_id;
    if not found then
        raise exception 'Resolution submission not found: %', p_submission_id;
    end if;

    -- 3. Update resolution submission
    update public.resolution_submissions
    set review_status = p_decision,
        reviewed_by = p_reviewed_by,
        review_note = p_review_note,
        reviewed_at = now()
    where id = p_submission_id;

    -- 4. Transition spot according to decision
    if p_decision = 'approved' then
        perform public.transition_spot_status(
            v_sub.spot_id,
            'RESOLVED',
            'super_admin',
            p_reviewed_by,
            'Resolution approved by super administrator. Note: ' || coalesce(p_review_note, 'Approved'),
            'admin_dashboard'
        );
    else
        perform public.transition_spot_status(
            v_sub.spot_id,
            'IN_PROGRESS',
            'super_admin',
            p_reviewed_by,
            'Resolution rejected/more info requested: ' || p_review_note,
            'admin_dashboard'
        );
    end if;

    return true;
end;
$$;

-- ============================================================================
-- 10. TRANSACTIONAL OPERATION: create_citizen_challenge
-- Records citizen challenge ("Still not fixed") without directly altering spot status.
-- ============================================================================
create or replace function public.create_citizen_challenge(
    p_spot_id uuid,
    p_citizen_contact_id uuid,
    p_challenge_type text,
    p_note text default null,
    p_report_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
    v_challenge_id uuid;
begin
    insert into public.citizen_challenges (
        spot_id,
        report_id,
        citizen_contact_id,
        challenge_type,
        note,
        status
    )
    values (
        p_spot_id,
        p_report_id,
        p_citizen_contact_id,
        p_challenge_type,
        p_note,
        'new'
    )
    returning id into v_challenge_id;

    -- Write audit log
    insert into public.audit_logs (
        actor_type,
        action,
        entity_type,
        entity_id,
        after_value
    )
    values (
        'system',
        'CITIZEN_CHALLENGE_CREATED',
        'citizen_challenge',
        v_challenge_id,
        jsonb_build_object(
            'spot_id', p_spot_id,
            'challenge_type', p_challenge_type
        )
    );

    return v_challenge_id;
end;
$$;
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
-- NAGRIK SCHEMA MIGRATION 6: TRANSACTIONAL WORKFLOW ENGINE & INVARIANTS
-- Authority: TRD Sections 7, 9, 10 & PRD Sections 9, 10, 11
-- Target Engine: Supabase PostgreSQL (15+)
-- Phase: 4 (Civic reporting & resolution workflow engine)

-- ============================================================================
-- 1. TRANSACTIONAL OPERATION: create_spot_for_report
-- Super-admin action: creates physical spot anchor from verified report.
-- Enforces:
--  - Super-admin authorization check
--  - Report existence and eligibility (must not already be linked to a spot)
--  - Canonical coordinate validation (non-null coordinates)
--  - Organisation assignment and demo isolation validation
--  - Immutable anchor creation, report linking, evidence association
--  - Status history and audit log creation atomically
-- ============================================================================
create or replace function public.create_spot_for_report(
    p_report_id uuid,
    p_actor_user_id uuid,
    p_severity_label text default null,
    p_assigned_organisation_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
    v_report record;
    v_spot_id uuid;
    v_spot_code text;
    v_org record;
    v_initial_status text;
begin
    -- 1. Authorization check
    if auth.role() != 'service_role' and not public.is_super_admin() then
        raise exception 'Unauthorized: Only super administrators can create spots';
    end if;

    -- 2. Fetch and validate report
    select * into v_report from public.reports where id = p_report_id;
    if not found then
        raise exception 'Report not found: %', p_report_id;
    end if;

    if v_report.spot_id is not null then
        raise exception 'Report % is already linked to spot %', p_report_id, v_report.spot_id;
    end if;

    if v_report.latitude is null or v_report.longitude is null then
        raise exception 'Cannot create spot: Report has no coordinates';
    end if;

    -- 3. Validate assigned organisation (if provided)
    if p_assigned_organisation_id is not null then
        select * into v_org from public.organisations where id = p_assigned_organisation_id and is_active = true;
        if not found then
            raise exception 'Assigned organisation % not found or inactive', p_assigned_organisation_id;
        end if;

        -- Enforce demo workspace isolation
        if v_report.is_demo = true and v_org.is_demo = false then
            raise exception 'Workspace mismatch: Cannot assign demo spot to live organisation';
        elsif v_report.is_demo = false and v_org.is_demo = true then
            raise exception 'Workspace mismatch: Cannot assign live spot to demo organisation';
        end if;

        v_initial_status := 'ASSIGNED';
    else
        v_initial_status := 'VERIFIED';
    end if;

    -- 4. Generate spot code
    v_spot_code := public.generate_spot_code('KHR');

    -- 5. Insert spot record
    insert into public.spots (
        spot_code,
        pilot_id,
        group_id,
        category_id,
        issue_type_id,
        canonical_latitude,
        canonical_longitude,
        anchor_accuracy_m,
        status,
        severity_label,
        assigned_organisation_id,
        public_approved,
        is_demo
    )
    values (
        v_spot_code,
        v_report.pilot_id,
        v_report.group_id,
        v_report.category_id,
        v_report.issue_type_id,
        v_report.latitude,
        v_report.longitude,
        v_report.horizontal_accuracy_m,
        v_initial_status,
        p_severity_label,
        p_assigned_organisation_id,
        false,
        v_report.is_demo
    )
    returning id into v_spot_id;

    -- 6. Link report to the newly created spot
    update public.reports
    set spot_id = v_spot_id,
        match_method = 'manual_new_spot',
        match_distance_m = 0,
        matched_by = p_actor_user_id,
        matched_at = now(),
        review_status = 'verified',
        location_review_status = 'confirmed'
    where id = p_report_id;

    -- 7. Associate existing report evidence with spot
    update public.evidence
    set spot_id = v_spot_id
    where report_id = p_report_id and spot_id is null;

    -- 8. Record status history
    insert into public.status_history (
        spot_id,
        previous_status,
        new_status,
        actor_type,
        actor_user_id,
        note,
        source
    )
    values (
        v_spot_id,
        null,
        v_initial_status,
        'super_admin',
        p_actor_user_id,
        'Initial spot created from verified citizen report ' || v_report.ticket_code,
        'admin_dashboard'
    );

    -- 9. Write audit log
    insert into public.audit_logs (
        actor_type,
        actor_user_id,
        action,
        entity_type,
        entity_id,
        after_value
    )
    values (
        'super_admin',
        p_actor_user_id,
        'SPOT_CREATED',
        'spot',
        v_spot_id,
        jsonb_build_object(
            'spot_code', v_spot_code,
            'source_report_id', p_report_id,
            'source_ticket_code', v_report.ticket_code,
            'initial_status', v_initial_status,
            'assigned_organisation_id', p_assigned_organisation_id
        )
    );

    return jsonb_build_object(
        'spot_id', v_spot_id,
        'spot_code', v_spot_code,
        'status', v_initial_status
    );
end;
$$;

-- ============================================================================
-- 2. TRANSACTIONAL OPERATION: link_report_to_spot
-- Super-admin action: links an additional verified report to an existing physical spot.
-- Enforces:
--  - Super-admin authorization check
--  - Report and target spot existence
--  - Prevention of duplicate or conflicting links
--  - Strict issue category compatibility
--  - Strict demo/live workspace isolation
--  - Associating evidence and recording audit log atomically
-- ============================================================================
create or replace function public.link_report_to_spot(
    p_report_id uuid,
    p_spot_id uuid,
    p_actor_user_id uuid,
    p_match_distance_m numeric,
    p_match_note text default null
)
returns boolean
language plpgsql
security definer
set search_path = public, auth
as $$
declare
    v_report record;
    v_spot record;
begin
    -- 1. Authorization check
    if auth.role() != 'service_role' and not public.is_super_admin() then
        raise exception 'Unauthorized: Only super administrators can link reports';
    end if;

    -- 2. Fetch and validate report and spot
    select * into v_report from public.reports where id = p_report_id;
    if not found then
        raise exception 'Report not found: %', p_report_id;
    end if;

    select * into v_spot from public.spots where id = p_spot_id;
    if not found then
        raise exception 'Spot not found: %', p_spot_id;
    end if;

    -- 3. Check for existing link
    if v_report.spot_id is not null then
        if v_report.spot_id = p_spot_id then
            raise exception 'Report % is already linked to spot %', p_report_id, p_spot_id;
        else
            raise exception 'Report % is already linked to another spot %', p_report_id, v_report.spot_id;
        end if;
    end if;

    -- 4. Enforce category compatibility
    if v_report.category_id != v_spot.category_id then
        raise exception 'Category mismatch: Report category % does not match Spot category %', v_report.category_id, v_spot.category_id;
    end if;

    -- 5. Enforce demo/live workspace isolation
    if v_report.is_demo != v_spot.is_demo then
        raise exception 'Workspace mismatch: Cannot link demo report to live spot or live report to demo spot';
    end if;

    -- 6. Validate distance
    if p_match_distance_m is not null and p_match_distance_m < 0 then
        raise exception 'Invalid match distance: %', p_match_distance_m;
    end if;

    -- 7. Link report
    update public.reports
    set spot_id = p_spot_id,
        match_method = 'manual_confirmed',
        match_distance_m = p_match_distance_m,
        matched_by = p_actor_user_id,
        matched_at = now(),
        match_note = p_match_note,
        review_status = 'verified'
    where id = p_report_id;

    -- 8. Associate evidence with spot
    update public.evidence
    set spot_id = p_spot_id
    where report_id = p_report_id and spot_id is null;

    -- 9. Write audit log
    insert into public.audit_logs (
        actor_type,
        actor_user_id,
        action,
        entity_type,
        entity_id,
        after_value
    )
    values (
        'super_admin',
        p_actor_user_id,
        'REPORT_LINKED_TO_SPOT',
        'report',
        p_report_id,
        jsonb_build_object(
            'ticket_code', v_report.ticket_code,
            'spot_id', p_spot_id,
            'spot_code', v_spot.spot_code,
            'match_distance_m', p_match_distance_m,
            'note', p_match_note
        )
    );

    return true;
end;
$$;

-- ============================================================================
-- 3. TRANSACTIONAL OPERATION: transition_spot_status
-- Validates state transition graph (TRD Section 9.3), enforces role & organisation
-- boundaries, updates status, writes status_history, audit_logs and notifications atomically.
-- ============================================================================
create or replace function public.transition_spot_status(
    p_spot_id uuid,
    p_new_status text,
    p_actor_type text,
    p_actor_user_id uuid,
    p_note text,
    p_source text default 'admin_dashboard'
)
returns boolean
language plpgsql
security definer
set search_path = public, auth
as $$
declare
    v_spot record;
    v_is_super boolean;
    v_has_membership boolean;
    v_valid_transition boolean := false;
    v_report record;
begin
    -- 1. Fetch spot
    select * into v_spot from public.spots where id = p_spot_id;
    if not found then
        raise exception 'Spot not found: %', p_spot_id;
    end if;

    v_is_super := (auth.role() = 'service_role' or public.is_super_admin());

    -- 2. Validate actor permissions and organisation scope
    if p_actor_type = 'authority_user' then
        if v_spot.assigned_organisation_id is null then
            raise exception 'Unauthorized: Spot is not assigned to any organisation';
        end if;

        select exists (
            select 1 from public.organisation_memberships
            where user_id = p_actor_user_id
            and organisation_id = v_spot.assigned_organisation_id
            and is_active = true
        ) into v_has_membership;

        if not v_has_membership then
            raise exception 'Unauthorized: Authority user is not an active member of the assigned organisation';
        end if;
    elsif p_actor_type = 'super_admin' then
        if not v_is_super then
            raise exception 'Unauthorized: Super admin role required';
        end if;
    elsif p_actor_type = 'system' then
        if auth.role() != 'service_role' and not v_is_super then
            raise exception 'Unauthorized: System role required';
        end if;
    else
        raise exception 'Invalid actor type: %', p_actor_type;
    end if;

    -- 3. Validate TRD Section 9.3 state machine transitions
    case v_spot.status
        when 'NEW' then
            if p_new_status in ('UNDER_REVIEW', 'VERIFIED', 'REJECTED') and v_is_super then
                v_valid_transition := true;
            end if;
        when 'UNDER_REVIEW' then
            if p_new_status in ('VERIFIED', 'REJECTED') and v_is_super then
                v_valid_transition := true;
            end if;
        when 'VERIFIED' then
            if p_new_status in ('ASSIGNED', 'HANDED_OFF', 'REJECTED') and v_is_super then
                v_valid_transition := true;
            end if;
        when 'ASSIGNED' then
            if p_new_status in ('AUTHORITY_ACKNOWLEDGED', 'IN_PROGRESS') then
                v_valid_transition := true;
            elsif p_new_status in ('HANDED_OFF', 'REOPENED') and v_is_super then
                v_valid_transition := true;
            end if;
        when 'AUTHORITY_ACKNOWLEDGED' then
            if p_new_status = 'IN_PROGRESS' then
                v_valid_transition := true;
            elsif p_new_status = 'HANDED_OFF' and v_is_super then
                v_valid_transition := true;
            end if;
        when 'IN_PROGRESS' then
            if p_new_status = 'RESOLUTION_SUBMITTED' then
                v_valid_transition := true;
            elsif p_new_status = 'HANDED_OFF' and v_is_super then
                v_valid_transition := true;
            end if;
        when 'HANDED_OFF' then
            if p_new_status in ('AUTHORITY_ACKNOWLEDGED', 'IN_PROGRESS', 'RESOLUTION_SUBMITTED') then
                v_valid_transition := true;
            elsif p_new_status = 'RESOLVED' and v_is_super then
                v_valid_transition := true;
            end if;
        when 'RESOLUTION_SUBMITTED' then
            if p_new_status in ('RESOLVED', 'IN_PROGRESS') and v_is_super then
                v_valid_transition := true;
            end if;
        when 'RESOLVED' then
            if p_new_status = 'REOPENED' and v_is_super then
                v_valid_transition := true;
            end if;
        when 'REOPENED' then
            if p_new_status = 'IN_PROGRESS' then
                v_valid_transition := true;
            elsif p_new_status in ('ASSIGNED', 'HANDED_OFF') and v_is_super then
                v_valid_transition := true;
            end if;
        when 'REJECTED' then
            if p_new_status = 'UNDER_REVIEW' and v_is_super then
                v_valid_transition := true;
            end if;
        else
            v_valid_transition := false;
    end case;

    if not v_valid_transition then
        raise exception 'Illegal status transition from % to % for spot %', v_spot.status, p_new_status, p_spot_id;
    end if;

    -- 4. Mandatory Invariant: Authority users CANNOT directly mark RESOLVED
    if p_new_status = 'RESOLVED' and p_actor_type != 'super_admin' and auth.role() != 'service_role' then
        raise exception 'Forbidden: Only super administrators can resolve issues';
    end if;

    -- 5. Update spot status
    update public.spots
    set status = p_new_status,
        resolved_at = case when p_new_status = 'RESOLVED' then now() else null end
    where id = p_spot_id;

    -- 6. Record status history
    insert into public.status_history (
        spot_id,
        previous_status,
        new_status,
        actor_type,
        actor_user_id,
        note,
        source
    )
    values (
        p_spot_id,
        v_spot.status,
        p_new_status,
        p_actor_type,
        p_actor_user_id,
        coalesce(p_note, ''),
        coalesce(p_source, 'admin_dashboard')
    );

    -- 7. Write audit log
    insert into public.audit_logs (
        actor_type,
        actor_user_id,
        action,
        entity_type,
        entity_id,
        before_value,
        after_value,
        reason
    )
    values (
        p_actor_type,
        p_actor_user_id,
        'SPOT_STATUS_TRANSITION',
        'spot',
        p_spot_id,
        jsonb_build_object('status', v_spot.status),
        jsonb_build_object('status', p_new_status),
        p_note
    );

    -- 8. Enqueue notification outbox for all citizens who submitted reports linked to this spot
    for v_report in select citizen_contact_id, ticket_code, language from public.reports where spot_id = p_spot_id loop
        insert into public.notification_outbox (
            citizen_contact_id,
            event_type,
            payload
        )
        values (
            v_report.citizen_contact_id,
            'status_updated',
            jsonb_build_object(
                'ticket_code', v_report.ticket_code,
                'previous_status', v_spot.status,
                'new_status', p_new_status,
                'language', v_report.language
            )
        );
    end loop;

    return true;
end;
$$;

-- ============================================================================
-- 4. TRANSACTIONAL OPERATION: record_authority_handoff
-- Super-admin records verified physical handoff with proof evidence and destination.
-- Enforces:
--  - Super-admin authorization check
--  - Mandatory destination name, method, and note
--  - Spot eligibility check
--  - Transition to HANDED_OFF atomically
-- ============================================================================
create or replace function public.record_authority_handoff(
    p_spot_id uuid,
    p_destination_name text,
    p_handoff_method text,
    p_recorded_by uuid,
    p_note text,
    p_official_reference text default null,
    p_proof_evidence_id uuid default null,
    p_organisation_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
    v_spot record;
    v_handoff_id uuid;
    v_org record;
begin
    -- 1. Authorization check
    if auth.role() != 'service_role' and not public.is_super_admin() then
        raise exception 'Unauthorized: Only super administrators can record handoffs';
    end if;

    -- 2. Validate spot
    select * into v_spot from public.spots where id = p_spot_id;
    if not found then
        raise exception 'Spot not found: %', p_spot_id;
    end if;

    if v_spot.status not in ('VERIFIED', 'ASSIGNED', 'IN_PROGRESS', 'AUTHORITY_ACKNOWLEDGED', 'REOPENED') then
        raise exception 'Spot % in status % is not eligible for handoff', p_spot_id, v_spot.status;
    end if;

    -- 3. Validate inputs
    if coalesce(trim(p_destination_name), '') = '' then
        raise exception 'Destination name is mandatory for handoff';
    end if;

    if coalesce(trim(p_handoff_method), '') = '' then
        raise exception 'Handoff method is mandatory';
    end if;

    if coalesce(trim(p_note), '') = '' then
        raise exception 'Handoff note is mandatory';
    end if;

    -- Validate organisation (if provided)
    if p_organisation_id is not null then
        select * into v_org from public.organisations where id = p_organisation_id and is_active = true;
        if not found then
            raise exception 'Organisation % not found or inactive', p_organisation_id;
        end if;

        if v_spot.is_demo = true and v_org.is_demo = false then
            raise exception 'Workspace mismatch: Cannot hand off demo spot to live organisation';
        elsif v_spot.is_demo = false and v_org.is_demo = true then
            raise exception 'Workspace mismatch: Cannot hand off live spot to demo organisation';
        end if;
    end if;

    -- Validate proof evidence (if provided)
    if p_proof_evidence_id is not null then
        if not exists (select 1 from public.evidence where id = p_proof_evidence_id and spot_id = p_spot_id) then
            raise exception 'Proof evidence % does not belong to spot %', p_proof_evidence_id, p_spot_id;
        end if;
    end if;

    -- 4. Insert handoff record
    insert into public.authority_handoffs (
        spot_id,
        organisation_id,
        destination_name,
        handoff_method,
        submitted_at,
        official_reference,
        proof_evidence_id,
        recorded_by,
        note
    )
    values (
        p_spot_id,
        p_organisation_id,
        p_destination_name,
        p_handoff_method,
        now(),
        p_official_reference,
        p_proof_evidence_id,
        p_recorded_by,
        p_note
    )
    returning id into v_handoff_id;

    -- 5. Transition spot to HANDED_OFF
    perform public.transition_spot_status(
        p_spot_id,
        'HANDED_OFF',
        'super_admin',
        p_recorded_by,
        'Handoff recorded to ' || p_destination_name || ' via ' || p_handoff_method || '. Note: ' || p_note,
        'admin_dashboard'
    );

    return v_handoff_id;
end;
$$;

-- ============================================================================
-- 5. TRANSACTIONAL OPERATION: submit_resolution_request
-- Authority user submits repair completion with mandatory after-photo evidence.
-- Enforces:
--  - Submitter must belong to assigned organisation (or be super-admin)
--  - Spot must be in IN_PROGRESS, AUTHORITY_ACKNOWLEDGED, or HANDED_OFF
--  - Mandatory after-photo evidence must exist, belong to this spot, and be in private storage
--  - Mandatory completion note
--  - Transitions spot to RESOLUTION_SUBMITTED atomically
-- ============================================================================
create or replace function public.submit_resolution_request(
    p_spot_id uuid,
    p_submitted_by uuid,
    p_completion_note text,
    p_after_photo_evidence_id uuid,
    p_completion_date date default null,
    p_work_order_reference text default null,
    p_video_evidence_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
    v_spot record;
    v_evidence record;
    v_submission_id uuid;
    v_has_membership boolean;
    v_is_super boolean;
begin
    -- 1. Fetch spot
    select * into v_spot from public.spots where id = p_spot_id;
    if not found then
        raise exception 'Spot not found: %', p_spot_id;
    end if;

    v_is_super := (auth.role() = 'service_role' or public.is_super_admin());

    -- Validate organisation membership first (Access Control boundary)
    if not v_is_super then
        if v_spot.assigned_organisation_id is null then
            raise exception 'Unauthorized: Spot is not assigned to any organisation';
        end if;

        select exists (
            select 1 from public.organisation_memberships
            where user_id = p_submitted_by
            and organisation_id = v_spot.assigned_organisation_id
            and is_active = true
        ) into v_has_membership;

        if not v_has_membership then
            raise exception 'Unauthorized: User is not an active member of assigned organisation';
        end if;
    end if;

    -- Validate status second (Workflow state boundary)
    if v_spot.status not in ('IN_PROGRESS', 'AUTHORITY_ACKNOWLEDGED', 'HANDED_OFF') then
        raise exception 'Spot % in status % cannot submit resolution; must be IN_PROGRESS, AUTHORITY_ACKNOWLEDGED, or HANDED_OFF', p_spot_id, v_spot.status;
    end if;

    -- 2. Validate mandatory after-photo evidence
    if p_after_photo_evidence_id is null then
        raise exception 'Mandatory after-photo evidence ID is required for resolution submission';
    end if;

    select * into v_evidence from public.evidence
    where id = p_after_photo_evidence_id and spot_id = p_spot_id;
    if not found then
        raise exception 'Mandatory after-photo evidence % not found or does not belong to spot %', p_after_photo_evidence_id, p_spot_id;
    end if;

    if v_evidence.storage_path_private is null then
        raise exception 'Evidence % has no private storage path recorded', p_after_photo_evidence_id;
    end if;

    -- Validate completion note
    if coalesce(trim(p_completion_note), '') = '' then
        raise exception 'Completion note is mandatory for resolution request';
    end if;

    -- 3. Validate video evidence (if provided)
    if p_video_evidence_id is not null then
        if not exists (select 1 from public.evidence where id = p_video_evidence_id and spot_id = p_spot_id) then
            raise exception 'Supporting video evidence % does not belong to spot %', p_video_evidence_id, p_spot_id;
        end if;
    end if;

    -- 4. Insert resolution submission
    insert into public.resolution_submissions (
        spot_id,
        submitted_by,
        completion_note,
        completion_date,
        work_order_reference,
        after_photo_evidence_id,
        video_evidence_id,
        review_status
    )
    values (
        p_spot_id,
        p_submitted_by,
        p_completion_note,
        coalesce(p_completion_date, current_date),
        p_work_order_reference,
        p_after_photo_evidence_id,
        p_video_evidence_id,
        'pending'
    )
    returning id into v_submission_id;

    -- 5. Transition spot to RESOLUTION_SUBMITTED
    perform public.transition_spot_status(
        p_spot_id,
        'RESOLUTION_SUBMITTED',
        case when v_is_super then 'super_admin' else 'authority_user' end,
        p_submitted_by,
        'Resolution submitted by authority. Note: ' || p_completion_note,
        'authority_dashboard'
    );

    return v_submission_id;
end;
$$;

-- ============================================================================
-- 6. TRANSACTIONAL OPERATION: review_resolution_request
-- Super-admin exclusive review: approve (RESOLVED) or reject/request more info (IN_PROGRESS).
-- Enforces:
--  - Super-admin authorization check
--  - Pending submission validation (prevents duplicate approval/review)
--  - Review note mandatory on rejection or info request
--  - Transitions spot to RESOLVED or IN_PROGRESS atomically
-- ============================================================================
create or replace function public.review_resolution_request(
    p_submission_id uuid,
    p_reviewed_by uuid,
    p_decision text, -- 'approved', 'rejected', 'more_info_required'
    p_review_note text
)
returns boolean
language plpgsql
security definer
set search_path = public, auth
as $$
declare
    v_sub record;
    v_spot record;
begin
    -- 1. Authorization check
    if auth.role() != 'service_role' and not public.is_super_admin() then
        raise exception 'Unauthorized: Only super administrators can review resolution requests';
    end if;

    if p_decision not in ('approved', 'rejected', 'more_info_required') then
        raise exception 'Invalid decision: %. Allowed: approved, rejected, more_info_required', p_decision;
    end if;

    if p_decision in ('rejected', 'more_info_required') and coalesce(trim(p_review_note), '') = '' then
        raise exception 'Review note is mandatory on rejection or info request';
    end if;

    -- 2. Fetch submission
    select * into v_sub from public.resolution_submissions where id = p_submission_id;
    if not found then
        raise exception 'Resolution submission not found: %', p_submission_id;
    end if;

    if v_sub.review_status != 'pending' then
        raise exception 'Resolution submission % has already been reviewed (current status: %)', p_submission_id, v_sub.review_status;
    end if;

    select * into v_spot from public.spots where id = v_sub.spot_id;
    if not found then
        raise exception 'Referenced spot % not found', v_sub.spot_id;
    end if;

    -- 3. Update resolution submission
    update public.resolution_submissions
    set review_status = p_decision,
        reviewed_by = p_reviewed_by,
        review_note = p_review_note,
        reviewed_at = now()
    where id = p_submission_id;

    -- 4. Transition spot according to decision
    if p_decision = 'approved' then
        perform public.transition_spot_status(
            v_sub.spot_id,
            'RESOLVED',
            'super_admin',
            p_reviewed_by,
            'Resolution approved by super administrator. Note: ' || coalesce(p_review_note, 'Approved'),
            'admin_dashboard'
        );
    else
        perform public.transition_spot_status(
            v_sub.spot_id,
            'IN_PROGRESS',
            'super_admin',
            p_reviewed_by,
            'Resolution rejected/more info requested: ' || p_review_note,
            'admin_dashboard'
        );
    end if;

    return true;
end;
$$;

-- ============================================================================
-- 7. TRANSACTIONAL OPERATION: create_citizen_challenge
-- Records citizen challenge ("Still not fixed") without directly altering spot status.
-- Enforces:
--  - Spot existence check
--  - Citizen contact existence check
--  - Challenge type check ('still_not_fixed', 'wrong_location', 'other')
--  - Rate limiting / spam prevention (1 pending challenge per citizen per spot per 24 hours)
--  - Preserves pseudonymous citizen identity and logs audit event atomically
-- ============================================================================
create or replace function public.create_citizen_challenge(
    p_spot_id uuid,
    p_citizen_contact_id uuid,
    p_challenge_type text,
    p_note text default null,
    p_report_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
    v_spot record;
    v_contact record;
    v_challenge_id uuid;
    v_spam_exists boolean;
begin
    -- 1. Validate spot
    select * into v_spot from public.spots where id = p_spot_id;
    if not found then
        raise exception 'Spot not found: %', p_spot_id;
    end if;

    -- 2. Validate citizen contact
    select * into v_contact from public.citizen_contacts where id = p_citizen_contact_id;
    if not found then
        raise exception 'Citizen contact not found: %', p_citizen_contact_id;
    end if;

    -- 3. Validate optional report association
    if p_report_id is not null then
        if not exists (select 1 from public.reports where id = p_report_id and spot_id = p_spot_id) then
            raise exception 'Report % does not belong to spot %', p_report_id, p_spot_id;
        end if;
    end if;

    -- 4. Validate challenge type
    if p_challenge_type not in ('still_not_fixed', 'wrong_location', 'other') then
        raise exception 'Invalid challenge type: %. Allowed: still_not_fixed, wrong_location, other', p_challenge_type;
    end if;

    -- 5. Spam prevention: check if citizen has a pending challenge on this spot within 24 hours
    select exists (
        select 1 from public.citizen_challenges
        where spot_id = p_spot_id
        and citizen_contact_id = p_citizen_contact_id
        and status in ('new', 'under_review')
        and created_at > (now() - interval '24 hours')
    ) into v_spam_exists;

    if v_spam_exists then
        raise exception 'Duplicate challenge: An active challenge from this citizen is already pending review for spot %', p_spot_id;
    end if;

    -- 6. Insert challenge record
    insert into public.citizen_challenges (
        spot_id,
        report_id,
        citizen_contact_id,
        challenge_type,
        note,
        status
    )
    values (
        p_spot_id,
        p_report_id,
        p_citizen_contact_id,
        p_challenge_type,
        p_note,
        'new'
    )
    returning id into v_challenge_id;

    -- 7. Write audit log (maintaining citizen pseudonymity)
    insert into public.audit_logs (
        actor_type,
        action,
        entity_type,
        entity_id,
        after_value
    )
    values (
        'system',
        'CITIZEN_CHALLENGE_CREATED',
        'citizen_challenge',
        v_challenge_id,
        jsonb_build_object(
            'spot_id', p_spot_id,
            'challenge_type', p_challenge_type
        )
    );

    return v_challenge_id;
end;
$$;

-- ============================================================================
-- 8. GEOSPATIAL HELPER: find_duplicate_candidates
-- Deterministic candidate duplicate matching engine (TRD Section 10).
-- Compares candidate report coordinates against existing spot canonical coordinates.
-- Returns distance and candidate band (STRONG_CANDIDATE, POSSIBLE_CANDIDATE).
-- ============================================================================
create or replace function public.find_duplicate_candidates(
    p_latitude numeric,
    p_longitude numeric,
    p_category_id text,
    p_pilot_id text default 'kharghar_itm_v1',
    p_is_demo boolean default false
)
returns table (
    spot_id uuid,
    spot_code text,
    category_id text,
    issue_type_id text,
    status text,
    canonical_latitude numeric,
    canonical_longitude numeric,
    distance_metres numeric,
    candidate_band text
)
language sql
stable
security definer
set search_path = public, auth
as $$
    with distance_calc as (
        select
            s.id as spot_id,
            s.spot_code,
            s.category_id,
            s.issue_type_id,
            s.status,
            s.canonical_latitude,
            s.canonical_longitude,
            round(
                (6371000 * 2 * asin(sqrt(
                    power(sin(radians(s.canonical_latitude - p_latitude) / 2), 2) +
                    cos(radians(p_latitude)) * cos(radians(s.canonical_latitude)) *
                    power(sin(radians(s.canonical_longitude - p_longitude) / 2), 2)
                )))::numeric,
                2
            ) as distance_metres
        from public.spots s
        where s.category_id = p_category_id
          and s.pilot_id = p_pilot_id
          and s.is_demo = p_is_demo
          and s.status not in ('REJECTED')
          -- Bounding box pre-filter (~25 metres at Kharghar latitude)
          and s.canonical_latitude between (p_latitude - 0.0003) and (p_latitude + 0.0003)
          and s.canonical_longitude between (p_longitude - 0.0003) and (p_longitude + 0.0003)
    )
    select
        dc.spot_id,
        dc.spot_code,
        dc.category_id,
        dc.issue_type_id,
        dc.status,
        dc.canonical_latitude,
        dc.canonical_longitude,
        dc.distance_metres,
        case
            when dc.distance_metres <= 5.0 then 'STRONG_CANDIDATE'
            when dc.distance_metres <= 10.0 then 'POSSIBLE_CANDIDATE'
            else 'NOT_A_CANDIDATE'
        end as candidate_band
    from distance_calc dc
    where dc.distance_metres <= 10.0
    order by dc.distance_metres asc;
$$;

-- ============================================================================
-- 9. PERMISSIONS & GRANTS
-- Revoke execution from anon; grant execution to authenticated and service_role.
-- Internal authorization checks guard all privileged operations.
-- Also ensure authenticated role has table-level privileges for audit and challenges
-- governed strictly by super-admin RLS policies.
-- ============================================================================
grant select on public.audit_logs to authenticated;
grant select, insert, update on public.citizen_challenges to authenticated;

revoke execute on function public.create_spot_for_report(uuid, uuid, text, uuid) from anon;
revoke execute on function public.link_report_to_spot(uuid, uuid, uuid, numeric, text) from anon;
revoke execute on function public.transition_spot_status(uuid, text, text, uuid, text, text) from anon;
revoke execute on function public.record_authority_handoff(uuid, text, text, uuid, text, text, uuid, uuid) from anon;
revoke execute on function public.submit_resolution_request(uuid, uuid, text, uuid, date, text, uuid) from anon;
revoke execute on function public.review_resolution_request(uuid, uuid, text, text) from anon;
revoke execute on function public.create_citizen_challenge(uuid, uuid, text, text, uuid) from anon;
revoke execute on function public.find_duplicate_candidates(numeric, numeric, text, text, boolean) from anon;

grant execute on function public.create_spot_for_report(uuid, uuid, text, uuid) to authenticated, service_role;
grant execute on function public.link_report_to_spot(uuid, uuid, uuid, numeric, text) to authenticated, service_role;
grant execute on function public.transition_spot_status(uuid, text, text, uuid, text, text) to authenticated, service_role;
grant execute on function public.record_authority_handoff(uuid, text, text, uuid, text, text, uuid, uuid) to authenticated, service_role;
grant execute on function public.submit_resolution_request(uuid, uuid, text, uuid, date, text, uuid) to authenticated, service_role;
grant execute on function public.review_resolution_request(uuid, uuid, text, text) to authenticated, service_role;
grant execute on function public.create_citizen_challenge(uuid, uuid, text, text, uuid) to authenticated, service_role;
grant execute on function public.find_duplicate_candidates(numeric, numeric, text, text, boolean) to authenticated, service_role;
-- NAGRIK SCHEMA MIGRATION 7: RPC IDENTITY HARDENING & CONCURRENCY LOCKING
-- Authority: TRD Section 6.4, 9.3, 14.3 & Phase 4C Remediation
-- Target Engine: Supabase PostgreSQL (15+)
-- Phase: 4C (RPC Identity Hardening & Security Remediation)

-- ============================================================================
-- 1. HARDENED: create_spot_for_report
-- Enforces:
--  - Explicit binding of p_actor_user_id to auth.uid() for authenticated callers
--  - Row-level lock (FOR UPDATE) on reports to prevent concurrent double-spot creation
--  - Preserves trusted service-role boundary
-- ============================================================================
create or replace function public.create_spot_for_report(
    p_report_id uuid,
    p_actor_user_id uuid,
    p_severity_label text default null,
    p_assigned_organisation_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
    v_report record;
    v_spot_id uuid;
    v_spot_code text;
    v_org record;
    v_initial_status text;
    v_effective_actor uuid;
begin
    -- 1. Caller identity and authorization check
    if auth.role() != 'service_role' then
        if auth.uid() is null then
            raise exception 'Authentication required';
        end if;
        if not public.is_super_admin() then
            raise exception 'Unauthorized: Only super administrators can create spots';
        end if;
        if p_actor_user_id is not null and p_actor_user_id != auth.uid() then
            raise exception 'Forbidden: Actor user ID does not match authenticated identity';
        end if;
        v_effective_actor := auth.uid();
    else
        v_effective_actor := coalesce(p_actor_user_id, auth.uid());
    end if;

    -- 2. Fetch and lock report (concurrency safety)
    select * into v_report from public.reports where id = p_report_id for update;
    if not found then
        raise exception 'Report not found: %', p_report_id;
    end if;

    if v_report.spot_id is not null then
        raise exception 'Report % is already linked to spot %', p_report_id, v_report.spot_id;
    end if;

    if v_report.latitude is null or v_report.longitude is null then
        raise exception 'Cannot create spot: Report has no coordinates';
    end if;

    -- 3. Validate assigned organisation (if provided)
    if p_assigned_organisation_id is not null then
        select * into v_org from public.organisations where id = p_assigned_organisation_id and is_active = true;
        if not found then
            raise exception 'Assigned organisation % not found or inactive', p_assigned_organisation_id;
        end if;

        -- Enforce demo workspace isolation
        if v_report.is_demo = true and v_org.is_demo = false then
            raise exception 'Workspace mismatch: Cannot assign demo spot to live organisation';
        elsif v_report.is_demo = false and v_org.is_demo = true then
            raise exception 'Workspace mismatch: Cannot assign live spot to demo organisation';
        end if;

        v_initial_status := 'ASSIGNED';
    else
        v_initial_status := 'VERIFIED';
    end if;

    -- 4. Generate spot code
    v_spot_code := public.generate_spot_code('KHR');

    -- 5. Insert spot record
    insert into public.spots (
        spot_code,
        pilot_id,
        group_id,
        category_id,
        issue_type_id,
        canonical_latitude,
        canonical_longitude,
        anchor_accuracy_m,
        status,
        severity_label,
        assigned_organisation_id,
        public_approved,
        is_demo
    )
    values (
        v_spot_code,
        v_report.pilot_id,
        v_report.group_id,
        v_report.category_id,
        v_report.issue_type_id,
        v_report.latitude,
        v_report.longitude,
        v_report.horizontal_accuracy_m,
        v_initial_status,
        p_severity_label,
        p_assigned_organisation_id,
        false,
        v_report.is_demo
    )
    returning id into v_spot_id;

    -- 6. Link report to the newly created spot
    update public.reports
    set spot_id = v_spot_id,
        match_method = 'manual_new_spot',
        match_distance_m = 0,
        matched_by = v_effective_actor,
        matched_at = now(),
        review_status = 'verified',
        location_review_status = 'confirmed'
    where id = p_report_id;

    -- 7. Associate existing report evidence with spot
    update public.evidence
    set spot_id = v_spot_id
    where report_id = p_report_id and spot_id is null;

    -- 8. Record status history
    insert into public.status_history (
        spot_id,
        previous_status,
        new_status,
        actor_type,
        actor_user_id,
        note,
        source
    )
    values (
        v_spot_id,
        null,
        v_initial_status,
        'super_admin',
        v_effective_actor,
        'Initial spot created from verified citizen report ' || v_report.ticket_code,
        'admin_dashboard'
    );

    -- 9. Write audit log
    insert into public.audit_logs (
        actor_type,
        actor_user_id,
        action,
        entity_type,
        entity_id,
        after_value
    )
    values (
        'super_admin',
        v_effective_actor,
        'SPOT_CREATED',
        'spot',
        v_spot_id,
        jsonb_build_object(
            'spot_code', v_spot_code,
            'source_report_id', p_report_id,
            'source_ticket_code', v_report.ticket_code,
            'initial_status', v_initial_status,
            'assigned_organisation_id', p_assigned_organisation_id
        )
    );

    return jsonb_build_object(
        'spot_id', v_spot_id,
        'spot_code', v_spot_code,
        'status', v_initial_status
    );
end;
$$;

-- ============================================================================
-- 2. HARDENED: link_report_to_spot
-- Enforces:
--  - Explicit binding of p_actor_user_id to auth.uid() for authenticated callers
--  - Row-level lock (FOR UPDATE) on reports to prevent concurrent duplicate linking
--  - Preserves trusted service-role boundary
-- ============================================================================
create or replace function public.link_report_to_spot(
    p_report_id uuid,
    p_spot_id uuid,
    p_actor_user_id uuid,
    p_match_distance_m numeric,
    p_match_note text default null
)
returns boolean
language plpgsql
security definer
set search_path = public, auth
as $$
declare
    v_report record;
    v_spot record;
    v_effective_actor uuid;
begin
    -- 1. Caller identity and authorization check
    if auth.role() != 'service_role' then
        if auth.uid() is null then
            raise exception 'Authentication required';
        end if;
        if not public.is_super_admin() then
            raise exception 'Unauthorized: Only super administrators can link reports';
        end if;
        if p_actor_user_id is not null and p_actor_user_id != auth.uid() then
            raise exception 'Forbidden: Actor user ID does not match authenticated identity';
        end if;
        v_effective_actor := auth.uid();
    else
        v_effective_actor := coalesce(p_actor_user_id, auth.uid());
    end if;

    -- 2. Fetch and lock report for concurrency safety
    select * into v_report from public.reports where id = p_report_id for update;
    if not found then
        raise exception 'Report not found: %', p_report_id;
    end if;

    select * into v_spot from public.spots where id = p_spot_id;
    if not found then
        raise exception 'Spot not found: %', p_spot_id;
    end if;

    -- 3. Check for existing link
    if v_report.spot_id is not null then
        if v_report.spot_id = p_spot_id then
            raise exception 'Report % is already linked to spot %', p_report_id, p_spot_id;
        else
            raise exception 'Report % is already linked to another spot %', p_report_id, v_report.spot_id;
        end if;
    end if;

    -- 4. Enforce category compatibility
    if v_report.category_id != v_spot.category_id then
        raise exception 'Category mismatch: Report category % does not match Spot category %', v_report.category_id, v_spot.category_id;
    end if;

    -- 5. Enforce demo/live workspace isolation
    if v_report.is_demo != v_spot.is_demo then
        raise exception 'Workspace mismatch: Cannot link demo report to live spot or live report to demo spot';
    end if;

    -- 6. Validate distance
    if p_match_distance_m is not null and p_match_distance_m < 0 then
        raise exception 'Invalid match distance: %', p_match_distance_m;
    end if;

    -- 7. Link report
    update public.reports
    set spot_id = p_spot_id,
        match_method = 'manual_confirmed',
        match_distance_m = p_match_distance_m,
        matched_by = v_effective_actor,
        matched_at = now(),
        match_note = p_match_note,
        review_status = 'verified'
    where id = p_report_id;

    -- 8. Associate evidence with spot
    update public.evidence
    set spot_id = p_spot_id
    where report_id = p_report_id and spot_id is null;

    -- 9. Write audit log
    insert into public.audit_logs (
        actor_type,
        actor_user_id,
        action,
        entity_type,
        entity_id,
        after_value
    )
    values (
        'super_admin',
        v_effective_actor,
        'REPORT_LINKED_TO_SPOT',
        'report',
        p_report_id,
        jsonb_build_object(
            'ticket_code', v_report.ticket_code,
            'spot_id', p_spot_id,
            'spot_code', v_spot.spot_code,
            'match_distance_m', p_match_distance_m,
            'note', p_match_note
        )
    );

    return true;
end;
$$;

-- ============================================================================
-- 3. HARDENED: transition_spot_status
-- Enforces:
--  - Explicit binding of p_actor_user_id to auth.uid() for authenticated callers
--  - Rejects identity spoofing between authorities or non-admins
--  - Row-level lock (FOR UPDATE) on spots during status transition
--  - Role verification derived from database profiles/memberships
-- ============================================================================
create or replace function public.transition_spot_status(
    p_spot_id uuid,
    p_new_status text,
    p_actor_type text,
    p_actor_user_id uuid,
    p_note text,
    p_source text default 'admin_dashboard'
)
returns boolean
language plpgsql
security definer
set search_path = public, auth
as $$
declare
    v_spot record;
    v_is_super boolean;
    v_has_membership boolean;
    v_valid_transition boolean := false;
    v_report record;
    v_effective_actor uuid;
begin
    -- 1. Fetch and lock spot for concurrency safety
    select * into v_spot from public.spots where id = p_spot_id for update;
    if not found then
        raise exception 'Spot not found: %', p_spot_id;
    end if;

    v_is_super := (auth.role() = 'service_role' or public.is_super_admin());

    -- 2. Strict caller identity verification
    if auth.role() != 'service_role' then
        if auth.uid() is null then
            raise exception 'Authentication required';
        end if;
        if p_actor_user_id is null or p_actor_user_id != auth.uid() then
            raise exception 'Forbidden: Actor user ID does not match authenticated identity';
        end if;
        v_effective_actor := auth.uid();
    else
        v_effective_actor := coalesce(p_actor_user_id, auth.uid());
    end if;

    -- 3. Validate actor permissions and organisation scope
    if p_actor_type = 'authority_user' then
        if v_spot.assigned_organisation_id is null then
            raise exception 'Unauthorized: Spot is not assigned to any organisation';
        end if;

        select exists (
            select 1 from public.organisation_memberships
            where user_id = v_effective_actor
            and organisation_id = v_spot.assigned_organisation_id
            and is_active = true
        ) into v_has_membership;

        if not v_has_membership then
            raise exception 'Unauthorized: Authority user is not an active member of the assigned organisation';
        end if;
    elsif p_actor_type = 'super_admin' then
        if not v_is_super then
            raise exception 'Unauthorized: Super admin role required';
        end if;
    elsif p_actor_type = 'system' then
        if auth.role() != 'service_role' and not v_is_super then
            raise exception 'Unauthorized: System role required';
        end if;
    else
        raise exception 'Invalid actor type: %', p_actor_type;
    end if;

    -- 4. Validate TRD Section 9.3 state machine transitions
    case v_spot.status
        when 'NEW' then
            if p_new_status in ('UNDER_REVIEW', 'VERIFIED', 'REJECTED') and v_is_super then
                v_valid_transition := true;
            end if;
        when 'UNDER_REVIEW' then
            if p_new_status in ('VERIFIED', 'REJECTED') and v_is_super then
                v_valid_transition := true;
            end if;
        when 'VERIFIED' then
            if p_new_status in ('ASSIGNED', 'HANDED_OFF', 'REJECTED') and v_is_super then
                v_valid_transition := true;
            end if;
        when 'ASSIGNED' then
            if p_new_status in ('AUTHORITY_ACKNOWLEDGED', 'IN_PROGRESS') then
                v_valid_transition := true;
            elsif p_new_status in ('HANDED_OFF', 'REOPENED') and v_is_super then
                v_valid_transition := true;
            end if;
        when 'AUTHORITY_ACKNOWLEDGED' then
            if p_new_status = 'IN_PROGRESS' then
                v_valid_transition := true;
            elsif p_new_status = 'HANDED_OFF' and v_is_super then
                v_valid_transition := true;
            end if;
        when 'IN_PROGRESS' then
            if p_new_status = 'RESOLUTION_SUBMITTED' then
                v_valid_transition := true;
            elsif p_new_status = 'HANDED_OFF' and v_is_super then
                v_valid_transition := true;
            end if;
        when 'HANDED_OFF' then
            if p_new_status in ('AUTHORITY_ACKNOWLEDGED', 'IN_PROGRESS', 'RESOLUTION_SUBMITTED') then
                v_valid_transition := true;
            elsif p_new_status = 'RESOLVED' and v_is_super then
                v_valid_transition := true;
            end if;
        when 'RESOLUTION_SUBMITTED' then
            if p_new_status in ('RESOLVED', 'IN_PROGRESS') and v_is_super then
                v_valid_transition := true;
            end if;
        when 'RESOLVED' then
            if p_new_status = 'REOPENED' and v_is_super then
                v_valid_transition := true;
            end if;
        when 'REOPENED' then
            if p_new_status = 'IN_PROGRESS' then
                v_valid_transition := true;
            elsif p_new_status in ('ASSIGNED', 'HANDED_OFF') and v_is_super then
                v_valid_transition := true;
            end if;
        when 'REJECTED' then
            if p_new_status = 'UNDER_REVIEW' and v_is_super then
                v_valid_transition := true;
            end if;
        else
            v_valid_transition := false;
    end case;

    if not v_valid_transition then
        raise exception 'Illegal status transition from % to % for spot %', v_spot.status, p_new_status, p_spot_id;
    end if;

    -- 5. Mandatory Invariant: Authority users CANNOT directly mark RESOLVED
    if p_new_status = 'RESOLVED' and p_actor_type != 'super_admin' and auth.role() != 'service_role' then
        raise exception 'Forbidden: Only super administrators can resolve issues';
    end if;

    -- 6. Update spot status
    update public.spots
    set status = p_new_status,
        resolved_at = case when p_new_status = 'RESOLVED' then now() else null end
    where id = p_spot_id;

    -- 7. Record status history
    insert into public.status_history (
        spot_id,
        previous_status,
        new_status,
        actor_type,
        actor_user_id,
        note,
        source
    )
    values (
        p_spot_id,
        v_spot.status,
        p_new_status,
        p_actor_type,
        v_effective_actor,
        coalesce(p_note, ''),
        coalesce(p_source, 'admin_dashboard')
    );

    -- 8. Write audit log
    insert into public.audit_logs (
        actor_type,
        actor_user_id,
        action,
        entity_type,
        entity_id,
        before_value,
        after_value,
        reason
    )
    values (
        p_actor_type,
        v_effective_actor,
        'SPOT_STATUS_TRANSITION',
        'spot',
        p_spot_id,
        jsonb_build_object('status', v_spot.status),
        jsonb_build_object('status', p_new_status),
        p_note
    );

    -- 9. Enqueue notification outbox for all citizens who submitted reports linked to this spot
    for v_report in select citizen_contact_id, ticket_code, language from public.reports where spot_id = p_spot_id loop
        insert into public.notification_outbox (
            citizen_contact_id,
            event_type,
            payload
        )
        values (
            v_report.citizen_contact_id,
            'status_updated',
            jsonb_build_object(
                'ticket_code', v_report.ticket_code,
                'previous_status', v_spot.status,
                'new_status', p_new_status,
                'language', v_report.language
            )
        );
    end loop;

    return true;
end;
$$;

-- ============================================================================
-- 4. HARDENED: record_authority_handoff
-- Enforces:
--  - Explicit binding of p_recorded_by to auth.uid() for authenticated callers
--  - Row-level lock (FOR UPDATE) on spots during handoff
--  - Mandatory destination, method, note
-- ============================================================================
create or replace function public.record_authority_handoff(
    p_spot_id uuid,
    p_destination_name text,
    p_handoff_method text,
    p_recorded_by uuid,
    p_note text,
    p_official_reference text default null,
    p_proof_evidence_id uuid default null,
    p_organisation_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
    v_spot record;
    v_handoff_id uuid;
    v_org record;
    v_effective_actor uuid;
begin
    -- 1. Caller identity and authorization check
    if auth.role() != 'service_role' then
        if auth.uid() is null then
            raise exception 'Authentication required';
        end if;
        if not public.is_super_admin() then
            raise exception 'Unauthorized: Only super administrators can record handoffs';
        end if;
        if p_recorded_by is not null and p_recorded_by != auth.uid() then
            raise exception 'Forbidden: Recorded-by user ID does not match authenticated identity';
        end if;
        v_effective_actor := auth.uid();
    else
        v_effective_actor := coalesce(p_recorded_by, auth.uid());
    end if;

    -- 2. Validate spot and lock row
    select * into v_spot from public.spots where id = p_spot_id for update;
    if not found then
        raise exception 'Spot not found: %', p_spot_id;
    end if;

    if v_spot.status not in ('VERIFIED', 'ASSIGNED', 'IN_PROGRESS', 'AUTHORITY_ACKNOWLEDGED', 'REOPENED') then
        raise exception 'Spot % in status % is not eligible for handoff', p_spot_id, v_spot.status;
    end if;

    -- 3. Validate inputs
    if coalesce(trim(p_destination_name), '') = '' then
        raise exception 'Destination name is mandatory for handoff';
    end if;

    if coalesce(trim(p_handoff_method), '') = '' then
        raise exception 'Handoff method is mandatory';
    end if;

    if coalesce(trim(p_note), '') = '' then
        raise exception 'Handoff note is mandatory';
    end if;

    -- Validate organisation (if provided)
    if p_organisation_id is not null then
        select * into v_org from public.organisations where id = p_organisation_id and is_active = true;
        if not found then
            raise exception 'Organisation % not found or inactive', p_organisation_id;
        end if;

        if v_spot.is_demo = true and v_org.is_demo = false then
            raise exception 'Workspace mismatch: Cannot hand off demo spot to live organisation';
        elsif v_spot.is_demo = false and v_org.is_demo = true then
            raise exception 'Workspace mismatch: Cannot hand off live spot to demo organisation';
        end if;
    end if;

    -- Validate proof evidence (if provided)
    if p_proof_evidence_id is not null then
        if not exists (select 1 from public.evidence where id = p_proof_evidence_id and spot_id = p_spot_id) then
            raise exception 'Proof evidence % does not belong to spot %', p_proof_evidence_id, p_spot_id;
        end if;
    end if;

    -- 4. Insert handoff record
    insert into public.authority_handoffs (
        spot_id,
        organisation_id,
        destination_name,
        handoff_method,
        submitted_at,
        official_reference,
        proof_evidence_id,
        recorded_by,
        note
    )
    values (
        p_spot_id,
        p_organisation_id,
        p_destination_name,
        p_handoff_method,
        now(),
        p_official_reference,
        p_proof_evidence_id,
        v_effective_actor,
        p_note
    )
    returning id into v_handoff_id;

    -- 5. Transition spot to HANDED_OFF
    perform public.transition_spot_status(
        p_spot_id,
        'HANDED_OFF',
        'super_admin',
        v_effective_actor,
        'Handoff recorded to ' || p_destination_name || ' via ' || p_handoff_method || '. Note: ' || p_note,
        'admin_dashboard'
    );

    return v_handoff_id;
end;
$$;

-- ============================================================================
-- 5. HARDENED: submit_resolution_request
-- Enforces:
--  - Explicit binding of p_submitted_by to auth.uid() for authenticated callers
--  - Rejects identity spoofing between authorities
--  - Row-level lock (FOR UPDATE) on spots during resolution submission
--  - Mandatory after-photo in private storage
-- ============================================================================
create or replace function public.submit_resolution_request(
    p_spot_id uuid,
    p_submitted_by uuid,
    p_completion_note text,
    p_after_photo_evidence_id uuid,
    p_completion_date date default null,
    p_work_order_reference text default null,
    p_video_evidence_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
    v_spot record;
    v_evidence record;
    v_submission_id uuid;
    v_has_membership boolean;
    v_is_super boolean;
    v_effective_actor uuid;
begin
    -- 1. Fetch and lock spot
    select * into v_spot from public.spots where id = p_spot_id for update;
    if not found then
        raise exception 'Spot not found: %', p_spot_id;
    end if;

    v_is_super := (auth.role() = 'service_role' or public.is_super_admin());

    -- 2. Caller identity verification
    if auth.role() != 'service_role' then
        if auth.uid() is null then
            raise exception 'Authentication required';
        end if;
        if p_submitted_by is null or p_submitted_by != auth.uid() then
            raise exception 'Forbidden: Submitter user ID does not match authenticated identity';
        end if;
        v_effective_actor := auth.uid();
    else
        v_effective_actor := coalesce(p_submitted_by, auth.uid());
    end if;

    -- 3. Validate organisation membership (Access Control boundary)
    if not v_is_super then
        if v_spot.assigned_organisation_id is null then
            raise exception 'Unauthorized: Spot is not assigned to any organisation';
        end if;

        select exists (
            select 1 from public.organisation_memberships
            where user_id = v_effective_actor
            and organisation_id = v_spot.assigned_organisation_id
            and is_active = true
        ) into v_has_membership;

        if not v_has_membership then
            raise exception 'Unauthorized: User is not an active member of assigned organisation';
        end if;
    end if;

    -- 4. Validate status (Workflow state boundary)
    if v_spot.status not in ('IN_PROGRESS', 'AUTHORITY_ACKNOWLEDGED', 'HANDED_OFF') then
        raise exception 'Spot % in status % cannot submit resolution; must be IN_PROGRESS, AUTHORITY_ACKNOWLEDGED, or HANDED_OFF', p_spot_id, v_spot.status;
    end if;

    -- 5. Validate mandatory after-photo evidence
    if p_after_photo_evidence_id is null then
        raise exception 'Mandatory after-photo evidence ID is required for resolution submission';
    end if;

    select * into v_evidence from public.evidence
    where id = p_after_photo_evidence_id and spot_id = p_spot_id;
    if not found then
        raise exception 'Mandatory after-photo evidence % not found or does not belong to spot %', p_after_photo_evidence_id, p_spot_id;
    end if;

    if v_evidence.storage_path_private is null then
        raise exception 'Evidence % has no private storage path recorded', p_after_photo_evidence_id;
    end if;

    -- Validate completion note
    if coalesce(trim(p_completion_note), '') = '' then
        raise exception 'Completion note is mandatory for resolution request';
    end if;

    -- 6. Validate video evidence (if provided)
    if p_video_evidence_id is not null then
        if not exists (select 1 from public.evidence where id = p_video_evidence_id and spot_id = p_spot_id) then
            raise exception 'Supporting video evidence % does not belong to spot %', p_video_evidence_id, p_spot_id;
        end if;
    end if;

    -- 7. Insert resolution submission
    insert into public.resolution_submissions (
        spot_id,
        submitted_by,
        completion_note,
        completion_date,
        work_order_reference,
        after_photo_evidence_id,
        video_evidence_id,
        review_status
    )
    values (
        p_spot_id,
        v_effective_actor,
        p_completion_note,
        coalesce(p_completion_date, current_date),
        p_work_order_reference,
        p_after_photo_evidence_id,
        p_video_evidence_id,
        'pending'
    )
    returning id into v_submission_id;

    -- 8. Transition spot to RESOLUTION_SUBMITTED
    perform public.transition_spot_status(
        p_spot_id,
        'RESOLUTION_SUBMITTED',
        case when v_is_super then 'super_admin' else 'authority_user' end,
        v_effective_actor,
        'Resolution submitted by authority. Note: ' || p_completion_note,
        'authority_dashboard'
    );

    return v_submission_id;
end;
$$;

-- ============================================================================
-- 6. HARDENED: review_resolution_request
-- Enforces:
--  - Explicit binding of p_reviewed_by to auth.uid() for authenticated callers
--  - Super-admin authorization derived from database profiles
--  - Row-level lock (FOR UPDATE) on resolution_submissions
-- ============================================================================
create or replace function public.review_resolution_request(
    p_submission_id uuid,
    p_reviewed_by uuid,
    p_decision text,
    p_review_note text
)
returns boolean
language plpgsql
security definer
set search_path = public, auth
as $$
declare
    v_sub record;
    v_spot record;
    v_effective_actor uuid;
begin
    -- 1. Caller identity and authorization check
    if auth.role() != 'service_role' then
        if auth.uid() is null then
            raise exception 'Authentication required';
        end if;
        if not public.is_super_admin() then
            raise exception 'Unauthorized: Only super administrators can review resolution requests';
        end if;
        if p_reviewed_by is not null and p_reviewed_by != auth.uid() then
            raise exception 'Forbidden: Reviewer user ID does not match authenticated identity';
        end if;
        v_effective_actor := auth.uid();
    else
        v_effective_actor := coalesce(p_reviewed_by, auth.uid());
    end if;

    if p_decision not in ('approved', 'rejected', 'more_info_required') then
        raise exception 'Invalid decision: %. Allowed: approved, rejected, more_info_required', p_decision;
    end if;

    if p_decision in ('rejected', 'more_info_required') and coalesce(trim(p_review_note), '') = '' then
        raise exception 'Review note is mandatory on rejection or info request';
    end if;

    -- 2. Fetch and lock submission
    select * into v_sub from public.resolution_submissions where id = p_submission_id for update;
    if not found then
        raise exception 'Resolution submission not found: %', p_submission_id;
    end if;

    if v_sub.review_status != 'pending' then
        raise exception 'Resolution submission % has already been reviewed (current status: %)', p_submission_id, v_sub.review_status;
    end if;

    select * into v_spot from public.spots where id = v_sub.spot_id;
    if not found then
        raise exception 'Referenced spot % not found', v_sub.spot_id;
    end if;

    -- 3. Update resolution submission
    update public.resolution_submissions
    set review_status = p_decision,
        reviewed_by = v_effective_actor,
        review_note = p_review_note,
        reviewed_at = now()
    where id = p_submission_id;

    -- 4. Transition spot according to decision
    if p_decision = 'approved' then
        perform public.transition_spot_status(
            v_sub.spot_id,
            'RESOLVED',
            'super_admin',
            v_effective_actor,
            'Resolution approved by super administrator. Note: ' || coalesce(p_review_note, 'Approved'),
            'admin_dashboard'
        );
    else
        perform public.transition_spot_status(
            v_sub.spot_id,
            'IN_PROGRESS',
            'super_admin',
            v_effective_actor,
            'Resolution rejected/more info requested: ' || p_review_note,
            'admin_dashboard'
        );
    end if;

    return true;
end;
$$;

-- ============================================================================
-- 7. RE-CONFIRM PERMISSIONS & EXECUTION GRANTS
-- Revoke execution from anon; grant execution to authenticated and service_role.
-- ============================================================================
revoke execute on function public.create_spot_for_report(uuid, uuid, text, uuid) from anon;
revoke execute on function public.link_report_to_spot(uuid, uuid, uuid, numeric, text) from anon;
revoke execute on function public.transition_spot_status(uuid, text, text, uuid, text, text) from anon;
revoke execute on function public.record_authority_handoff(uuid, text, text, uuid, text, text, uuid, uuid) from anon;
revoke execute on function public.submit_resolution_request(uuid, uuid, text, uuid, date, text, uuid) from anon;
revoke execute on function public.review_resolution_request(uuid, uuid, text, text) from anon;

grant execute on function public.create_spot_for_report(uuid, uuid, text, uuid) to authenticated, service_role;
grant execute on function public.link_report_to_spot(uuid, uuid, uuid, numeric, text) to authenticated, service_role;
grant execute on function public.transition_spot_status(uuid, text, text, uuid, text, text) to authenticated, service_role;
grant execute on function public.record_authority_handoff(uuid, text, text, uuid, text, text, uuid, uuid) to authenticated, service_role;
grant execute on function public.submit_resolution_request(uuid, uuid, text, uuid, date, text, uuid) to authenticated, service_role;
grant execute on function public.review_resolution_request(uuid, uuid, text, text) to authenticated, service_role;
-- ============================================================================
-- NAGRIK — PHASE 4D: DATABASE SECURITY & WORKFLOW INVARIANT REMEDIATION
-- Migration: 20261115000008_security_and_invariant_remediation.sql
-- Description:
--   1. Schema Privilege Lockdown: Revoke CREATE on public from PUBLIC, anon, authenticated.
--   2. Function Privilege Lockdown: Revoke EXECUTE from PUBLIC and anon on all functions;
--      alter default privileges to prevent automatic execution grants on future functions.
--   3. Fix Citizen Challenges: Impersonation prevention (service-role only), status eligibility
--      (strictly RESOLVED spots), concurrency protection (FOR UPDATE locks and partial unique index).
--   4. Fix Resolution Invariant: Eliminate HANDED_OFF -> RESOLVED bypass; enforce at database
--      trigger level that RESOLVED is strictly reachable from RESOLUTION_SUBMITTED with verified
--      after-photo evidence and approved submission.
--   5. Search Path Hardening: Set search_path = pg_catalog, public, auth, pg_temp on all SECURITY DEFINER RPCs.
--   6. Public Coordinate Privacy: Discretize coordinates in public_spots and public_demo_spots
--      onto a deterministic 25-50m grid (~33m x ~31.5m, step size 0.0003 deg) per TRD Section 13.3.
-- ============================================================================

-- ============================================================================
-- 1. PUBLIC SCHEMA AND DEFAULT PRIVILEGE HARDENING
-- ============================================================================

-- A. Revoke schema creation privileges
revoke create on schema public from public;
revoke create on schema public from anon;
revoke create on schema public from authenticated;

-- Ensure usage permissions remain active for application roles
grant usage on schema public to authenticated, anon, service_role;

-- B. Alter default privileges for future functions created by migration owner
alter default privileges in schema public revoke execute on functions from public;
alter default privileges in schema public revoke execute on functions from anon;

-- C. Revoke execute privileges from PUBLIC and anon on all existing functions in public
revoke execute on all functions in schema public from public;
revoke execute on all functions in schema public from anon;


-- ============================================================================
-- 2. PARTIAL UNIQUE INDEX FOR CITIZEN CHALLENGES (CONCURRENCY PROTECTION)
-- ============================================================================

-- Prevent concurrent or duplicate active challenges from the same citizen on the same spot
create unique index if not exists idx_citizen_challenges_active_unique
    on public.citizen_challenges (spot_id, citizen_contact_id)
    where status in ('new', 'under_review');


-- ============================================================================
-- 3. REMEDIATED CITIZEN CHALLENGE FUNCTION
-- Enforces:
--   - Role restriction: service_role or authenticated super_admin only (prevents citizen impersonation)
--   - Spot eligibility: strictly RESOLVED spots only
--   - Concurrency locking: row locks on spot and citizen_contact
--   - 24-hour rate limiting and active challenge uniqueness
-- ============================================================================

create or replace function public.create_citizen_challenge(
    p_spot_id uuid,
    p_citizen_contact_id uuid,
    p_challenge_type text,
    p_note text default null,
    p_report_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, auth, pg_temp
as $$
declare
    v_spot record;
    v_contact record;
    v_challenge_id uuid;
    v_spam_exists boolean;
    v_effective_actor uuid;
begin
    -- 1. Identity & Authorization Check
    -- Untrusted web callers cannot supply arbitrary citizen_contact_id.
    -- Execution restricted to service_role (Telegram bot webhook) or authenticated super_admin.
    if auth.role() != 'service_role' then
        if auth.uid() is null then
            raise exception 'Authentication required';
        end if;
        if not public.is_super_admin() then
            raise exception 'Forbidden: Citizen challenges must be submitted through verified service-role or administrative review';
        end if;
        v_effective_actor := auth.uid();
    else
        v_effective_actor := null;
    end if;

    -- 2. Row Lock & Validate Spot
    select * into v_spot from public.spots where id = p_spot_id for update;
    if not found then
        raise exception 'Spot not found: %', p_spot_id;
    end if;

    -- 3. Eligibility Check: Citizen challenges are strictly restricted to RESOLVED spots
    if v_spot.status != 'RESOLVED' then
        raise exception 'Illegal challenge: Citizen challenges can only be filed against RESOLVED spots (current status: %)', v_spot.status;
    end if;

    -- 4. Row Lock & Validate Citizen Contact
    select * into v_contact from public.citizen_contacts where id = p_citizen_contact_id for update;
    if not found then
        raise exception 'Citizen contact not found: %', p_citizen_contact_id;
    end if;

    -- 5. Validate Optional Report Association
    if p_report_id is not null then
        if not exists (select 1 from public.reports where id = p_report_id and spot_id = p_spot_id) then
            raise exception 'Report % does not belong to spot %', p_report_id, p_spot_id;
        end if;
    end if;

    -- 6. Validate Challenge Type
    if p_challenge_type not in ('still_not_fixed', 'wrong_location', 'other') then
        raise exception 'Invalid challenge type: %. Allowed: still_not_fixed, wrong_location, other', p_challenge_type;
    end if;

    -- 7. 24-Hour Rate Limiting & Spam Prevention
    select exists (
        select 1 from public.citizen_challenges
        where spot_id = p_spot_id
          and citizen_contact_id = p_citizen_contact_id
          and (
              status in ('new', 'under_review')
              or created_at > (now() - interval '24 hours')
          )
    ) into v_spam_exists;

    if v_spam_exists then
        raise exception 'Duplicate challenge: An active challenge from this citizen is already pending review or was submitted within the last 24 hours for spot %', p_spot_id;
    end if;

    -- 8. Insert Challenge Record
    insert into public.citizen_challenges (
        spot_id,
        report_id,
        citizen_contact_id,
        challenge_type,
        note,
        status
    )
    values (
        p_spot_id,
        p_report_id,
        p_citizen_contact_id,
        p_challenge_type,
        p_note,
        'new'
    )
    returning id into v_challenge_id;

    -- 9. Audit Event
    insert into public.audit_logs (
        actor_type,
        actor_user_id,
        action,
        entity_type,
        entity_id,
        after_value
    )
    values (
        case when auth.role() = 'service_role' then 'system' else 'super_admin' end,
        v_effective_actor,
        'CITIZEN_CHALLENGE_CREATED',
        'citizen_challenge',
        v_challenge_id,
        jsonb_build_object(
            'spot_id', p_spot_id,
            'challenge_type', p_challenge_type,
            'citizen_contact_id', p_citizen_contact_id
        )
    );

    return v_challenge_id;
end;
$$;

-- Restrict execution: service_role for Telegram bot, authenticated for super-admin review logging
revoke execute on function public.create_citizen_challenge(uuid, uuid, text, text, uuid) from public, anon, authenticated;
grant execute on function public.create_citizen_challenge(uuid, uuid, text, text, uuid) to service_role, authenticated;


-- ============================================================================
-- 4. HARDENED RESOLUTION GUARD TRIGGER
-- Enforces:
--   - Role restriction: only super_admin or service_role
--   - Source state invariant: RESOLVED can only be reached from RESOLUTION_SUBMITTED
--   - Verification invariant: Must have an approved resolution submission with verified after-photo evidence
-- ============================================================================

create or replace function public.guard_spot_resolution()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, auth, pg_temp
as $$
declare
    v_has_approved_resolution boolean;
begin
    if new.status = 'RESOLVED' and old.status is distinct from 'RESOLVED' then
        -- 1. Actor Check
        if auth.role() != 'service_role' and not public.is_super_admin() then
            raise exception 'Forbidden: Only super administrators can approve issue resolution';
        end if;

        -- 2. State Machine Invariant: RESOLVED can ONLY be transitioned from RESOLUTION_SUBMITTED
        if old.status != 'RESOLUTION_SUBMITTED' then
            raise exception 'Illegal resolution: Spot % can only be transitioned to RESOLVED from RESOLUTION_SUBMITTED state (attempted from %)', new.id, old.status;
        end if;

        -- 3. Verification Invariant: Must have an approved resolution submission with verified after-photo evidence
        select exists (
            select 1 from public.resolution_submissions rs
            join public.evidence e on e.id = rs.after_photo_evidence_id
            where rs.spot_id = new.id
              and rs.review_status = 'approved'
              and e.spot_id = new.id
        ) into v_has_approved_resolution;

        if not v_has_approved_resolution then
            raise exception 'Illegal resolution: Spot % lacks an approved resolution submission with verified after-repair photo evidence', new.id;
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


-- ============================================================================
-- 5. HARDENED TRANSITION_SPOT_STATUS
-- Enforces:
--   - Removal of HANDED_OFF -> RESOLVED bypass (RESOLVED only reachable from RESOLUTION_SUBMITTED)
--   - Hardened search_path = pg_catalog, public, auth, pg_temp
-- ============================================================================

create or replace function public.transition_spot_status(
    p_spot_id uuid,
    p_new_status text,
    p_actor_type text,
    p_actor_user_id uuid,
    p_note text,
    p_source text default 'admin_dashboard'
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public, auth, pg_temp
as $$
declare
    v_spot record;
    v_is_super boolean;
    v_has_membership boolean;
    v_valid_transition boolean := false;
    v_effective_actor uuid;
begin
    -- 1. Fetch and lock spot for concurrency safety
    select * into v_spot from public.spots where id = p_spot_id for update;
    if not found then
        raise exception 'Spot not found: %', p_spot_id;
    end if;

    v_is_super := (auth.role() = 'service_role' or public.is_super_admin());

    -- 2. Strict caller identity verification
    if auth.role() != 'service_role' then
        if auth.uid() is null then
            raise exception 'Authentication required';
        end if;
        if p_actor_user_id is null or p_actor_user_id != auth.uid() then
            raise exception 'Forbidden: Actor user ID does not match authenticated identity';
        end if;
        v_effective_actor := auth.uid();
    else
        v_effective_actor := coalesce(p_actor_user_id, auth.uid());
    end if;

    -- 3. Validate actor permissions and organisation scope
    if p_actor_type = 'authority_user' then
        if v_spot.assigned_organisation_id is null then
            raise exception 'Unauthorized: Spot is not assigned to any organisation';
        end if;

        select exists (
            select 1 from public.organisation_memberships
            where user_id = v_effective_actor
              and organisation_id = v_spot.assigned_organisation_id
              and is_active = true
        ) into v_has_membership;

        if not v_has_membership then
            raise exception 'Unauthorized: Authority user is not an active member of the assigned organisation';
        end if;
    elsif p_actor_type = 'super_admin' then
        if not v_is_super then
            raise exception 'Unauthorized: Super admin role required';
        end if;
    elsif p_actor_type = 'system' then
        if auth.role() != 'service_role' and not v_is_super then
            raise exception 'Unauthorized: System role required';
        end if;
    else
        raise exception 'Invalid actor type: %', p_actor_type;
    end if;

    -- 4. Validate TRD Section 9.3 state machine transitions
    case v_spot.status
        when 'NEW' then
            if p_new_status in ('UNDER_REVIEW', 'VERIFIED', 'REJECTED') and v_is_super then
                v_valid_transition := true;
            end if;
        when 'UNDER_REVIEW' then
            if p_new_status in ('VERIFIED', 'REJECTED') and v_is_super then
                v_valid_transition := true;
            end if;
        when 'VERIFIED' then
            if p_new_status in ('ASSIGNED', 'HANDED_OFF', 'REJECTED') and v_is_super then
                v_valid_transition := true;
            end if;
        when 'ASSIGNED' then
            if p_new_status in ('AUTHORITY_ACKNOWLEDGED', 'IN_PROGRESS') then
                v_valid_transition := true;
            elsif p_new_status in ('HANDED_OFF', 'REOPENED') and v_is_super then
                v_valid_transition := true;
            end if;
        when 'AUTHORITY_ACKNOWLEDGED' then
            if p_new_status = 'IN_PROGRESS' then
                v_valid_transition := true;
            elsif p_new_status = 'HANDED_OFF' and v_is_super then
                v_valid_transition := true;
            end if;
        when 'IN_PROGRESS' then
            if p_new_status = 'RESOLUTION_SUBMITTED' then
                v_valid_transition := true;
            elsif p_new_status = 'HANDED_OFF' and v_is_super then
                v_valid_transition := true;
            end if;
        when 'HANDED_OFF' then
            -- REMEDIATED: HANDED_OFF -> RESOLVED bypass is REMOVED.
            -- External agencies must submit resolution request with after-photo evidence.
            if p_new_status in ('AUTHORITY_ACKNOWLEDGED', 'IN_PROGRESS', 'RESOLUTION_SUBMITTED') then
                v_valid_transition := true;
            end if;
        when 'RESOLUTION_SUBMITTED' then
            if p_new_status in ('RESOLVED', 'IN_PROGRESS') and v_is_super then
                v_valid_transition := true;
            end if;
        when 'RESOLVED' then
            if p_new_status = 'REOPENED' and v_is_super then
                v_valid_transition := true;
            end if;
        when 'REOPENED' then
            if p_new_status = 'IN_PROGRESS' then
                v_valid_transition := true;
            elsif p_new_status in ('ASSIGNED', 'HANDED_OFF') and v_is_super then
                v_valid_transition := true;
            end if;
        when 'REJECTED' then
            if p_new_status = 'UNDER_REVIEW' and v_is_super then
                v_valid_transition := true;
            end if;
        else
            v_valid_transition := false;
    end case;

    if not v_valid_transition then
        raise exception 'Illegal status transition from % to % for spot %', v_spot.status, p_new_status, p_spot_id;
    end if;

    -- 5. Mandatory Invariant: Authority users CANNOT directly mark RESOLVED
    if p_new_status = 'RESOLVED' and p_actor_type != 'super_admin' and auth.role() != 'service_role' then
        raise exception 'Forbidden: Only super administrators can resolve issues';
    end if;

    -- 6. Update spot status
    update public.spots
    set status = p_new_status,
        resolved_at = case when p_new_status = 'RESOLVED' then now() else null end
    where id = p_spot_id;

    -- 7. Record status history
    insert into public.status_history (
        spot_id,
        previous_status,
        new_status,
        actor_type,
        actor_user_id,
        note,
        source
    )
    values (
        p_spot_id,
        v_spot.status,
        p_new_status,
        p_actor_type,
        v_effective_actor,
        p_note,
        p_source
    );

    -- 8. Write audit log
    insert into public.audit_logs (
        actor_type,
        actor_user_id,
        action,
        entity_type,
        entity_id,
        before_value,
        after_value,
        reason
    )
    values (
        p_actor_type,
        v_effective_actor,
        'SPOT_STATUS_TRANSITION',
        'spot',
        p_spot_id,
        jsonb_build_object('status', v_spot.status),
        jsonb_build_object('status', p_new_status),
        p_note
    );

    -- 9. Enqueue notification outbox event for status changes
    if v_spot.status != p_new_status then
        insert into public.notification_outbox (
            citizen_contact_id,
            event_type,
            payload
        )
        select
            r.citizen_contact_id,
            'SPOT_STATUS_CHANGED',
            jsonb_build_object(
                'spot_id', p_spot_id,
                'spot_code', v_spot.spot_code,
                'previous_status', v_spot.status,
                'new_status', p_new_status,
                'ticket_code', r.ticket_code,
                'note', p_note
            )
        from public.reports r
        where r.spot_id = p_spot_id
          and r.citizen_contact_id is not null;
    end if;

    return true;
end;
$$;


-- ============================================================================
-- 6. HARDEN SEARCH PATH ON REMAINING WORKFLOW RPCS
-- ============================================================================

-- A. create_spot_for_report
create or replace function public.create_spot_for_report(
    p_report_id uuid,
    p_actor_user_id uuid,
    p_severity_label text default null,
    p_assigned_organisation_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth, pg_temp
as $$
declare
    v_report record;
    v_spot_id uuid;
    v_spot_code text;
    v_org record;
    v_initial_status text;
    v_effective_actor uuid;
begin
    -- 1. Caller identity and authorization check
    if auth.role() != 'service_role' then
        if auth.uid() is null then
            raise exception 'Authentication required';
        end if;
        if not public.is_super_admin() then
            raise exception 'Unauthorized: Only super administrators can create spots';
        end if;
        if p_actor_user_id is not null and p_actor_user_id != auth.uid() then
            raise exception 'Forbidden: Actor user ID does not match authenticated identity';
        end if;
        v_effective_actor := auth.uid();
    else
        v_effective_actor := coalesce(p_actor_user_id, auth.uid());
    end if;

    -- 2. Fetch and lock report (concurrency safety)
    select * into v_report from public.reports where id = p_report_id for update;
    if not found then
        raise exception 'Report not found: %', p_report_id;
    end if;

    if v_report.spot_id is not null then
        raise exception 'Report % is already linked to spot %', p_report_id, v_report.spot_id;
    end if;

    if v_report.latitude is null or v_report.longitude is null then
        raise exception 'Cannot create spot: Report has no coordinates';
    end if;

    -- 3. Validate assigned organisation (if provided)
    if p_assigned_organisation_id is not null then
        select * into v_org from public.organisations where id = p_assigned_organisation_id and is_active = true;
        if not found then
            raise exception 'Assigned organisation % not found or inactive', p_assigned_organisation_id;
        end if;

        -- Enforce demo workspace isolation
        if v_report.is_demo = true and v_org.is_demo = false then
            raise exception 'Workspace mismatch: Cannot assign demo spot to live organisation';
        elsif v_report.is_demo = false and v_org.is_demo = true then
            raise exception 'Workspace mismatch: Cannot assign live spot to demo organisation';
        end if;

        v_initial_status := 'ASSIGNED';
    else
        v_initial_status := 'VERIFIED';
    end if;

    -- 4. Generate spot code
    v_spot_code := public.generate_spot_code('KHR');

    -- 5. Insert spot record
    insert into public.spots (
        spot_code,
        pilot_id,
        group_id,
        category_id,
        issue_type_id,
        canonical_latitude,
        canonical_longitude,
        anchor_accuracy_m,
        status,
        severity_label,
        assigned_organisation_id,
        public_approved,
        is_demo
    )
    values (
        v_spot_code,
        v_report.pilot_id,
        v_report.group_id,
        v_report.category_id,
        v_report.issue_type_id,
        v_report.latitude,
        v_report.longitude,
        v_report.horizontal_accuracy_m,
        v_initial_status,
        p_severity_label,
        p_assigned_organisation_id,
        false,
        v_report.is_demo
    )
    returning id into v_spot_id;

    -- 6. Link report to the newly created spot
    update public.reports
    set spot_id = v_spot_id,
        match_method = 'manual_new_spot',
        match_distance_m = 0,
        matched_by = v_effective_actor,
        matched_at = now(),
        review_status = 'verified',
        location_review_status = 'confirmed'
    where id = p_report_id;

    -- 7. Associate existing report evidence with spot
    update public.evidence
    set spot_id = v_spot_id
    where report_id = p_report_id and spot_id is null;

    -- 8. Record status history
    insert into public.status_history (
        spot_id,
        previous_status,
        new_status,
        actor_type,
        actor_user_id,
        note,
        source
    )
    values (
        v_spot_id,
        null,
        v_initial_status,
        'super_admin',
        v_effective_actor,
        'Initial spot created from verified citizen report ' || v_report.ticket_code,
        'admin_dashboard'
    );

    -- 9. Write audit log
    insert into public.audit_logs (
        actor_type,
        actor_user_id,
        action,
        entity_type,
        entity_id,
        after_value
    )
    values (
        'super_admin',
        v_effective_actor,
        'SPOT_CREATED',
        'spot',
        v_spot_id,
        jsonb_build_object(
            'spot_code', v_spot_code,
            'source_report_id', p_report_id,
            'source_ticket_code', v_report.ticket_code,
            'initial_status', v_initial_status,
            'assigned_organisation_id', p_assigned_organisation_id
        )
    );

    return jsonb_build_object(
        'spot_id', v_spot_id,
        'spot_code', v_spot_code,
        'status', v_initial_status
    );
end;
$$;

-- B. link_report_to_spot
create or replace function public.link_report_to_spot(
    p_report_id uuid,
    p_spot_id uuid,
    p_actor_user_id uuid,
    p_match_distance_m numeric,
    p_match_note text default null
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public, auth, pg_temp
as $$
declare
    v_report record;
    v_spot record;
    v_effective_actor uuid;
begin
    -- 1. Caller identity and authorization check
    if auth.role() != 'service_role' then
        if auth.uid() is null then
            raise exception 'Authentication required';
        end if;
        if not public.is_super_admin() then
            raise exception 'Unauthorized: Only super administrators can link reports';
        end if;
        if p_actor_user_id is not null and p_actor_user_id != auth.uid() then
            raise exception 'Forbidden: Actor user ID does not match authenticated identity';
        end if;
        v_effective_actor := auth.uid();
    else
        v_effective_actor := coalesce(p_actor_user_id, auth.uid());
    end if;

    -- 2. Fetch and lock report for concurrency safety
    select * into v_report from public.reports where id = p_report_id for update;
    if not found then
        raise exception 'Report not found: %', p_report_id;
    end if;

    select * into v_spot from public.spots where id = p_spot_id;
    if not found then
        raise exception 'Spot not found: %', p_spot_id;
    end if;

    -- 3. Check for existing link
    if v_report.spot_id is not null then
        if v_report.spot_id = p_spot_id then
            raise exception 'Report % is already linked to spot %', p_report_id, p_spot_id;
        else
            raise exception 'Report % is already linked to another spot %', p_report_id, v_report.spot_id;
        end if;
    end if;

    -- 4. Enforce category compatibility
    if v_report.category_id != v_spot.category_id then
        raise exception 'Category mismatch: Report category % does not match Spot category %', v_report.category_id, v_spot.category_id;
    end if;

    -- 5. Enforce demo/live workspace isolation
    if v_report.is_demo != v_spot.is_demo then
        raise exception 'Workspace mismatch: Cannot link demo report to live spot or vice versa';
    end if;

    -- 6. Link report to spot
    update public.reports
    set spot_id = p_spot_id,
        match_method = 'manual_confirmed',
        match_distance_m = p_match_distance_m,
        matched_by = v_effective_actor,
        matched_at = now(),
        match_note = p_match_note,
        review_status = 'verified'
    where id = p_report_id;

    -- 7. Associate evidence with spot if spot_id is null
    update public.evidence
    set spot_id = p_spot_id
    where report_id = p_report_id and spot_id is null;

    -- 8. Write audit log
    insert into public.audit_logs (
        actor_type,
        actor_user_id,
        action,
        entity_type,
        entity_id,
        after_value
    )
    values (
        'super_admin',
        v_effective_actor,
        'REPORT_LINKED_TO_SPOT',
        'report',
        p_report_id,
        jsonb_build_object(
            'ticket_code', v_report.ticket_code,
            'spot_id', p_spot_id,
            'spot_code', v_spot.spot_code,
            'match_distance_m', p_match_distance_m,
            'match_note', p_match_note
        )
    );

    return true;
end;
$$;

-- C. record_authority_handoff
create or replace function public.record_authority_handoff(
    p_spot_id uuid,
    p_destination_name text,
    p_handoff_method text,
    p_recorded_by uuid,
    p_note text,
    p_official_reference text default null,
    p_proof_evidence_id uuid default null,
    p_organisation_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, auth, pg_temp
as $$
declare
    v_spot record;
    v_org record;
    v_handoff_id uuid;
    v_effective_actor uuid;
begin
    -- 1. Caller identity and authorization check
    if auth.role() != 'service_role' then
        if auth.uid() is null then
            raise exception 'Authentication required';
        end if;
        if not public.is_super_admin() then
            raise exception 'Unauthorized: Only super administrators can record handoffs';
        end if;
        if p_recorded_by is not null and p_recorded_by != auth.uid() then
            raise exception 'Forbidden: Recorded-by user ID does not match authenticated identity';
        end if;
        v_effective_actor := auth.uid();
    else
        v_effective_actor := coalesce(p_recorded_by, auth.uid());
    end if;

    -- 2. Validate spot and lock row
    select * into v_spot from public.spots where id = p_spot_id for update;
    if not found then
        raise exception 'Spot not found: %', p_spot_id;
    end if;

    if v_spot.status not in ('VERIFIED', 'ASSIGNED', 'IN_PROGRESS', 'AUTHORITY_ACKNOWLEDGED', 'REOPENED') then
        raise exception 'Spot % in status % is not eligible for handoff', p_spot_id, v_spot.status;
    end if;

    -- 3. Validate inputs
    if coalesce(trim(p_destination_name), '') = '' then
        raise exception 'Destination name is mandatory for handoff';
    end if;

    if coalesce(trim(p_handoff_method), '') = '' then
        raise exception 'Handoff method is mandatory';
    end if;

    if coalesce(trim(p_note), '') = '' then
        raise exception 'Handoff note is mandatory';
    end if;

    -- Validate organisation (if provided)
    if p_organisation_id is not null then
        select * into v_org from public.organisations where id = p_organisation_id and is_active = true;
        if not found then
            raise exception 'Organisation % not found or inactive', p_organisation_id;
        end if;

        if v_spot.is_demo = true and v_org.is_demo = false then
            raise exception 'Workspace mismatch: Cannot hand off demo spot to live organisation';
        elsif v_spot.is_demo = false and v_org.is_demo = true then
            raise exception 'Workspace mismatch: Cannot hand off live spot to demo organisation';
        end if;
    end if;

    -- Validate proof evidence (if provided)
    if p_proof_evidence_id is not null then
        if not exists (select 1 from public.evidence where id = p_proof_evidence_id and spot_id = p_spot_id) then
            raise exception 'Proof evidence % does not belong to spot %', p_proof_evidence_id, p_spot_id;
        end if;
    end if;

    -- 4. Insert handoff record
    insert into public.authority_handoffs (
        spot_id,
        organisation_id,
        destination_name,
        handoff_method,
        submitted_at,
        official_reference,
        proof_evidence_id,
        recorded_by,
        note
    )
    values (
        p_spot_id,
        p_organisation_id,
        p_destination_name,
        p_handoff_method,
        now(),
        p_official_reference,
        p_proof_evidence_id,
        v_effective_actor,
        p_note
    )
    returning id into v_handoff_id;

    -- 5. Transition spot to HANDED_OFF
    perform public.transition_spot_status(
        p_spot_id,
        'HANDED_OFF',
        'super_admin',
        v_effective_actor,
        'Handoff recorded to ' || p_destination_name || ' via ' || p_handoff_method || '. Note: ' || p_note,
        'admin_dashboard'
    );

    return v_handoff_id;
end;
$$;

-- D. submit_resolution_request
create or replace function public.submit_resolution_request(
    p_spot_id uuid,
    p_submitted_by uuid,
    p_completion_note text,
    p_after_photo_evidence_id uuid,
    p_completion_date date default null,
    p_work_order_reference text default null,
    p_video_evidence_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, auth, pg_temp
as $$
declare
    v_spot record;
    v_evidence record;
    v_submission_id uuid;
    v_is_super boolean;
    v_has_membership boolean;
    v_effective_actor uuid;
begin
    -- 1. Fetch and lock spot
    select * into v_spot from public.spots where id = p_spot_id for update;
    if not found then
        raise exception 'Spot not found: %', p_spot_id;
    end if;

    v_is_super := (auth.role() = 'service_role' or public.is_super_admin());

    -- 2. Strict caller identity verification
    if auth.role() != 'service_role' then
        if auth.uid() is null then
            raise exception 'Authentication required';
        end if;
        if p_submitted_by is null or p_submitted_by != auth.uid() then
            raise exception 'Forbidden: Submitter user ID does not match authenticated identity';
        end if;
        v_effective_actor := auth.uid();
    else
        v_effective_actor := coalesce(p_submitted_by, auth.uid());
    end if;

    -- 3. Validate organisation membership
    if not v_is_super then
        if v_spot.assigned_organisation_id is null then
            raise exception 'Unauthorized: Spot is not assigned to any organisation';
        end if;

        select exists (
            select 1 from public.organisation_memberships
            where user_id = v_effective_actor
              and organisation_id = v_spot.assigned_organisation_id
              and is_active = true
        ) into v_has_membership;

        if not v_has_membership then
            raise exception 'Unauthorized: User is not an active member of assigned organisation';
        end if;
    end if;

    -- 4. Validate status: Spot must be in IN_PROGRESS, AUTHORITY_ACKNOWLEDGED, or HANDED_OFF
    if v_spot.status not in ('IN_PROGRESS', 'AUTHORITY_ACKNOWLEDGED', 'HANDED_OFF') then
        raise exception 'Spot % in status % cannot submit resolution; must be IN_PROGRESS, AUTHORITY_ACKNOWLEDGED, or HANDED_OFF', p_spot_id, v_spot.status;
    end if;

    -- 5. Validate mandatory after-photo evidence
    if p_after_photo_evidence_id is null then
        raise exception 'Mandatory after-photo evidence ID is required for resolution submission';
    end if;

    select * into v_evidence from public.evidence
    where id = p_after_photo_evidence_id and spot_id = p_spot_id;
    if not found then
        raise exception 'Mandatory after-photo evidence % not found or does not belong to spot %', p_after_photo_evidence_id, p_spot_id;
    end if;

    if v_evidence.storage_path_private is null then
        raise exception 'Evidence % has no private storage path recorded', p_after_photo_evidence_id;
    end if;

    if coalesce(trim(p_completion_note), '') = '' then
        raise exception 'Completion note is mandatory for resolution request';
    end if;

    -- 6. Validate video evidence (if provided)
    if p_video_evidence_id is not null then
        if not exists (select 1 from public.evidence where id = p_video_evidence_id and spot_id = p_spot_id) then
            raise exception 'Supporting video evidence % does not belong to spot %', p_video_evidence_id, p_spot_id;
        end if;
    end if;

    -- 7. Insert resolution submission
    insert into public.resolution_submissions (
        spot_id,
        submitted_by,
        completion_note,
        completion_date,
        work_order_reference,
        after_photo_evidence_id,
        video_evidence_id,
        review_status
    )
    values (
        p_spot_id,
        v_effective_actor,
        p_completion_note,
        p_completion_date,
        p_work_order_reference,
        p_after_photo_evidence_id,
        p_video_evidence_id,
        'pending'
    )
    returning id into v_submission_id;

    -- 8. Transition spot to RESOLUTION_SUBMITTED
    update public.spots
    set status = 'RESOLUTION_SUBMITTED'
    where id = p_spot_id;

    -- 9. Record status history
    insert into public.status_history (
        spot_id,
        previous_status,
        new_status,
        actor_type,
        actor_user_id,
        note,
        source
    )
    values (
        p_spot_id,
        v_spot.status,
        'RESOLUTION_SUBMITTED',
        case when v_is_super then 'super_admin' else 'authority_user' end,
        v_effective_actor,
        'Resolution submitted by authority. Note: ' || p_completion_note,
        'authority_dashboard'
    );

    -- 10. Write audit log
    insert into public.audit_logs (
        actor_type,
        actor_user_id,
        action,
        entity_type,
        entity_id,
        after_value
    )
    values (
        case when v_is_super then 'super_admin' else 'authority_user' end,
        v_effective_actor,
        'SUBMIT_RESOLUTION_REQUEST',
        'resolution_submission',
        v_submission_id,
        jsonb_build_object(
            'spot_id', p_spot_id,
            'after_photo_evidence_id', p_after_photo_evidence_id,
            'completion_note', p_completion_note
        )
    );

    return v_submission_id;
end;
$$;

-- E. review_resolution_request
create or replace function public.review_resolution_request(
    p_submission_id uuid,
    p_reviewed_by uuid,
    p_decision text,
    p_review_note text default null
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public, auth, pg_temp
as $$
declare
    v_sub record;
    v_spot record;
    v_effective_actor uuid;
begin
    -- 1. Caller identity and authorization check
    if auth.role() != 'service_role' then
        if auth.uid() is null then
            raise exception 'Authentication required';
        end if;
        if not public.is_super_admin() then
            raise exception 'Unauthorized: Only super administrators can review resolution requests';
        end if;
        if p_reviewed_by is not null and p_reviewed_by != auth.uid() then
            raise exception 'Forbidden: Reviewer user ID does not match authenticated identity';
        end if;
        v_effective_actor := auth.uid();
    else
        v_effective_actor := coalesce(p_reviewed_by, auth.uid());
    end if;

    if p_decision not in ('approved', 'rejected', 'more_info_required') then
        raise exception 'Invalid decision: %. Allowed: approved, rejected, more_info_required', p_decision;
    end if;

    if p_decision in ('rejected', 'more_info_required') and coalesce(trim(p_review_note), '') = '' then
        raise exception 'Review note is mandatory on rejection or info request';
    end if;

    -- 2. Fetch and lock submission
    select * into v_sub from public.resolution_submissions where id = p_submission_id for update;
    if not found then
        raise exception 'Resolution submission not found: %', p_submission_id;
    end if;

    if v_sub.review_status != 'pending' then
        raise exception 'Resolution submission % has already been reviewed (current status: %)', p_submission_id, v_sub.review_status;
    end if;

    select * into v_spot from public.spots where id = v_sub.spot_id;
    if not found then
        raise exception 'Referenced spot % not found', v_sub.spot_id;
    end if;

    -- 3. Update resolution submission
    update public.resolution_submissions
    set review_status = p_decision,
        reviewed_by = v_effective_actor,
        review_note = p_review_note,
        reviewed_at = now()
    where id = p_submission_id;

    -- 4. Transition spot according to decision
    if p_decision = 'approved' then
        perform public.transition_spot_status(
            v_sub.spot_id,
            'RESOLVED',
            'super_admin',
            v_effective_actor,
            'Resolution approved by super administrator. Note: ' || coalesce(p_review_note, 'Approved'),
            'admin_dashboard'
        );
    else
        perform public.transition_spot_status(
            v_sub.spot_id,
            'IN_PROGRESS',
            'super_admin',
            v_effective_actor,
            'Resolution rejected/more info requested: ' || p_review_note,
            'admin_dashboard'
        );
    end if;

    return true;
end;
$$;

-- F. find_duplicate_candidates
create or replace function public.find_duplicate_candidates(
    p_latitude numeric,
    p_longitude numeric,
    p_category_id text,
    p_pilot_id text default 'kharghar_itm_v1',
    p_is_demo boolean default false
)
returns table (
    spot_id uuid,
    spot_code text,
    category_id text,
    issue_type_id text,
    status text,
    canonical_latitude numeric,
    canonical_longitude numeric,
    distance_metres numeric,
    candidate_band text
)
language sql
stable
security definer
set search_path = pg_catalog, public, auth, pg_temp
as $$
    with distance_calc as (
        select
            s.id as spot_id,
            s.spot_code,
            s.category_id,
            s.issue_type_id,
            s.status,
            s.canonical_latitude,
            s.canonical_longitude,
            round(
                (6371000 * 2 * asin(sqrt(
                    power(sin(radians(s.canonical_latitude - p_latitude) / 2), 2) +
                    cos(radians(p_latitude)) * cos(radians(s.canonical_latitude)) *
                    power(sin(radians(s.canonical_longitude - p_longitude) / 2), 2)
                )))::numeric,
                2
            ) as distance_metres
        from public.spots s
        where s.category_id = p_category_id
          and s.pilot_id = p_pilot_id
          and s.is_demo = p_is_demo
          and s.status not in ('REJECTED')
          -- Bounding box pre-filter (~25 metres at Kharghar latitude)
          and s.canonical_latitude between (p_latitude - 0.0003) and (p_latitude + 0.0003)
          and s.canonical_longitude between (p_longitude - 0.0003) and (p_longitude + 0.0003)
    )
    select
        dc.spot_id,
        dc.spot_code,
        dc.category_id,
        dc.issue_type_id,
        dc.status,
        dc.canonical_latitude,
        dc.canonical_longitude,
        dc.distance_metres,
        case
            when dc.distance_metres <= 5.0 then 'STRONG_CANDIDATE'
            when dc.distance_metres <= 10.0 then 'POSSIBLE_CANDIDATE'
            else 'OUT_OF_BAND'
        end as candidate_band
    from distance_calc dc
    where dc.distance_metres <= 10.0
    order by dc.distance_metres asc;
$$;


-- ============================================================================
-- 7. RE-GRANT EXECUTION PRIVILEGES FOR WORKFLOW FUNCTIONS
-- ============================================================================

grant execute on function public.create_spot_for_report(uuid, uuid, text, uuid) to authenticated, service_role;
grant execute on function public.link_report_to_spot(uuid, uuid, uuid, numeric, text) to authenticated, service_role;
grant execute on function public.transition_spot_status(uuid, text, text, uuid, text, text) to authenticated, service_role;
grant execute on function public.record_authority_handoff(uuid, text, text, uuid, text, text, uuid, uuid) to authenticated, service_role;
grant execute on function public.submit_resolution_request(uuid, uuid, text, uuid, date, text, uuid) to authenticated, service_role;
grant execute on function public.review_resolution_request(uuid, uuid, text, text) to authenticated, service_role;
grant execute on function public.find_duplicate_candidates(numeric, numeric, text, text, boolean) to authenticated, service_role;

grant execute on function public.current_user_role() to authenticated, service_role;
grant execute on function public.is_super_admin() to authenticated, service_role;
grant execute on function public.get_user_organisations() to authenticated, service_role;
grant execute on function public.is_demo_viewer() to authenticated, service_role;
grant execute on function public.generate_ticket_code(text) to authenticated, service_role;
grant execute on function public.generate_spot_code(text) to authenticated, service_role;


-- ============================================================================
-- 8. REMEDIATED PUBLIC COORDINATE PRIVACY PROJECTIONS
-- In accordance with TRD Section 13.3, coordinates exposed to public views
-- must be rounded to an approximately 25-50 metre grid.
-- At Kharghar latitude (19.0475° N):
--   0.0003° latitude  = 33.3 metres
--   0.0003° longitude = 31.5 metres
--   Discretization: round(coord / 0.0003) * 0.0003
-- Canonical coordinates in public.spots remain exact numeric(10, 7).
-- ============================================================================

drop view if exists public.public_demo_spots cascade;
drop view if exists public.public_spots cascade;

-- A. Live Public Spots Projection (Remediated 25-50m Grid)
create or replace view public.public_spots as
select
    s.spot_code,
    s.pilot_id,
    s.group_id,
    s.category_id,
    s.issue_type_id,
    s.status,
    s.severity_label,
    round((round(s.canonical_latitude::numeric / 0.0003) * 0.0003), 4) as public_latitude,
    round((round(s.canonical_longitude::numeric / 0.0003) * 0.0003), 4) as public_longitude,
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

-- B. Demo Workspace Spots Projection (Remediated 25-50m Grid)
create or replace view public.public_demo_spots as
select
    s.spot_code,
    s.pilot_id,
    s.group_id,
    s.category_id,
    s.issue_type_id,
    s.status,
    s.severity_label,
    round((round(s.canonical_latitude::numeric / 0.0003) * 0.0003), 4) as public_latitude,
    round((round(s.canonical_longitude::numeric / 0.0003) * 0.0003), 4) as public_longitude,
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

grant select on public.public_spots to anon, authenticated;
grant select on public.public_demo_spots to anon, authenticated;
-- NAGRIK SCHEMA MIGRATION 9: RESOLUTION APPROVAL PROVENANCE & EVIDENCE HARDENING
-- Authority: TRD Section 6.4, 9.3, 11, 13.3, 14.3 & Phase 4D Final Security Remediation
-- Target Engine: Supabase PostgreSQL (15+) Public Schema

-- ============================================================================
-- 1. TRIGGER FUNCTION: GUARD RESOLUTION SUBMISSIONS
-- Enforces:
--   - After-photo evidence exists, belongs to spot, stage = 'authority_after',
--     MIME type is image (image/*), and storage_path_private is not null.
--   - Video evidence (if present) belongs to spot, stage = 'authority_video',
--     MIME type is video (video/*).
--   - On INSERT: review_status must be 'pending' unless caller has service_role
--     or super_admin privileges with non-null, verified active super_admin reviewed_by
--     and non-null reviewed_at timestamp (e.g. fixtures/seed).
--   - On UPDATE: Submissions already reviewed (status != 'pending') are IMMUTABLE.
--   - On UPDATE: Transitioning review_status to non-pending requires the authorized
--     review workflow (review_resolution_request) and verified super-admin reviewer.
--   - Direct SQL mutation bypassing review_resolution_request() is strictly blocked.
-- ============================================================================

create or replace function public.guard_resolution_submission()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, auth, pg_temp
as $$
declare
    v_admin_valid boolean;
    v_after_ev record;
    v_video_ev record;
begin
    -- 1. Validate mandatory after-photo evidence
    if new.after_photo_evidence_id is null then
        raise exception 'Mandatory after-photo evidence ID is required';
    end if;

    select id, spot_id, evidence_stage, mime_type, storage_path_private
    into v_after_ev
    from public.evidence
    where id = new.after_photo_evidence_id;

    if v_after_ev.id is null then
        raise exception 'Mandatory after-photo evidence % does not exist', new.after_photo_evidence_id;
    end if;

    if v_after_ev.spot_id != new.spot_id then
        raise exception 'Mandatory after-photo evidence % belongs to spot % but submission references spot %',
            new.after_photo_evidence_id, v_after_ev.spot_id, new.spot_id;
    end if;

    if v_after_ev.evidence_stage != 'authority_after' then
        raise exception 'Mandatory after-photo evidence % must have evidence_stage authority_after (found %)',
            new.after_photo_evidence_id, v_after_ev.evidence_stage;
    end if;

    if v_after_ev.mime_type not like 'image/%' then
        raise exception 'Mandatory after-photo evidence % must be an image (found %)',
            new.after_photo_evidence_id, v_after_ev.mime_type;
    end if;

    if v_after_ev.storage_path_private is null then
        raise exception 'Mandatory after-photo evidence % has no private storage path recorded',
            new.after_photo_evidence_id;
    end if;

    -- 2. Validate supporting video evidence if provided
    if new.video_evidence_id is not null then
        select id, spot_id, evidence_stage, mime_type, storage_path_private
        into v_video_ev
        from public.evidence
        where id = new.video_evidence_id;

        if v_video_ev.id is null then
            raise exception 'Supporting video evidence % does not exist', new.video_evidence_id;
        end if;

        if v_video_ev.spot_id != new.spot_id then
            raise exception 'Supporting video evidence % belongs to spot % but submission references spot %',
                new.video_evidence_id, v_video_ev.spot_id, new.spot_id;
        end if;

        if v_video_ev.evidence_stage != 'authority_video' then
            raise exception 'Supporting video evidence % must have evidence_stage authority_video (found %)',
                new.video_evidence_id, v_video_ev.evidence_stage;
        end if;

        if v_video_ev.mime_type not like 'video/%' then
            raise exception 'Supporting video evidence % must be a video (found %)',
                new.video_evidence_id, v_video_ev.mime_type;
        end if;
    end if;

    -- 3. INSERT Validation
    if tg_op = 'INSERT' then
        if new.review_status != 'pending' then
            -- Pre-reviewed insert only permitted with full valid super-admin provenance
            if auth.role() != 'service_role' and not public.is_super_admin() then
                raise exception 'Direct insertion of non-pending resolution submission forbidden: submissions must be reviewed via review_resolution_request()';
            end if;

            if new.reviewed_by is null or new.reviewed_at is null then
                raise exception 'Pre-approved submission must have non-null reviewed_by and reviewed_at';
            end if;

            select exists (
                select 1 from public.profiles p
                where p.user_id = new.reviewed_by and p.role = 'super_admin' and p.is_active = true
            ) into v_admin_valid;

            if not v_admin_valid then
                raise exception 'Reviewer % is not an active super administrator', new.reviewed_by;
            end if;

            if auth.role() != 'service_role' and new.reviewed_by != auth.uid() then
                raise exception 'Forbidden: Reviewer user ID does not match authenticated identity';
            end if;
        else
            -- Pending submissions must have null review fields
            new.reviewed_by := null;
            new.reviewed_at := null;
            new.review_note := null;
        end if;
        return new;
    end if;

    -- 4. UPDATE Validation
    if tg_op = 'UPDATE' then
        -- Reviewed submissions are strictly immutable
        if old.review_status != 'pending' then
            raise exception 'Cannot modify resolution submission %: submission has already been reviewed (status: %)',
                old.id, old.review_status;
        end if;

        -- Immutable core fields
        if new.spot_id != old.spot_id then
            raise exception 'Cannot alter spot_id on resolution submission';
        end if;
        if new.submitted_by != old.submitted_by then
            raise exception 'Cannot alter submitted_by on resolution submission';
        end if;
        if new.after_photo_evidence_id != old.after_photo_evidence_id then
            raise exception 'Cannot alter after_photo_evidence_id on resolution submission';
        end if;
        if new.created_at != old.created_at then
            raise exception 'Cannot alter created_at on resolution submission';
        end if;

        -- Review status transition
        if new.review_status != 'pending' then
            -- Must be through the authorized review workflow
            if current_setting('nagrik.authorized_review_flow', true) is distinct from 'true' then
                raise exception 'Direct modification of review_status forbidden: submissions must be reviewed via review_resolution_request()';
            end if;

            if auth.role() != 'service_role' and not public.is_super_admin() then
                raise exception 'Forbidden: Only super administrators can review resolution submissions';
            end if;

            if new.reviewed_by is null then
                raise exception 'Reviewer ID (reviewed_by) is mandatory when reviewing a submission';
            end if;

            select exists (
                select 1 from public.profiles p
                where p.user_id = new.reviewed_by and p.role = 'super_admin' and p.is_active = true
            ) into v_admin_valid;

            if not v_admin_valid then
                raise exception 'Reviewer % is not an active super administrator', new.reviewed_by;
            end if;

            if auth.role() != 'service_role' and new.reviewed_by != auth.uid() then
                raise exception 'Forbidden: Reviewer user ID does not match authenticated identity';
            end if;

            new.reviewed_at := coalesce(new.reviewed_at, now());
        end if;

        return new;
    end if;

    return new;
end;
$$;

drop trigger if exists trg_guard_resolution_submission on public.resolution_submissions;
create trigger trg_guard_resolution_submission
    before insert or update on public.resolution_submissions
    for each row
    execute function public.guard_resolution_submission();


-- ============================================================================
-- 2. HARDENED SUBMIT_RESOLUTION_REQUEST
-- Enforces:
--   - After-photo evidence is validated for stage = 'authority_after',
--     MIME type is image (image/*), and storage_path_private is present.
--   - Supporting video evidence (if provided) is validated for stage = 'authority_video'
--     and MIME type is video (video/*).
--   - Strict pinned search_path.
-- ============================================================================

create or replace function public.submit_resolution_request(
    p_spot_id uuid,
    p_submitted_by uuid,
    p_completion_note text,
    p_after_photo_evidence_id uuid,
    p_completion_date date default null,
    p_work_order_reference text default null,
    p_video_evidence_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, auth, pg_temp
as $$
declare
    v_spot record;
    v_evidence record;
    v_video_ev record;
    v_submission_id uuid;
    v_is_super boolean;
    v_has_membership boolean;
    v_effective_actor uuid;
begin
    -- 1. Fetch and lock spot
    select * into v_spot from public.spots where id = p_spot_id for update;
    if not found then
        raise exception 'Spot not found: %', p_spot_id;
    end if;

    v_is_super := (auth.role() = 'service_role' or public.is_super_admin());

    -- 2. Strict caller identity verification
    if auth.role() != 'service_role' then
        if auth.uid() is null then
            raise exception 'Authentication required';
        end if;
        if p_submitted_by is null or p_submitted_by != auth.uid() then
            raise exception 'Forbidden: Submitter user ID does not match authenticated identity';
        end if;
        v_effective_actor := auth.uid();
    else
        v_effective_actor := coalesce(p_submitted_by, auth.uid());
    end if;

    -- 3. Validate organisation membership
    if not v_is_super then
        if v_spot.assigned_organisation_id is null then
            raise exception 'Unauthorized: Spot is not assigned to any organisation';
        end if;

        select exists (
            select 1 from public.organisation_memberships
            where user_id = v_effective_actor
              and organisation_id = v_spot.assigned_organisation_id
              and is_active = true
        ) into v_has_membership;

        if not v_has_membership then
            raise exception 'Unauthorized: User is not an active member of assigned organisation';
        end if;
    end if;

    -- 4. Validate status: Spot must be in IN_PROGRESS, AUTHORITY_ACKNOWLEDGED, or HANDED_OFF
    if v_spot.status not in ('IN_PROGRESS', 'AUTHORITY_ACKNOWLEDGED', 'HANDED_OFF') then
        raise exception 'Spot % in status % cannot submit resolution; must be IN_PROGRESS, AUTHORITY_ACKNOWLEDGED, or HANDED_OFF', p_spot_id, v_spot.status;
    end if;

    -- 5. Validate mandatory after-photo evidence
    if p_after_photo_evidence_id is null then
        raise exception 'Mandatory after-photo evidence ID is required for resolution submission';
    end if;

    select * into v_evidence from public.evidence
    where id = p_after_photo_evidence_id and spot_id = p_spot_id;
    if not found then
        raise exception 'Mandatory after-photo evidence % not found or does not belong to spot %', p_after_photo_evidence_id, p_spot_id;
    end if;

    if v_evidence.evidence_stage != 'authority_after' then
        raise exception 'Mandatory after-photo evidence % must have evidence_stage authority_after (found %)', p_after_photo_evidence_id, v_evidence.evidence_stage;
    end if;

    if v_evidence.mime_type not like 'image/%' then
        raise exception 'Mandatory after-photo evidence % must be an image (found %)', p_after_photo_evidence_id, v_evidence.mime_type;
    end if;

    if v_evidence.storage_path_private is null then
        raise exception 'Evidence % has no private storage path recorded', p_after_photo_evidence_id;
    end if;

    if coalesce(trim(p_completion_note), '') = '' then
        raise exception 'Completion note is mandatory for resolution request';
    end if;

    -- 6. Validate video evidence (if provided)
    if p_video_evidence_id is not null then
        select * into v_video_ev from public.evidence
        where id = p_video_evidence_id and spot_id = p_spot_id;
        if not found then
            raise exception 'Supporting video evidence % does not belong to spot %', p_video_evidence_id, p_spot_id;
        end if;
        if v_video_ev.evidence_stage != 'authority_video' then
            raise exception 'Supporting video evidence % must have evidence_stage authority_video (found %)', p_video_evidence_id, v_video_ev.evidence_stage;
        end if;
        if v_video_ev.mime_type not like 'video/%' then
            raise exception 'Supporting video evidence % must be a video (found %)', p_video_evidence_id, v_video_ev.mime_type;
        end if;
    end if;

    -- 7. Insert resolution submission
    insert into public.resolution_submissions (
        spot_id,
        submitted_by,
        completion_note,
        completion_date,
        work_order_reference,
        after_photo_evidence_id,
        video_evidence_id,
        review_status
    )
    values (
        p_spot_id,
        v_effective_actor,
        p_completion_note,
        p_completion_date,
        p_work_order_reference,
        p_after_photo_evidence_id,
        p_video_evidence_id,
        'pending'
    )
    returning id into v_submission_id;

    -- 8. Transition spot to RESOLUTION_SUBMITTED
    update public.spots
    set status = 'RESOLUTION_SUBMITTED'
    where id = p_spot_id;

    -- 9. Record status history
    insert into public.status_history (
        spot_id,
        previous_status,
        new_status,
        actor_type,
        actor_user_id,
        note,
        source
    )
    values (
        p_spot_id,
        v_spot.status,
        'RESOLUTION_SUBMITTED',
        case when v_is_super then 'super_admin' else 'authority_user' end,
        v_effective_actor,
        'Resolution submitted by authority. Note: ' || p_completion_note,
        'authority_dashboard'
    );

    -- 10. Write audit log
    insert into public.audit_logs (
        actor_type,
        actor_user_id,
        action,
        entity_type,
        entity_id,
        after_value
    )
    values (
        case when v_is_super then 'super_admin' else 'authority_user' end,
        v_effective_actor,
        'SUBMIT_RESOLUTION_REQUEST',
        'resolution_submission',
        v_submission_id,
        jsonb_build_object(
            'spot_id', p_spot_id,
            'after_photo_evidence_id', p_after_photo_evidence_id,
            'completion_note', p_completion_note
        )
    );

    return v_submission_id;
end;
$$;


-- ============================================================================
-- 3. HARDENED REVIEW_RESOLUTION_REQUEST
-- Enforces:
--   - Sets transaction-scoped session variable 'nagrik.authorized_review_flow' = 'true'
--   - Caller identity check, super-admin verification, mandatory review notes
--   - Pinned search_path.
-- ============================================================================

create or replace function public.review_resolution_request(
    p_submission_id uuid,
    p_reviewed_by uuid,
    p_decision text,
    p_review_note text default null
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public, auth, pg_temp
as $$
declare
    v_sub record;
    v_spot record;
    v_effective_actor uuid;
begin
    -- 1. Caller identity and authorization check
    if auth.role() != 'service_role' then
        if auth.uid() is null then
            raise exception 'Authentication required';
        end if;
        if not public.is_super_admin() then
            raise exception 'Unauthorized: Only super administrators can review resolution requests';
        end if;
        if p_reviewed_by is not null and p_reviewed_by != auth.uid() then
            raise exception 'Forbidden: Reviewer user ID does not match authenticated identity';
        end if;
        v_effective_actor := auth.uid();
    else
        v_effective_actor := coalesce(p_reviewed_by, auth.uid());
    end if;

    if p_decision not in ('approved', 'rejected', 'more_info_required') then
        raise exception 'Invalid decision: %. Allowed: approved, rejected, more_info_required', p_decision;
    end if;

    if p_decision in ('rejected', 'more_info_required') and coalesce(trim(p_review_note), '') = '' then
        raise exception 'Review note is mandatory on rejection or info request';
    end if;

    -- 2. Fetch and lock submission
    select * into v_sub from public.resolution_submissions where id = p_submission_id for update;
    if not found then
        raise exception 'Resolution submission not found: %', p_submission_id;
    end if;

    if v_sub.review_status != 'pending' then
        raise exception 'Resolution submission % has already been reviewed (current status: %)', p_submission_id, v_sub.review_status;
    end if;

    select * into v_spot from public.spots where id = v_sub.spot_id;
    if not found then
        raise exception 'Referenced spot % not found', v_sub.spot_id;
    end if;

    -- 3. Set authorized workflow token for trigger verification (transaction-scoped)
    perform set_config('nagrik.authorized_review_flow', 'true', true);

    -- 4. Update resolution submission
    update public.resolution_submissions
    set review_status = p_decision,
        reviewed_by = v_effective_actor,
        review_note = p_review_note,
        reviewed_at = now()
    where id = p_submission_id;

    -- 5. Transition spot according to decision
    if p_decision = 'approved' then
        perform public.transition_spot_status(
            v_sub.spot_id,
            'RESOLVED',
            'super_admin',
            v_effective_actor,
            'Resolution approved by super administrator. Note: ' || coalesce(p_review_note, 'Approved'),
            'admin_dashboard'
        );
    else
        perform public.transition_spot_status(
            v_sub.spot_id,
            'IN_PROGRESS',
            'super_admin',
            v_effective_actor,
            'Resolution rejected/more info requested: ' || p_review_note,
            'admin_dashboard'
        );
    end if;

    return true;
end;
$$;


-- ============================================================================
-- 4. HARDENED GUARD_SPOT_RESOLUTION
-- Enforces:
--   - Super-admin authorization check.
--   - Source state invariant: RESOLVED can ONLY be reached from RESOLUTION_SUBMITTED.
--   - Verification & Provenance Invariant:
--     * Submission belongs to this exact spot.
--     * Submission has review_status = 'approved'.
--     * Submission has non-null reviewed_by and reviewed_at.
--     * Reviewer reviewed_by references an active super-admin profile.
--     * Mandatory after-photo evidence belongs to this spot.
--     * Evidence stage = 'authority_after'.
--     * Evidence MIME type is an image (image/*).
--     * Evidence has private storage path recorded.
--   - Pinned search_path.
-- ============================================================================

create or replace function public.guard_spot_resolution()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, auth, pg_temp
as $$
declare
    v_approved_sub record;
    v_admin_valid boolean;
begin
    if new.status = 'RESOLVED' and old.status is distinct from 'RESOLVED' then
        -- 1. Actor Check
        if auth.role() != 'service_role' and not public.is_super_admin() then
            raise exception 'Forbidden: Only super administrators can approve issue resolution';
        end if;

        -- 2. State Machine Invariant: RESOLVED can ONLY be transitioned from RESOLUTION_SUBMITTED
        if old.status != 'RESOLUTION_SUBMITTED' then
            raise exception 'Illegal resolution: Spot % can only be transitioned to RESOLVED from RESOLUTION_SUBMITTED state (attempted from %)', new.id, old.status;
        end if;

        -- 3. Verification & Provenance Invariant:
        select rs.*, e.evidence_stage, e.mime_type, e.storage_path_private
        into v_approved_sub
        from public.resolution_submissions rs
        join public.evidence e on e.id = rs.after_photo_evidence_id
        where rs.spot_id = new.id
          and rs.review_status = 'approved'
          and e.spot_id = new.id
        order by rs.reviewed_at desc nulls last, rs.created_at desc
        limit 1;

        if v_approved_sub.id is null then
            raise exception 'Illegal resolution: Spot % lacks an approved resolution submission with verified after-repair photo evidence', new.id;
        end if;

        if v_approved_sub.reviewed_by is null or v_approved_sub.reviewed_at is null then
            raise exception 'Illegal resolution: Approved resolution submission % lacks valid reviewer attribution or timestamp', v_approved_sub.id;
        end if;

        -- Verify reviewer was an active super-admin
        select exists (
            select 1 from public.profiles p
            where p.user_id = v_approved_sub.reviewed_by
              and p.role = 'super_admin'
              and p.is_active = true
        ) into v_admin_valid;

        if not v_admin_valid then
            raise exception 'Illegal resolution: Reviewer % for submission % is not an active super administrator',
                v_approved_sub.reviewed_by, v_approved_sub.id;
        end if;

        -- Verify evidence properties
        if v_approved_sub.evidence_stage != 'authority_after' then
            raise exception 'Illegal resolution: Evidence % is not an after-repair photo (stage: %)',
                v_approved_sub.after_photo_evidence_id, v_approved_sub.evidence_stage;
        end if;

        if v_approved_sub.mime_type not like 'image/%' then
            raise exception 'Illegal resolution: Evidence % is not an image (mime_type: %)',
                v_approved_sub.after_photo_evidence_id, v_approved_sub.mime_type;
        end if;

        if v_approved_sub.storage_path_private is null then
            raise exception 'Illegal resolution: Evidence % has no private storage path recorded',
                v_approved_sub.after_photo_evidence_id;
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


-- ============================================================================
-- 5. FUNCTION PRIVILEGES
-- ============================================================================

revoke all on function public.guard_resolution_submission() from public, anon;
grant execute on function public.guard_resolution_submission() to authenticated, service_role;

revoke all on function public.submit_resolution_request(uuid, uuid, text, uuid, date, text, uuid) from public, anon;
grant execute on function public.submit_resolution_request(uuid, uuid, text, uuid, date, text, uuid) to authenticated, service_role;

revoke all on function public.review_resolution_request(uuid, uuid, text, text) from public, anon;
grant execute on function public.review_resolution_request(uuid, uuid, text, text) to authenticated, service_role;

revoke all on function public.guard_spot_resolution() from public, anon;
grant execute on function public.guard_spot_resolution() to authenticated, service_role;
-- NAGRIK SCHEMA MIGRATION 10: RESOLUTION CALL STACK & SERVICE-ROLE HARDENING
-- Authority: TRD Section 6.4, 9.3, 11, 13.3, 14.3 & Phase 4D Final Authorization Audit
-- Target Engine: Supabase PostgreSQL (15+) Public Schema

-- ============================================================================
-- 1. TRIGGER FUNCTION: GUARD RESOLUTION SUBMISSION
-- Enforces:
--   - On INSERT: review_status MUST be 'pending'. Direct creation of approved
--     submissions is strictly prohibited (blocks service_role / SQL bypass).
--   - On UPDATE: Reviewed submissions (review_status != 'pending') are IMMUTABLE.
--   - On UPDATE: Transitioning review_status to non-pending requires execution
--     inside public.review_resolution_request() verified via PG_CONTEXT call stack.
--     Forgeable transaction GUC settings (e.g. set_config) are completely bypassed.
--   - service_role is strictly forbidden from reviewing resolution submissions.
--   - Reviewer identity cannot be caller-supplied or spoofed; must match auth.uid().
-- ============================================================================

create or replace function public.guard_resolution_submission()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, auth, pg_temp
as $$
declare
    v_admin_valid boolean;
    v_after_ev record;
    v_video_ev record;
    v_stack text;
begin
    -- 1. Validate mandatory after-photo evidence
    if new.after_photo_evidence_id is null then
        raise exception 'Mandatory after-photo evidence ID is required';
    end if;

    select id, spot_id, evidence_stage, mime_type, storage_path_private
    into v_after_ev
    from public.evidence
    where id = new.after_photo_evidence_id;

    if v_after_ev.id is null then
        raise exception 'Mandatory after-photo evidence % does not exist', new.after_photo_evidence_id;
    end if;

    if v_after_ev.spot_id != new.spot_id then
        raise exception 'Mandatory after-photo evidence % belongs to spot % but submission references spot %',
            new.after_photo_evidence_id, v_after_ev.spot_id, new.spot_id;
    end if;

    if v_after_ev.evidence_stage != 'authority_after' then
        raise exception 'Mandatory after-photo evidence % must have evidence_stage authority_after (found %)',
            new.after_photo_evidence_id, v_after_ev.evidence_stage;
    end if;

    if v_after_ev.mime_type not like 'image/%' then
        raise exception 'Mandatory after-photo evidence % must be an image (found %)',
            new.after_photo_evidence_id, v_after_ev.mime_type;
    end if;

    if v_after_ev.storage_path_private is null then
        raise exception 'Mandatory after-photo evidence % has no private storage path recorded',
            new.after_photo_evidence_id;
    end if;

    -- 2. Validate supporting video evidence if provided
    if new.video_evidence_id is not null then
        select id, spot_id, evidence_stage, mime_type, storage_path_private
        into v_video_ev
        from public.evidence
        where id = new.video_evidence_id;

        if v_video_ev.id is null then
            raise exception 'Supporting video evidence % does not exist', new.video_evidence_id;
        end if;

        if v_video_ev.spot_id != new.spot_id then
            raise exception 'Supporting video evidence % belongs to spot % but submission references spot %',
                new.video_evidence_id, v_video_ev.spot_id, new.spot_id;
        end if;

        if v_video_ev.evidence_stage != 'authority_video' then
            raise exception 'Supporting video evidence % must have evidence_stage authority_video (found %)',
                new.video_evidence_id, v_video_ev.evidence_stage;
        end if;

        if v_video_ev.mime_type not like 'video/%' then
            raise exception 'Supporting video evidence % must be a video (found %)',
                new.video_evidence_id, v_video_ev.mime_type;
        end if;
    end if;

    -- 3. INSERT Validation: Direct creation of pre-approved submissions is strictly prohibited!
    if tg_op = 'INSERT' then
        if new.review_status != 'pending' then
            raise exception 'Illegal submission: Resolution submissions must be inserted in pending status; direct creation of approved submissions is strictly prohibited';
        end if;

        new.reviewed_by := null;
        new.reviewed_at := null;
        new.review_note := null;
        return new;
    end if;

    -- 4. UPDATE Validation
    if tg_op = 'UPDATE' then
        -- Reviewed submissions are strictly immutable
        if old.review_status != 'pending' then
            raise exception 'Cannot modify resolution submission %: submission has already been reviewed (status: %)',
                old.id, old.review_status;
        end if;

        -- Immutable core fields
        if new.spot_id != old.spot_id then
            raise exception 'Cannot alter spot_id on resolution submission';
        end if;
        if new.submitted_by != old.submitted_by then
            raise exception 'Cannot alter submitted_by on resolution submission';
        end if;
        if new.after_photo_evidence_id != old.after_photo_evidence_id then
            raise exception 'Cannot alter after_photo_evidence_id on resolution submission';
        end if;
        if new.created_at != old.created_at then
            raise exception 'Cannot alter created_at on resolution submission';
        end if;

        -- Review status transition
        if new.review_status != 'pending' then
            -- Invariant: Call stack inspection via PG_CONTEXT (immune to forgeable GUC settings)
            get diagnostics v_stack = pg_context;
            if v_stack not like '%review_resolution_request%' then
                raise exception 'Direct modification of review_status forbidden: submissions can only be reviewed via review_resolution_request()';
            end if;

            -- Invariant: Service-role is strictly forbidden from reviewing resolutions
            if auth.role() = 'service_role' or auth.uid() is null then
                raise exception 'Forbidden: service_role cannot review resolution submissions; human super administrator approval is required';
            end if;

            -- Invariant: Caller must be an active super-admin
            if not public.is_super_admin() then
                raise exception 'Forbidden: Only active super administrators can review resolution submissions';
            end if;

            if new.reviewed_by is null then
                raise exception 'Reviewer ID (reviewed_by) is mandatory when reviewing a submission';
            end if;

            -- Invariant: Reviewer identity must strictly match the authenticated user
            if new.reviewed_by != auth.uid() then
                raise exception 'Forbidden: Reviewer user ID does not match authenticated identity';
            end if;

            new.reviewed_at := coalesce(new.reviewed_at, now());
        end if;

        return new;
    end if;

    return new;
end;
$$;


-- ============================================================================
-- 2. HARDENED REVIEW_RESOLUTION_REQUEST
-- Enforces:
--   - Rejects service_role and unauthenticated callers.
--   - Requires caller to be an active super-admin in profiles.
--   - Sets reviewer attribution strictly from auth.uid().
-- ============================================================================

create or replace function public.review_resolution_request(
    p_submission_id uuid,
    p_reviewed_by uuid,
    p_decision text,
    p_review_note text default null
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public, auth, pg_temp
as $$
declare
    v_sub record;
    v_spot record;
    v_effective_actor uuid;
begin
    -- 1. Strictly forbid service_role and require authenticated human super-admin
    if auth.role() = 'service_role' or auth.uid() is null then
        raise exception 'Forbidden: service_role cannot review resolution requests; only human super administrators can approve resolutions';
    end if;

    if not public.is_super_admin() then
        raise exception 'Unauthorized: Only super administrators can review resolution requests';
    end if;

    -- Reviewer identity is immutable and derived strictly from authenticated session
    if p_reviewed_by is not null and p_reviewed_by != auth.uid() then
        raise exception 'Forbidden: Reviewer user ID does not match authenticated identity';
    end if;
    v_effective_actor := auth.uid();

    if p_decision not in ('approved', 'rejected', 'more_info_required') then
        raise exception 'Invalid decision: %. Allowed: approved, rejected, more_info_required', p_decision;
    end if;

    if p_decision in ('rejected', 'more_info_required') and coalesce(trim(p_review_note), '') = '' then
        raise exception 'Review note is mandatory on rejection or info request';
    end if;

    -- 2. Fetch and lock submission
    select * into v_sub from public.resolution_submissions where id = p_submission_id for update;
    if not found then
        raise exception 'Resolution submission not found: %', p_submission_id;
    end if;

    if v_sub.review_status != 'pending' then
        raise exception 'Resolution submission % has already been reviewed (current status: %)', p_submission_id, v_sub.review_status;
    end if;

    select * into v_spot from public.spots where id = v_sub.spot_id;
    if not found then
        raise exception 'Referenced spot % not found', v_sub.spot_id;
    end if;

    -- 3. Update resolution submission
    update public.resolution_submissions
    set review_status = p_decision,
        reviewed_by = v_effective_actor,
        review_note = p_review_note,
        reviewed_at = now()
    where id = p_submission_id;

    -- 4. Transition spot according to decision
    if p_decision = 'approved' then
        perform public.transition_spot_status(
            v_sub.spot_id,
            'RESOLVED',
            'super_admin',
            v_effective_actor,
            'Resolution approved by super administrator. Note: ' || coalesce(p_review_note, 'Approved'),
            'admin_dashboard'
        );
    else
        perform public.transition_spot_status(
            v_sub.spot_id,
            'IN_PROGRESS',
            'super_admin',
            v_effective_actor,
            'Resolution rejected/more info requested: ' || p_review_note,
            'admin_dashboard'
        );
    end if;

    return true;
end;
$$;


-- ============================================================================
-- 3. HARDENED GUARD_SPOT_RESOLUTION
-- Enforces:
--   - Rejects service_role and unauthenticated callers.
--   - Prior status MUST be RESOLUTION_SUBMITTED.
--   - Transition to RESOLVED must be initiated from review_resolution_request
--     (verified via PG_CONTEXT call stack).
--   - Requires active super-admin caller.
--   - Validates approved submission with super-admin attribution and valid after-photo.
-- ============================================================================

create or replace function public.guard_spot_resolution()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, auth, pg_temp
as $$
declare
    v_approved_sub record;
    v_admin_valid boolean;
    v_stack text;
begin
    if new.status = 'RESOLVED' and old.status is distinct from 'RESOLVED' then
        -- 1. Strictly forbid service_role and require authenticated human super-admin
        if auth.role() = 'service_role' or auth.uid() is null then
            raise exception 'Forbidden: service_role cannot resolve spots; only human super administrators can approve resolutions';
        end if;

        if not public.is_super_admin() then
            raise exception 'Forbidden: Only super administrators can approve issue resolution';
        end if;

        -- 2. State Machine Invariant: RESOLVED can ONLY be transitioned from RESOLUTION_SUBMITTED
        if old.status != 'RESOLUTION_SUBMITTED' then
            raise exception 'Illegal resolution: Spot % can only be transitioned to RESOLVED from RESOLUTION_SUBMITTED state (attempted from %)', new.id, old.status;
        end if;

        -- 3. Call stack check: direct SQL updates to RESOLVED are forbidden
        get diagnostics v_stack = pg_context;
        if v_stack not like '%review_resolution_request%' then
            raise exception 'Illegal resolution: Spots can only be transitioned to RESOLVED via review_resolution_request()';
        end if;

        -- 4. Verification & Provenance Invariant
        select rs.*, e.evidence_stage, e.mime_type, e.storage_path_private
        into v_approved_sub
        from public.resolution_submissions rs
        join public.evidence e on e.id = rs.after_photo_evidence_id
        where rs.spot_id = new.id
          and rs.review_status = 'approved'
          and e.spot_id = new.id
        order by rs.reviewed_at desc nulls last, rs.created_at desc
        limit 1;

        if v_approved_sub.id is null then
            raise exception 'Illegal resolution: Spot % lacks an approved resolution submission with verified after-repair photo evidence', new.id;
        end if;

        if v_approved_sub.reviewed_by is null or v_approved_sub.reviewed_at is null then
            raise exception 'Illegal resolution: Approved resolution submission % lacks valid reviewer attribution or timestamp', v_approved_sub.id;
        end if;

        -- Verify reviewer was an active super-admin
        select exists (
            select 1 from public.profiles p
            where p.user_id = v_approved_sub.reviewed_by
              and p.role = 'super_admin'
              and p.is_active = true
        ) into v_admin_valid;

        if not v_admin_valid then
            raise exception 'Illegal resolution: Reviewer % for submission % is not an active super administrator',
                v_approved_sub.reviewed_by, v_approved_sub.id;
        end if;

        -- Verify evidence properties
        if v_approved_sub.evidence_stage != 'authority_after' then
            raise exception 'Illegal resolution: Evidence % is not an after-repair photo (stage: %)',
                v_approved_sub.after_photo_evidence_id, v_approved_sub.evidence_stage;
        end if;

        if v_approved_sub.mime_type not like 'image/%' then
            raise exception 'Illegal resolution: Evidence % is not an image (mime_type: %)',
                v_approved_sub.after_photo_evidence_id, v_approved_sub.mime_type;
        end if;

        if v_approved_sub.storage_path_private is null then
            raise exception 'Illegal resolution: Evidence % has no private storage path recorded',
                v_approved_sub.after_photo_evidence_id;
        end if;

        new.resolved_at = coalesce(new.resolved_at, now());
    end if;

    if old.status = 'RESOLVED' and new.status != 'RESOLVED' then
        if auth.role() = 'service_role' or auth.uid() is null or not public.is_super_admin() then
            raise exception 'Forbidden: Only super administrators can reopen resolved issues';
        end if;
        new.resolved_at = null;
    end if;

    return new;
end;
$$;


-- ============================================================================
-- 4. FUNCTION PRIVILEGES
-- ============================================================================

revoke all on function public.guard_resolution_submission() from public, anon;
grant execute on function public.guard_resolution_submission() to authenticated, service_role;

revoke all on function public.review_resolution_request(uuid, uuid, text, text) from public, anon, service_role;
grant execute on function public.review_resolution_request(uuid, uuid, text, text) to authenticated;

revoke all on function public.guard_spot_resolution() from public, anon;
grant execute on function public.guard_spot_resolution() to authenticated, service_role;
-- NAGRIK SCHEMA MIGRATION 11: EXACT CALL STACK & SCHEMA QUALIFICATION HARDENING
-- Authority: TRD Section 6.4, 9.3, 11, 13.3, 14.3 & Phase 4D Final Acceptance Gate
-- Target Engine: Supabase PostgreSQL (15+) Public Schema

-- ============================================================================
-- 1. TRIGGER FUNCTION: GUARD RESOLUTION SUBMISSION (HARDENED CALL STACK)
-- Enforces:
--   - On INSERT: review_status MUST be 'pending'. Direct creation of approved
--     submissions is strictly prohibited (blocks service_role / SQL bypass).
--   - On UPDATE: Reviewed submissions (review_status != 'pending') are IMMUTABLE.
--   - On UPDATE: Transitioning review_status to non-pending requires execution
--     inside public.review_resolution_request(uuid,uuid,text,text) verified via
--     exact signature and schema matching on PG_CONTEXT.
--   - Rejects temporary schema (pg_temp) functions and functions with matching
--     names in arbitrary schemas.
--   - service_role is strictly forbidden from reviewing resolution submissions.
--   - Reviewer identity cannot be caller-supplied or spoofed; must match auth.uid().
-- ============================================================================

create or replace function public.guard_resolution_submission()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, auth, pg_temp
as $$
declare
    v_admin_valid boolean;
    v_after_ev record;
    v_video_ev record;
    v_stack text;
begin
    -- 1. Validate mandatory after-photo evidence
    if new.after_photo_evidence_id is null then
        raise exception 'Mandatory after-photo evidence ID is required';
    end if;

    select id, spot_id, evidence_stage, mime_type, storage_path_private
    into v_after_ev
    from public.evidence
    where id = new.after_photo_evidence_id;

    if v_after_ev.id is null then
        raise exception 'Mandatory after-photo evidence % does not exist', new.after_photo_evidence_id;
    end if;

    if v_after_ev.spot_id != new.spot_id then
        raise exception 'Mandatory after-photo evidence % belongs to spot % but submission references spot %',
            new.after_photo_evidence_id, v_after_ev.spot_id, new.spot_id;
    end if;

    if v_after_ev.evidence_stage != 'authority_after' then
        raise exception 'Mandatory after-photo evidence % must have evidence_stage authority_after (found %)',
            new.after_photo_evidence_id, v_after_ev.evidence_stage;
    end if;

    if v_after_ev.mime_type not like 'image/%' then
        raise exception 'Mandatory after-photo evidence % must be an image (found %)',
            new.after_photo_evidence_id, v_after_ev.mime_type;
    end if;

    if v_after_ev.storage_path_private is null then
        raise exception 'Mandatory after-photo evidence % has no private storage path recorded',
            new.after_photo_evidence_id;
    end if;

    -- 2. Validate supporting video evidence if provided
    if new.video_evidence_id is not null then
        select id, spot_id, evidence_stage, mime_type, storage_path_private
        into v_video_ev
        from public.evidence
        where id = new.video_evidence_id;

        if v_video_ev.id is null then
            raise exception 'Supporting video evidence % does not exist', new.video_evidence_id;
        end if;

        if v_video_ev.spot_id != new.spot_id then
            raise exception 'Supporting video evidence % belongs to spot % but submission references spot %',
                new.video_evidence_id, v_video_ev.spot_id, new.spot_id;
        end if;

        if v_video_ev.evidence_stage != 'authority_video' then
            raise exception 'Supporting video evidence % must have evidence_stage authority_video (found %)',
                new.video_evidence_id, v_video_ev.evidence_stage;
        end if;

        if v_video_ev.mime_type not like 'video/%' then
            raise exception 'Supporting video evidence % must be a video (found %)',
                new.video_evidence_id, v_video_ev.mime_type;
        end if;
    end if;

    -- 3. INSERT Validation: Direct creation of pre-approved submissions is strictly prohibited!
    if tg_op = 'INSERT' then
        if new.review_status != 'pending' then
            raise exception 'Illegal submission: Resolution submissions must be inserted in pending status; direct creation of approved submissions is strictly prohibited';
        end if;

        new.reviewed_by := null;
        new.reviewed_at := null;
        new.review_note := null;
        return new;
    end if;

    -- 4. UPDATE Validation
    if tg_op = 'UPDATE' then
        -- Reviewed submissions are strictly immutable
        if old.review_status != 'pending' then
            raise exception 'Cannot modify resolution submission %: submission has already been reviewed (status: %)',
                old.id, old.review_status;
        end if;

        -- Immutable core fields
        if new.spot_id != old.spot_id then
            raise exception 'Cannot alter spot_id on resolution submission';
        end if;
        if new.submitted_by != old.submitted_by then
            raise exception 'Cannot alter submitted_by on resolution submission';
        end if;
        if new.after_photo_evidence_id != old.after_photo_evidence_id then
            raise exception 'Cannot alter after_photo_evidence_id on resolution submission';
        end if;
        if new.created_at != old.created_at then
            raise exception 'Cannot alter created_at on resolution submission';
        end if;

        -- Review status transition
        if new.review_status != 'pending' then
            -- Invariant: Call stack inspection via PG_CONTEXT with exact signature and schema verification
            get diagnostics v_stack = pg_context;
            if v_stack !~ 'PL/pgSQL function (public\.)?review_resolution_request\(uuid,uuid,text,text\) line [0-9]+'
               or v_stack ~ 'pg_temp' then
                raise exception 'Direct modification of review_status forbidden: submissions can only be reviewed via public.review_resolution_request(uuid,uuid,text,text)';
            end if;

            -- Invariant: Service-role is strictly forbidden from reviewing resolutions
            if auth.role() = 'service_role' or auth.uid() is null then
                raise exception 'Forbidden: service_role cannot review resolution submissions; human super administrator approval is required';
            end if;

            -- Invariant: Caller must be an active super-admin
            if not public.is_super_admin() then
                raise exception 'Forbidden: Only active super administrators can review resolution submissions';
            end if;

            if new.reviewed_by is null then
                raise exception 'Reviewer ID (reviewed_by) is mandatory when reviewing a submission';
            end if;

            -- Invariant: Reviewer identity must strictly match the authenticated user
            if new.reviewed_by != auth.uid() then
                raise exception 'Forbidden: Reviewer user ID does not match authenticated identity';
            end if;

            new.reviewed_at := coalesce(new.reviewed_at, now());
        end if;

        return new;
    end if;

    return new;
end;
$$;


-- ============================================================================
-- 2. TRIGGER FUNCTION: GUARD SPOT RESOLUTION (HARDENED CALL STACK)
-- Enforces:
--   - Rejects service_role and unauthenticated callers.
--   - Prior status MUST be RESOLUTION_SUBMITTED.
--   - Transition to RESOLVED must be initiated from public.review_resolution_request(uuid,uuid,text,text)
--     (verified via exact signature and schema pattern on PG_CONTEXT).
--   - Rejects temporary schema (pg_temp) functions and functions in arbitrary schemas.
--   - Requires active super-admin caller.
--   - Validates approved submission with super-admin attribution and valid after-photo.
-- ============================================================================

create or replace function public.guard_spot_resolution()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, auth, pg_temp
as $$
declare
    v_approved_sub record;
    v_admin_valid boolean;
    v_stack text;
begin
    if new.status = 'RESOLVED' and old.status is distinct from 'RESOLVED' then
        -- 1. Strictly forbid service_role and require authenticated human super-admin
        if auth.role() = 'service_role' or auth.uid() is null then
            raise exception 'Forbidden: service_role cannot resolve spots; only human super administrators can approve resolutions';
        end if;

        if not public.is_super_admin() then
            raise exception 'Forbidden: Only super administrators can approve issue resolution';
        end if;

        -- 2. State Machine Invariant: RESOLVED can ONLY be transitioned from RESOLUTION_SUBMITTED
        if old.status != 'RESOLUTION_SUBMITTED' then
            raise exception 'Illegal resolution: Spot % can only be transitioned to RESOLVED from RESOLUTION_SUBMITTED state (attempted from %)', new.id, old.status;
        end if;

        -- 3. Call stack check: direct SQL updates or unauthorized callers to RESOLVED are forbidden
        get diagnostics v_stack = pg_context;
        if v_stack !~ 'PL/pgSQL function (public\.)?review_resolution_request\(uuid,uuid,text,text\) line [0-9]+'
           or v_stack ~ 'pg_temp' then
            raise exception 'Illegal resolution: Spots can only be transitioned to RESOLVED via public.review_resolution_request(uuid,uuid,text,text)';
        end if;

        -- 4. Verification & Provenance Invariant
        select rs.*, e.evidence_stage, e.mime_type, e.storage_path_private
        into v_approved_sub
        from public.resolution_submissions rs
        join public.evidence e on e.id = rs.after_photo_evidence_id
        where rs.spot_id = new.id
          and rs.review_status = 'approved'
          and e.spot_id = new.id
        order by rs.reviewed_at desc nulls last, rs.created_at desc
        limit 1;

        if v_approved_sub.id is null then
            raise exception 'Illegal resolution: Spot % lacks an approved resolution submission with verified after-repair photo evidence', new.id;
        end if;

        if v_approved_sub.reviewed_by is null or v_approved_sub.reviewed_at is null then
            raise exception 'Illegal resolution: Approved resolution submission % lacks valid reviewer attribution or timestamp', v_approved_sub.id;
        end if;

        -- Verify reviewer was an active super-admin
        select exists (
            select 1 from public.profiles p
            where p.user_id = v_approved_sub.reviewed_by
              and p.role = 'super_admin'
              and p.is_active = true
        ) into v_admin_valid;

        if not v_admin_valid then
            raise exception 'Illegal resolution: Reviewer % for submission % is not an active super administrator',
                v_approved_sub.reviewed_by, v_approved_sub.id;
        end if;

        -- Verify evidence properties
        if v_approved_sub.evidence_stage != 'authority_after' then
            raise exception 'Illegal resolution: Evidence % is not an after-repair photo (stage: %)',
                v_approved_sub.after_photo_evidence_id, v_approved_sub.evidence_stage;
        end if;

        if v_approved_sub.mime_type not like 'image/%' then
            raise exception 'Illegal resolution: Evidence % is not an image (mime_type: %)',
                v_approved_sub.after_photo_evidence_id, v_approved_sub.mime_type;
        end if;

        if v_approved_sub.storage_path_private is null then
            raise exception 'Illegal resolution: Evidence % has no private storage path recorded',
                v_approved_sub.after_photo_evidence_id;
        end if;

        new.resolved_at = coalesce(new.resolved_at, now());
    end if;

    if old.status = 'RESOLVED' and new.status != 'RESOLVED' then
        if auth.role() = 'service_role' or auth.uid() is null or not public.is_super_admin() then
            raise exception 'Forbidden: Only super administrators can reopen resolved issues';
        end if;
        new.resolved_at = null;
    end if;

    return new;
end;
$$;


-- ============================================================================
-- 3. FUNCTION PRIVILEGES
-- ============================================================================

revoke all on function public.guard_resolution_submission() from public, anon;
grant execute on function public.guard_resolution_submission() to authenticated, service_role;

revoke all on function public.guard_spot_resolution() from public, anon;
grant execute on function public.guard_spot_resolution() to authenticated, service_role;
-- NAGRIK SCHEMA MIGRATION 12: CITIZEN REPORT INTAKE & CONVERSATION PERSISTENCE
-- Authority: TRD Section 8, 9, 10, 11, 14 & Phase 5 Primary Acceptance Objective
-- Target Engine: Supabase PostgreSQL (15+) Public Schema

-- ============================================================================
-- 1. SCHEMA HARDENING FOR REPORT DRAFTS
-- Ensure report_drafts has a unique constraint on citizen_contact_id so drafts
-- can be upserted idempotently per citizen contact.
-- ============================================================================

create unique index if not exists idx_report_drafts_contact_unique
    on public.report_drafts (citizen_contact_id);

-- ============================================================================
-- 2. TRANSACTIONAL OPERATION: create_report_submission
-- Atomically creates citizen contact, unlinked report record, initial evidence,
-- audit event, notification outbox entry, and updates telegram processing status.
--
-- Invariants:
-- - spot_id is strictly NULL at initial creation.
-- - review_status is strictly 'new'.
-- - Replayed updates with same telegram_update_id are idempotent.
-- - Validates taxonomy group, category, issue_type, and language.
-- ============================================================================

create or replace function public.create_report_submission(
    p_telegram_user_hash text,
    p_encrypted_chat_id text,
    p_language text default 'en',
    p_pilot_id text default 'kharghar_itm_v1',
    p_group_id text default null,
    p_category_id text default null,
    p_issue_type_id text default null,
    p_description_private text default null,
    p_latitude numeric default null,
    p_longitude numeric default null,
    p_horizontal_accuracy_m numeric default null,
    p_location_source text default 'telegram_location',
    p_storage_path_private text default null,
    p_mime_type text default null,
    p_file_size_bytes bigint default null,
    p_sha256 text default null,
    p_telegram_file_unique_id text default null,
    p_telegram_update_id bigint default null,
    p_is_demo boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth, pg_temp
as $$
declare
    v_contact_id uuid;
    v_ticket_code text;
    v_report_id uuid;
    v_evidence_id uuid;
    v_existing_report record;
    v_lang text;
begin
    -- 1. Input Validation
    if p_telegram_user_hash is null or trim(p_telegram_user_hash) = '' then
        raise exception 'Invalid submission: telegram_user_hash is mandatory'
            using errcode = '22023';
    end if;

    if p_encrypted_chat_id is null or trim(p_encrypted_chat_id) = '' then
        raise exception 'Invalid submission: encrypted_chat_id is mandatory'
            using errcode = '22023';
    end if;

    if p_group_id is null or trim(p_group_id) = '' then
        raise exception 'Invalid submission: group_id is mandatory'
            using errcode = '22023';
    end if;

    if p_category_id is null or trim(p_category_id) = '' then
        raise exception 'Invalid submission: category_id is mandatory'
            using errcode = '22023';
    end if;

    if p_issue_type_id is null or trim(p_issue_type_id) = '' then
        raise exception 'Invalid submission: issue_type_id is mandatory'
            using errcode = '22023';
    end if;

    v_lang := coalesce(lower(trim(p_language)), 'en');
    if v_lang not in ('en', 'hi', 'mr') then
        v_lang := 'en';
    end if;

    if p_location_source not in ('telegram_location', 'manual_pin', 'landmark') then
        raise exception 'Invalid submission: unknown location_source %', p_location_source
            using errcode = '22023';
    end if;

    -- 2. Idempotency Check: if update_id is already associated with an existing report, return existing
    if p_telegram_update_id is not null then
        select id, ticket_code into v_existing_report
        from public.reports
        where telegram_update_id = p_telegram_update_id;

        if v_existing_report.id is not null then
            select id into v_evidence_id
            from public.evidence
            where report_id = v_existing_report.id
            limit 1;

            return jsonb_build_object(
                'report_id', v_existing_report.id,
                'ticket_code', v_existing_report.ticket_code,
                'evidence_id', v_evidence_id,
                'is_duplicate', true
            );
        end if;
    end if;

    -- 3. Upsert citizen contact
    insert into public.citizen_contacts (
        telegram_user_hash,
        encrypted_chat_id,
        language,
        last_seen_at
    )
    values (
        p_telegram_user_hash,
        p_encrypted_chat_id,
        v_lang,
        now()
    )
    on conflict (telegram_user_hash) do update set
        encrypted_chat_id = excluded.encrypted_chat_id,
        language = excluded.language,
        last_seen_at = now()
    returning id into v_contact_id;

    -- 4. Generate unique ticket code
    v_ticket_code := public.generate_ticket_code('KHR');

    -- 5. Insert unlinked report record (spot_id is strictly NULL)
    insert into public.reports (
        ticket_code,
        citizen_contact_id,
        pilot_id,
        group_id,
        category_id,
        issue_type_id,
        description_private,
        language,
        latitude,
        longitude,
        horizontal_accuracy_m,
        location_source,
        location_review_status,
        spot_id,
        review_status,
        is_demo,
        telegram_update_id
    )
    values (
        v_ticket_code,
        v_contact_id,
        coalesce(p_pilot_id, 'kharghar_itm_v1'),
        p_group_id,
        p_category_id,
        p_issue_type_id,
        p_description_private,
        v_lang,
        p_latitude,
        p_longitude,
        p_horizontal_accuracy_m,
        p_location_source,
        'unreviewed',
        null,        -- Invariant: spot_id strictly NULL
        'new',       -- Invariant: review_status strictly 'new'
        p_is_demo,
        p_telegram_update_id
    )
    returning id into v_report_id;

    -- 6. Insert evidence if file metadata provided
    if p_storage_path_private is not null and p_sha256 is not null then
        insert into public.evidence (
            report_id,
            spot_id,
            evidence_stage,
            storage_path_private,
            mime_type,
            file_size_bytes,
            sha256,
            telegram_file_unique_id,
            uploaded_by_contact_id
        )
        values (
            v_report_id,
            null,
            'citizen_initial',
            p_storage_path_private,
            coalesce(p_mime_type, 'image/jpeg'),
            coalesce(p_file_size_bytes, 1),
            p_sha256,
            p_telegram_file_unique_id,
            v_contact_id
        )
        returning id into v_evidence_id;
    end if;

    -- 7. Write audit log
    insert into public.audit_logs (
        actor_type,
        action,
        entity_type,
        entity_id,
        after_value
    )
    values (
        'system',
        'REPORT_CREATED',
        'report',
        v_report_id,
        jsonb_build_object(
            'ticket_code', v_ticket_code,
            'group_id', p_group_id,
            'category_id', p_category_id,
            'issue_type_id', p_issue_type_id,
            'is_demo', p_is_demo
        )
    );

    -- 8. Enqueue initial confirmation notification
    insert into public.notification_outbox (
        citizen_contact_id,
        event_type,
        payload
    )
    values (
        v_contact_id,
        'report_received',
        jsonb_build_object(
            'ticket_code', v_ticket_code,
            'language', v_lang,
            'category_id', p_category_id,
            'report_id', v_report_id
        )
    );

    -- 9. Mark Telegram update processed if supplied
    if p_telegram_update_id is not null then
        insert into public.telegram_updates (update_id, processed_at, processing_status)
        values (p_telegram_update_id, now(), 'processed')
        on conflict (update_id) do update set
            processed_at = now(),
            processing_status = 'processed';
    end if;

    -- 10. Clear active draft for this contact upon successful submission
    delete from public.report_drafts
    where citizen_contact_id = v_contact_id;

    return jsonb_build_object(
        'report_id', v_report_id,
        'ticket_code', v_ticket_code,
        'evidence_id', v_evidence_id,
        'is_duplicate', false
    );
end;
$$;


-- ============================================================================
-- 3. DRAFT MANAGEMENT RPCs
-- ============================================================================

create or replace function public.upsert_report_draft(
    p_telegram_user_hash text,
    p_encrypted_chat_id text,
    p_conversation_state text,
    p_draft_payload jsonb,
    p_language text default 'en',
    p_ttl_hours int default 48
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, auth, pg_temp
as $$
declare
    v_contact_id uuid;
    v_lang text;
begin
    v_lang := coalesce(lower(trim(p_language)), 'en');
    if v_lang not in ('en', 'hi', 'mr') then
        v_lang := 'en';
    end if;

    -- Upsert contact
    insert into public.citizen_contacts (
        telegram_user_hash,
        encrypted_chat_id,
        language,
        last_seen_at
    )
    values (
        p_telegram_user_hash,
        p_encrypted_chat_id,
        v_lang,
        now()
    )
    on conflict (telegram_user_hash) do update set
        encrypted_chat_id = excluded.encrypted_chat_id,
        language = excluded.language,
        last_seen_at = now()
    returning id into v_contact_id;

    -- Upsert draft
    insert into public.report_drafts (
        citizen_contact_id,
        conversation_state,
        draft_payload,
        expires_at,
        updated_at
    )
    values (
        v_contact_id,
        p_conversation_state,
        coalesce(p_draft_payload, '{}'::jsonb),
        now() + (p_ttl_hours || ' hours')::interval,
        now()
    )
    on conflict (citizen_contact_id) do update set
        conversation_state = excluded.conversation_state,
        draft_payload = excluded.draft_payload,
        expires_at = excluded.expires_at,
        updated_at = now();

    return v_contact_id;
end;
$$;

create or replace function public.get_report_draft_by_hash(
    p_telegram_user_hash text
)
returns table (
    contact_id uuid,
    encrypted_chat_id text,
    language text,
    conversation_state text,
    draft_payload jsonb,
    is_expired boolean
)
language plpgsql
security definer
set search_path = pg_catalog, public, auth, pg_temp
as $$
begin
    return query
    select
        c.id as contact_id,
        c.encrypted_chat_id,
        c.language,
        d.conversation_state,
        d.draft_payload,
        (d.expires_at < now()) as is_expired
    from public.citizen_contacts c
    left join public.report_drafts d on d.citizen_contact_id = c.id
    where c.telegram_user_hash = p_telegram_user_hash
    limit 1;
end;
$$;

create or replace function public.clear_report_draft_by_hash(
    p_telegram_user_hash text
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public, auth, pg_temp
as $$
declare
    v_contact_id uuid;
begin
    select id into v_contact_id
    from public.citizen_contacts
    where telegram_user_hash = p_telegram_user_hash;

    if v_contact_id is not null then
        delete from public.report_drafts where citizen_contact_id = v_contact_id;
        return true;
    end if;
    return false;
end;
$$;


-- ============================================================================
-- 4. FUNCTION EXECUTION PRIVILEGES
-- ============================================================================

revoke all on function public.create_report_submission(text, text, text, text, text, text, text, text, numeric, numeric, numeric, text, text, text, bigint, text, text, bigint, boolean) from public, anon;
grant execute on function public.create_report_submission(text, text, text, text, text, text, text, text, numeric, numeric, numeric, text, text, text, bigint, text, text, bigint, boolean) to authenticated, service_role;

revoke all on function public.upsert_report_draft(text, text, text, jsonb, text, int) from public, anon;
grant execute on function public.upsert_report_draft(text, text, text, jsonb, text, int) to authenticated, service_role;

revoke all on function public.get_report_draft_by_hash(text) from public, anon;
grant execute on function public.get_report_draft_by_hash(text) to authenticated, service_role;

revoke all on function public.clear_report_draft_by_hash(text) from public, anon;
grant execute on function public.clear_report_draft_by_hash(text) to authenticated, service_role;
