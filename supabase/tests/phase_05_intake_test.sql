-- ============================================================================
-- NAGRIK PHASE 5: CITIZEN REPORT INTAKE & CONVERSATION TESTS
-- Authority: TRD Section 8, 9, 10, 11, 14 & Phase 5 Primary Acceptance Objective
-- Database: Supabase PostgreSQL (15+)
-- ============================================================================

RESET ROLE;
SET search_path = public, auth;

DO $$
BEGIN
    RAISE NOTICE '=======================================================';
    RAISE NOTICE 'INITIALIZING PHASE 5 REPORT INTAKE & CONVERSATION TESTS';
    RAISE NOTICE '=======================================================';
END;
$$;

-- Scenario 1: Anonymous / Public execution of create_report_submission is forbidden
SET ROLE anon;
DO $$
BEGIN
    PERFORM public.create_report_submission(
        'anon_hash', 'enc_chat', 'en', 'kharghar_itm_v1',
        'roads_mobility', 'road_surface', 'pothole', 'Test pothole',
        19.0475, 73.0699, 5.0, 'telegram_location'
    );
    RAISE EXCEPTION 'SCENARIO 1 FAILED: Anon should not have execute privilege on create_report_submission';
EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%permission denied for function create_report_submission%' THEN
        RAISE EXCEPTION 'SCENARIO 1 FAILED: Unexpected error: %', SQLERRM;
    END IF;
    RAISE NOTICE 'SCENARIO 1 PASSED: Anonymous user denied execute on create_report_submission';
END;
$$;
RESET ROLE;

-- Scenario 2: Service-role creates a valid unlinked Report atomically
SET ROLE postgres;
SET request.jwt.claim.role = 'service_role';
DO $$
DECLARE
    v_res jsonb;
    v_report public.reports%rowtype;
    v_contact public.citizen_contacts%rowtype;
    v_evidence public.evidence%rowtype;
    v_audit public.audit_logs%rowtype;
    v_outbox public.notification_outbox%rowtype;
    v_user_hash text := 'test_p5_user_hash_001';
    v_chat_id text := '1234567890:authTag:cipherChat';
    v_update_id bigint := 50000001;
BEGIN
    v_res := public.create_report_submission(
        v_user_hash,
        v_chat_id,
        'hi',
        'kharghar_itm_v1',
        'roads_mobility',
        'road_surface',
        'pothole',
        'Deep pothole near entrance',
        19.0475100,
        73.0699400,
        3.5,
        'telegram_location',
        'evidence-private/reports/NAG-KHR-2026-TEST01/photo.jpg',
        'image/jpeg',
        2048500,
        'abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789',
        'tg_file_unique_id_999',
        v_update_id,
        false
    );

    IF (v_res->>'is_duplicate')::boolean IS NOT FALSE THEN
        RAISE EXCEPTION 'SCENARIO 2 FAILED: Expected is_duplicate = false';
    END IF;

    -- Verify Report Record
    SELECT * INTO v_report FROM public.reports WHERE id = (v_res->>'report_id')::uuid;
    IF v_report.id IS NULL THEN
        RAISE EXCEPTION 'SCENARIO 2 FAILED: Report row not created!';
    END IF;

    -- Strict Invariant: spot_id MUST be NULL at creation
    IF v_report.spot_id IS NOT NULL THEN
        RAISE EXCEPTION 'SCENARIO 2 FAILED: spot_id MUST be NULL at creation! (Found: %)', v_report.spot_id;
    END IF;

    -- Strict Invariant: review_status MUST be 'new'
    IF v_report.review_status != 'new' THEN
        RAISE EXCEPTION 'SCENARIO 2 FAILED: review_status must be new! (Found: %)', v_report.review_status;
    END IF;

    IF v_report.ticket_code NOT LIKE 'NAG-KHR-%' THEN
        RAISE EXCEPTION 'SCENARIO 2 FAILED: ticket_code format invalid: %', v_report.ticket_code;
    END IF;

    -- Verify Contact Record
    SELECT * INTO v_contact FROM public.citizen_contacts WHERE id = v_report.citizen_contact_id;
    IF v_contact.telegram_user_hash != v_user_hash OR v_contact.language != 'hi' THEN
        RAISE EXCEPTION 'SCENARIO 2 FAILED: Contact not created/updated properly!';
    END IF;

    -- Verify Evidence Record
    SELECT * INTO v_evidence FROM public.evidence WHERE id = (v_res->>'evidence_id')::uuid;
    IF v_evidence.id IS NULL OR v_evidence.evidence_stage != 'citizen_initial' OR v_evidence.report_id != v_report.id THEN
        RAISE EXCEPTION 'SCENARIO 2 FAILED: Evidence not created properly!';
    END IF;

    -- Verify Audit Log Record
    SELECT * INTO v_audit FROM public.audit_logs WHERE entity_id = v_report.id;
    IF v_audit.action != 'REPORT_CREATED' THEN
        RAISE EXCEPTION 'SCENARIO 2 FAILED: Audit log entry missing!';
    END IF;

    -- Verify Notification Outbox Record
    SELECT * INTO v_outbox FROM public.notification_outbox WHERE citizen_contact_id = v_contact.id;
    IF v_outbox.event_type != 'report_received' THEN
        RAISE EXCEPTION 'SCENARIO 2 FAILED: Outbox notification missing!';
    END IF;

    RAISE NOTICE 'SCENARIO 2 PASSED: create_report_submission created atomic unlinked report, evidence, audit log, and outbox';
END;
$$;

-- Scenario 3: Idempotent replay of the same telegram_update_id returns existing report
DO $$
DECLARE
    v_res jsonb;
    v_user_hash text := 'test_p5_user_hash_001';
    v_chat_id text := '1234567890:authTag:cipherChat';
    v_update_id bigint := 50000001;
    v_count integer;
BEGIN
    v_res := public.create_report_submission(
        v_user_hash,
        v_chat_id,
        'hi',
        'kharghar_itm_v1',
        'roads_mobility',
        'road_surface',
        'pothole',
        'Deep pothole near entrance - replay attempt',
        19.0475100,
        73.0699400,
        3.5,
        'telegram_location',
        'evidence-private/reports/NAG-KHR-2026-TEST01/photo.jpg',
        'image/jpeg',
        2048500,
        'abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789',
        'tg_file_unique_id_999',
        v_update_id,
        false
    );

    IF (v_res->>'is_duplicate')::boolean IS NOT TRUE THEN
        RAISE EXCEPTION 'SCENARIO 3 FAILED: Expected is_duplicate = true on replay!';
    END IF;

    SELECT count(*) INTO v_count FROM public.reports WHERE telegram_update_id = v_update_id;
    IF v_count != 1 THEN
        RAISE EXCEPTION 'SCENARIO 3 FAILED: Duplicate report row was created! Count: %', v_count;
    END IF;

    RAISE NOTICE 'SCENARIO 3 PASSED: Duplicate Telegram update ID handled idempotently without duplicate row creation';
END;
$$;

-- Scenario 4: Validation rejects missing mandatory taxonomy fields
DO $$
BEGIN
    PERFORM public.create_report_submission(
        'test_hash_002', 'enc_chat_2', 'en', 'kharghar_itm_v1',
        null, -- missing group_id
        'road_surface', 'pothole', 'Desc',
        19.0475, 73.0699, 5.0, 'telegram_location'
    );
    RAISE EXCEPTION 'SCENARIO 4 FAILED: Missing group_id should have been rejected!';
EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%group_id is mandatory%' THEN
        RAISE EXCEPTION 'SCENARIO 4 FAILED: Unexpected error: %', SQLERRM;
    END IF;
    RAISE NOTICE 'SCENARIO 4 PASSED: Missing taxonomy group rejected cleanly';
END;
$$;

-- Scenario 5: Draft management RPCs work correctly and isolate citizens
DO $$
DECLARE
    v_contact_a uuid;
    v_contact_b uuid;
    v_draft record;
    v_draft_b record;
    v_cleared boolean;
BEGIN
    -- Upsert draft for Citizen A
    v_contact_a := public.upsert_report_draft(
        'citizen_a_hash',
        'enc_chat_a',
        'AWAITING_CATEGORY',
        '{"group_id": "roads_mobility", "step": 2}'::jsonb,
        'en'
    );

    -- Upsert draft for Citizen B
    v_contact_b := public.upsert_report_draft(
        'citizen_b_hash',
        'enc_chat_b',
        'AWAITING_PHOTO',
        '{"group_id": "waste_sanitation", "category_id": "garbage_dumping"}'::jsonb,
        'mr'
    );

    -- Fetch Citizen A draft
    SELECT * INTO v_draft FROM public.get_report_draft_by_hash('citizen_a_hash');
    IF v_draft.conversation_state != 'AWAITING_CATEGORY' OR (v_draft.draft_payload->>'group_id') != 'roads_mobility' THEN
        RAISE EXCEPTION 'SCENARIO 5 FAILED: Citizen A draft corrupted or missing!';
    END IF;

    -- Fetch Citizen B draft
    SELECT * INTO v_draft_b FROM public.get_report_draft_by_hash('citizen_b_hash');
    IF v_draft_b.conversation_state != 'AWAITING_PHOTO' OR (v_draft_b.draft_payload->>'group_id') != 'waste_sanitation' THEN
        RAISE EXCEPTION 'SCENARIO 5 FAILED: Citizen B draft corrupted or missing!';
    END IF;

    -- Citizen isolation verified
    IF v_draft.contact_id = v_draft_b.contact_id THEN
        RAISE EXCEPTION 'SCENARIO 5 FAILED: Citizen A and B contacts collided!';
    END IF;

    -- Clear Citizen A draft
    v_cleared := public.clear_report_draft_by_hash('citizen_a_hash');
    IF NOT v_cleared THEN
        RAISE EXCEPTION 'SCENARIO 5 FAILED: Failed to clear Citizen A draft!';
    END IF;

    SELECT * INTO v_draft FROM public.get_report_draft_by_hash('citizen_a_hash');
    IF v_draft.conversation_state IS NOT NULL THEN
        RAISE EXCEPTION 'SCENARIO 5 FAILED: Citizen A draft should be cleared!';
    END IF;

    -- Citizen B draft remains intact
    SELECT * INTO v_draft_b FROM public.get_report_draft_by_hash('citizen_b_hash');
    IF v_draft_b.conversation_state != 'AWAITING_PHOTO' THEN
        RAISE EXCEPTION 'SCENARIO 5 FAILED: Clearing Citizen A draft affected Citizen B!';
    END IF;

    RAISE NOTICE 'SCENARIO 5 PASSED: Draft management RPCs work correctly and maintain strict cross-citizen isolation';
END;
$$;

-- Scenario 6: Completing a submission clears active draft atomically
DO $$
DECLARE
    v_user_hash text := 'draft_submit_test_hash';
    v_chat_id text := 'enc_chat_draft';
    v_draft record;
    v_res jsonb;
BEGIN
    -- Citizen creates a draft
    PERFORM public.upsert_report_draft(
        v_user_hash,
        v_chat_id,
        'CONFIRM_SUBMISSION',
        '{"group_id": "utilities_lighting_greenery", "category_id": "water_supply_public_taps", "issue_type_id": "water_pipeline_leakage"}'::jsonb,
        'mr'
    );

    SELECT * INTO v_draft FROM public.get_report_draft_by_hash(v_user_hash);
    IF v_draft.conversation_state != 'CONFIRM_SUBMISSION' THEN
        RAISE EXCEPTION 'SCENARIO 6 FAILED: Draft was not established';
    END IF;

    -- Submit report
    v_res := public.create_report_submission(
        v_user_hash,
        v_chat_id,
        'mr',
        'kharghar_itm_v1',
        'utilities_lighting_greenery',
        'water_supply_public_taps',
        'water_pipeline_leakage',
        'Water leakage confirmed submission',
        19.0475,
        73.0699,
        4.0,
        'telegram_location',
        null, null, null, null, null,
        60000001,
        false
    );

    -- Verify draft was cleared
    SELECT * INTO v_draft FROM public.get_report_draft_by_hash(v_user_hash);
    IF v_draft.conversation_state IS NOT NULL THEN
        RAISE EXCEPTION 'SCENARIO 6 FAILED: Completed submission failed to delete active draft!';
    END IF;

    RAISE NOTICE 'SCENARIO 6 PASSED: Completed submission atomically cleared active draft';
END;
$$;

RESET ROLE;

DO $$
BEGIN
    RAISE NOTICE '=======================================================';
    RAISE NOTICE 'ALL 6 PHASE 5 INTAKE & CONVERSATION SCENARIOS PASSED!';
    RAISE NOTICE '=======================================================';
END;
$$;
