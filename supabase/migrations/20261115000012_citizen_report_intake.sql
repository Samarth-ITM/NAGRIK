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
