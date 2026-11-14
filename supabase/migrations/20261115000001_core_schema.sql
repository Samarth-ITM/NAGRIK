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
