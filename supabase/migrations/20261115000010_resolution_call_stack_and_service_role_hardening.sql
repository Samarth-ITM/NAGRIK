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
