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
