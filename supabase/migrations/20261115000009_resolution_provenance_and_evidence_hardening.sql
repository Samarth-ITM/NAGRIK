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
