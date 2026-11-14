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
