-- ============================================================================
-- NAGRIK DEFERRED WORKFLOW RPC FUNCTIONS (ARCHIVED REFERENCE)
-- Authority: Scope Correction per Phase 3A Audit
-- ============================================================================
--
-- Notice:
-- In accordance with the Phase 3 boundary ("Database foundation, schema,
-- migrations & security"), application workflow RPC functions are deferred
-- to their respective implementation phases:
--
-- 1. Phase 4 (Civic reporting, matching & resolution workflow):
--    - create_spot_for_report
--    - link_report_to_spot
--    - transition_spot_status
--    - record_authority_handoff
--    - submit_resolution_request
--    - review_resolution_request
--    - create_citizen_challenge
--
-- 2. Phase 5 (Telegram bot and citizen reporting integration):
--    - create_report_submission
--
-- The database schema, foreign keys, check constraints, audit logs, and
-- status history tables in active Phase 3 migrations remain fully compatible
-- and ready to support these workflows when implemented.
--
-- The complete SQL function definitions are archived below for implementation in Phases 4 & 5.
-- ============================================================================

-- DEFERRED FOR PHASE 5: create_report_submission
/*
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
...
$$;
*/

-- DEFERRED FOR PHASE 4: create_spot_for_report
/*
create or replace function public.create_spot_for_report(
    p_report_id uuid,
    p_actor_user_id uuid,
    p_severity_label text default null,
    p_assigned_organisation_id uuid default null
)
returns jsonb
...
*/

-- DEFERRED FOR PHASE 4: link_report_to_spot
/*
create or replace function public.link_report_to_spot(
    p_report_id uuid,
    p_spot_id uuid,
    p_actor_user_id uuid,
    p_match_distance_m numeric,
    p_match_note text default null
)
returns boolean
...
*/

-- DEFERRED FOR PHASE 4: transition_spot_status
/*
create or replace function public.transition_spot_status(
    p_spot_id uuid,
    p_new_status text,
    p_actor_type text,
    p_actor_user_id uuid,
    p_note text,
    p_source text default 'admin_dashboard'
)
returns boolean
...
*/

-- DEFERRED FOR PHASE 4: record_authority_handoff
/*
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
...
*/

-- DEFERRED FOR PHASE 4: submit_resolution_request
/*
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
...
*/

-- DEFERRED FOR PHASE 4: review_resolution_request
/*
create or replace function public.review_resolution_request(
    p_submission_id uuid,
    p_reviewed_by uuid,
    p_decision text,
    p_review_note text
)
returns boolean
...
*/

-- DEFERRED FOR PHASE 4: create_citizen_challenge
/*
create or replace function public.create_citizen_challenge(
    p_spot_id uuid,
    p_citizen_contact_id uuid,
    p_challenge_type text,
    p_note text default null,
    p_report_id uuid default null
)
returns uuid
...
*/
