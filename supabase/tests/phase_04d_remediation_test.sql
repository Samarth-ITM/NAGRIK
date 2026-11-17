-- ============================================================================
-- NAGRIK PHASE 4D: DATABASE SECURITY & WORKFLOW INVARIANT REMEDIATION TESTS
-- Authority: TRD Section 6.4, 9.3, 13.3, 14.3 & Phase 4D Remediation Scope
-- Database: Supabase PostgreSQL (15+)
-- ============================================================================

RESET ROLE;
SET search_path = public, auth;
SET request.jwt.claim.role = 'service_role';

-- ============================================================================
-- INITIALIZE TEST FIXTURES FOR PHASE 4D
-- ============================================================================
DO $$
DECLARE
    v_org_a_id uuid := 'b0000000-0000-0000-0000-000000000001'; -- Water Dept
    v_org_b_id uuid := 'b0000000-0000-0000-0000-000000000002'; -- Roads Dept
    v_contact_1_id uuid := 'f0000000-0000-0000-0000-000000000001';
    v_contact_2_id uuid := 'f0000000-0000-0000-0000-000000000002';
BEGIN
    RAISE NOTICE '=======================================================';
    RAISE NOTICE 'INITIALIZING PHASE 4D REMEDIATION FIXTURES';
    RAISE NOTICE '=======================================================';

    -- Ensure citizen contacts exist
    INSERT INTO public.citizen_contacts (
        id, telegram_user_hash, encrypted_chat_id, language
    ) VALUES (
        v_contact_1_id, 'synthetic_hash_contact_1', 'synthetic_chat_contact_1', 'en'
    ) ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.citizen_contacts (
        id, telegram_user_hash, encrypted_chat_id, language
    ) VALUES (
        v_contact_2_id, 'synthetic_hash_contact_2', 'synthetic_chat_contact_2', 'en'
    ) ON CONFLICT (id) DO NOTHING;

    -- Spot 81: Assigned to Org A, RESOLVED with valid after-photo and approved submission
    INSERT INTO public.spots (
        id, spot_code, pilot_id, group_id, category_id, issue_type_id,
        canonical_latitude, canonical_longitude, anchor_accuracy_m, status,
        assigned_organisation_id, public_approved, is_demo, resolved_at
    ) VALUES (
        'c0000000-0000-0000-0000-000000000081', 'SPT-KHR-000981', 'kharghar_itm_v1',
        'utilities_lighting_greenery', 'water_supply_public_taps', 'water_pipeline_leakage',
        19.0475100, 73.0699400, 4.0, 'RESOLUTION_SUBMITTED',
        v_org_a_id, true, false, null
    ) ON CONFLICT (id) DO UPDATE SET status = 'RESOLUTION_SUBMITTED';

    -- Evidence for Spot 81
    INSERT INTO public.evidence (
        id, spot_id, evidence_stage, storage_path_private, file_size_bytes, mime_type,
        sha256
    ) VALUES (
        'e1000000-0000-0000-0000-000000000081', 'c0000000-0000-0000-0000-000000000081',
        'authority_after', 'evidence-private/spots/SPT-KHR-000981/after_repair.jpg',
        1048576, 'image/jpeg', '8181818181818181818181818181818181818181818181818181818181818181'
    ) ON CONFLICT (id) DO NOTHING;

    -- Resolution submission for Spot 81 (pre-approved with super-admin provenance)
    INSERT INTO public.resolution_submissions (
        spot_id, submitted_by, completion_note, after_photo_evidence_id, review_status,
        reviewed_by, reviewed_at
    ) VALUES (
        'c0000000-0000-0000-0000-000000000081', 'a0000000-0000-0000-0000-000000000002',
        'Pipe repaired and sealed.', 'e1000000-0000-0000-0000-000000000081', 'approved',
        'a0000000-0000-0000-0000-000000000001', now()
    ) ON CONFLICT DO NOTHING;

    -- Transition Spot 81 to RESOLVED now that approved submission exists
    UPDATE public.spots
    SET status = 'RESOLVED', resolved_at = now()
    WHERE id = 'c0000000-0000-0000-0000-000000000081';

    -- Spot 82: Assigned to Org A, IN_PROGRESS
    INSERT INTO public.spots (
        id, spot_code, pilot_id, group_id, category_id, issue_type_id,
        canonical_latitude, canonical_longitude, anchor_accuracy_m, status,
        assigned_organisation_id, public_approved, is_demo
    ) VALUES (
        'c0000000-0000-0000-0000-000000000082', 'SPT-KHR-000982', 'kharghar_itm_v1',
        'utilities_lighting_greenery', 'water_supply_public_taps', 'water_pipeline_leakage',
        19.0475200, 73.0699500, 4.0, 'IN_PROGRESS',
        v_org_a_id, true, false
    ) ON CONFLICT (id) DO UPDATE SET status = 'IN_PROGRESS';

    -- Evidence for Spot 82
    INSERT INTO public.evidence (
        id, spot_id, evidence_stage, storage_path_private, file_size_bytes, mime_type,
        sha256
    ) VALUES (
        'e1000000-0000-0000-0000-000000000082', 'c0000000-0000-0000-0000-000000000082',
        'authority_after', 'evidence-private/spots/SPT-KHR-000982/after_repair.jpg',
        1048576, 'image/jpeg', '8282828282828282828282828282828282828282828282828282828282828282'
    ) ON CONFLICT (id) DO NOTHING;

    -- Spot 83: Assigned to Org B, HANDED_OFF
    INSERT INTO public.spots (
        id, spot_code, pilot_id, group_id, category_id, issue_type_id,
        canonical_latitude, canonical_longitude, anchor_accuracy_m, status,
        assigned_organisation_id, public_approved, is_demo
    ) VALUES (
        'c0000000-0000-0000-0000-000000000083', 'SPT-KHR-000983', 'kharghar_itm_v1',
        'roads_footpaths_drainage', 'roads_footpaths', 'pothole',
        19.0481000, 73.0682000, 4.0, 'HANDED_OFF',
        v_org_b_id, true, false
    ) ON CONFLICT (id) DO UPDATE SET status = 'HANDED_OFF';

    RAISE NOTICE 'PHASE 4D FIXTURES INITIALIZED.';
END;
$$;

-- ============================================================================
-- SCENARIO 1: PUBLIC SCHEMA PRIVILEGE LOCKDOWN
-- ============================================================================
RESET ROLE;

DO $$
BEGIN
    IF has_schema_privilege('anon', 'public', 'CREATE') THEN
        RAISE EXCEPTION 'SCENARIO 1 FAILED: anon still has CREATE privilege on public schema!';
    END IF;

    IF has_schema_privilege('authenticated', 'public', 'CREATE') THEN
        RAISE EXCEPTION 'SCENARIO 1 FAILED: authenticated still has CREATE privilege on public schema!';
    END IF;

    IF has_schema_privilege('public', 'public', 'CREATE') THEN
        RAISE EXCEPTION 'SCENARIO 1 FAILED: PUBLIC still has CREATE privilege on public schema!';
    END IF;

    RAISE NOTICE 'SCENARIO 1 PASSED: CREATE privilege on public schema revoked from anon, authenticated, and PUBLIC.';
END;
$$;

-- ============================================================================
-- SCENARIO 2: RPC EXECUTION DENIAL FOR ANONYMOUS & PUBLIC ROLES
-- ============================================================================
DO $$
BEGIN
    IF has_function_privilege('anon', 'public.transition_spot_status(uuid,text,text,uuid,text,text)', 'EXECUTE') THEN
        RAISE EXCEPTION 'SCENARIO 2 FAILED: anon has EXECUTE on transition_spot_status!';
    END IF;

    IF has_function_privilege('anon', 'public.submit_resolution_request(uuid,uuid,text,uuid,date,text,uuid)', 'EXECUTE') THEN
        RAISE EXCEPTION 'SCENARIO 2 FAILED: anon has EXECUTE on submit_resolution_request!';
    END IF;

    IF has_function_privilege('anon', 'public.review_resolution_request(uuid,uuid,text,text)', 'EXECUTE') THEN
        RAISE EXCEPTION 'SCENARIO 2 FAILED: anon has EXECUTE on review_resolution_request!';
    END IF;

    IF has_function_privilege('anon', 'public.create_spot_for_report(uuid,uuid,text,uuid)', 'EXECUTE') THEN
        RAISE EXCEPTION 'SCENARIO 2 FAILED: anon has EXECUTE on create_spot_for_report!';
    END IF;

    IF has_function_privilege('anon', 'public.create_citizen_challenge(uuid,uuid,text,text,uuid)', 'EXECUTE') THEN
        RAISE EXCEPTION 'SCENARIO 2 FAILED: anon has EXECUTE on create_citizen_challenge!';
    END IF;

    IF has_function_privilege('public', 'public.create_citizen_challenge(uuid,uuid,text,text,uuid)', 'EXECUTE') THEN
        RAISE EXCEPTION 'SCENARIO 2 FAILED: PUBLIC has EXECUTE on create_citizen_challenge!';
    END IF;

    RAISE NOTICE 'SCENARIO 2 PASSED: Anonymous and PUBLIC roles denied EXECUTE on all mutation RPCs.';
END;
$$;

-- ============================================================================
-- SCENARIO 3: CITIZEN CHALLENGE ACTOR IMPERSONATION & AUTHORIZATION
-- ============================================================================
SET ROLE authenticated;
SET request.jwt.claim.role = 'authenticated';
SET request.jwt.claim.sub = 'a0000000-0000-0000-0000-000000000002'; -- Authority User

DO $$
BEGIN
    BEGIN
        -- Authority user attempting to submit citizen challenge directly
        PERFORM public.create_citizen_challenge(
            'c0000000-0000-0000-0000-000000000081',
            'f0000000-0000-0000-0000-000000000001',
            'still_not_fixed',
            'Unauthorized authority filing challenge'
        );
        RAISE EXCEPTION 'SCENARIO 3 FAILED: Non-superadmin authenticated user was allowed to invoke create_citizen_challenge!';
    EXCEPTION WHEN OTHERS THEN
        IF SQLERRM LIKE '%Forbidden: Citizen challenges must be submitted through verified service-role or administrative review%' THEN
            RAISE NOTICE 'SCENARIO 3 PASSED: Non-superadmin authenticated caller blocked from create_citizen_challenge.';
        ELSE
            RAISE EXCEPTION 'SCENARIO 3 FAILED: Unexpected error: %', SQLERRM;
        END IF;
    END;
END;
$$;

-- ============================================================================
-- SCENARIO 4: CITIZEN CHALLENGE RESTRICTED TO RESOLVED SPOTS
-- ============================================================================
SET ROLE authenticated;
SET request.jwt.claim.role = 'authenticated';
SET request.jwt.claim.sub = 'a0000000-0000-0000-0000-000000000001'; -- Super Admin

DO $$
BEGIN
    -- 1. Attempt challenge on IN_PROGRESS spot (Spot 82)
    BEGIN
        PERFORM public.create_citizen_challenge(
            'c0000000-0000-0000-0000-000000000082',
            'f0000000-0000-0000-0000-000000000001',
            'still_not_fixed',
            'Challenging IN_PROGRESS spot'
        );
        RAISE EXCEPTION 'SCENARIO 4 FAILED: Challenge on IN_PROGRESS spot was allowed!';
    EXCEPTION WHEN OTHERS THEN
        IF SQLERRM LIKE '%Illegal challenge: Citizen challenges can only be filed against RESOLVED spots%' THEN
            RAISE NOTICE 'SCENARIO 4A PASSED: Challenge against IN_PROGRESS spot rejected.';
        ELSE
            RAISE EXCEPTION 'SCENARIO 4A FAILED: Unexpected error: %', SQLERRM;
        END IF;
    END;

    -- 2. Attempt challenge on HANDED_OFF spot (Spot 83)
    BEGIN
        PERFORM public.create_citizen_challenge(
            'c0000000-0000-0000-0000-000000000083',
            'f0000000-0000-0000-0000-000000000001',
            'still_not_fixed',
            'Challenging HANDED_OFF spot'
        );
        RAISE EXCEPTION 'SCENARIO 4 FAILED: Challenge on HANDED_OFF spot was allowed!';
    EXCEPTION WHEN OTHERS THEN
        IF SQLERRM LIKE '%Illegal challenge: Citizen challenges can only be filed against RESOLVED spots%' THEN
            RAISE NOTICE 'SCENARIO 4B PASSED: Challenge against HANDED_OFF spot rejected.';
        ELSE
            RAISE EXCEPTION 'SCENARIO 4B FAILED: Unexpected error: %', SQLERRM;
        END IF;
    END;

    -- 3. Challenge on RESOLVED spot (Spot 81) succeeds
    PERFORM public.create_citizen_challenge(
        'c0000000-0000-0000-0000-000000000081',
        'f0000000-0000-0000-0000-000000000001',
        'still_not_fixed',
        'Valid challenge on resolved spot'
    );
    RAISE NOTICE 'SCENARIO 4C PASSED: Valid challenge on RESOLVED spot succeeded.';
END;
$$;

-- ============================================================================
-- SCENARIO 5: 24-HOUR RATE LIMITING & PARTIAL UNIQUE CONSTRAINT
-- ============================================================================
DO $$
BEGIN
    -- 1. Immediate duplicate challenge from same citizen on same spot rejected by function
    BEGIN
        PERFORM public.create_citizen_challenge(
            'c0000000-0000-0000-0000-000000000081',
            'f0000000-0000-0000-0000-000000000001',
            'still_not_fixed',
            'Second duplicate challenge within minutes'
        );
        RAISE EXCEPTION 'SCENARIO 5 FAILED: Duplicate challenge was allowed!';
    EXCEPTION WHEN OTHERS THEN
        IF SQLERRM LIKE '%Duplicate challenge: An active challenge from this citizen is already pending%' THEN
            RAISE NOTICE 'SCENARIO 5A PASSED: Duplicate active challenge blocked by 24h rate limit logic.';
        ELSE
            RAISE EXCEPTION 'SCENARIO 5A FAILED: Unexpected error: %', SQLERRM;
        END IF;
    END;

    -- 2. Verify partial unique index prevents concurrent/direct bypass
    BEGIN
        INSERT INTO public.citizen_challenges (
            spot_id, citizen_contact_id, challenge_type, status, note
        ) VALUES (
            'c0000000-0000-0000-0000-000000000081',
            'f0000000-0000-0000-0000-000000000001',
            'still_not_fixed', 'new', 'Direct bypass attempt'
        );
        RAISE EXCEPTION 'SCENARIO 5 FAILED: Partial unique index failed to block duplicate active challenge!';
    EXCEPTION WHEN OTHERS THEN
        IF SQLERRM LIKE '%idx_citizen_challenges_active_unique%' OR SQLERRM LIKE '%duplicate key value%' THEN
            RAISE NOTICE 'SCENARIO 5B PASSED: Partial unique index idx_citizen_challenges_active_unique blocks duplicate active challenges.';
        ELSE
            RAISE EXCEPTION 'SCENARIO 5B FAILED: Unexpected error: %', SQLERRM;
        END IF;
    END;

    -- 3. Challenge from a different citizen on the same spot succeeds
    PERFORM public.create_citizen_challenge(
        'c0000000-0000-0000-0000-000000000081',
        'f0000000-0000-0000-0000-000000000002',
        'still_not_fixed',
        'Second citizen independent challenge'
    );
    RAISE NOTICE 'SCENARIO 5C PASSED: Independent challenge from second citizen on same spot succeeds.';
END;
$$;

-- ============================================================================
-- SCENARIO 6: HANDED_OFF -> RESOLVED LIFECYCLE BYPASS ELIMINATED
-- ============================================================================
DO $$
BEGIN
    BEGIN
        PERFORM public.transition_spot_status(
            'c0000000-0000-0000-0000-000000000083',
            'RESOLVED',
            'super_admin',
            'a0000000-0000-0000-0000-000000000001',
            'Attempting direct bypass from HANDED_OFF to RESOLVED'
        );
        RAISE EXCEPTION 'SCENARIO 6 FAILED: Direct HANDED_OFF -> RESOLVED transition was allowed!';
    EXCEPTION WHEN OTHERS THEN
        IF SQLERRM LIKE '%Illegal status transition from HANDED_OFF to RESOLVED%' THEN
            RAISE NOTICE 'SCENARIO 6 PASSED: HANDED_OFF -> RESOLVED bypass cleanly rejected.';
        ELSE
            RAISE EXCEPTION 'SCENARIO 6 FAILED: Unexpected error: %', SQLERRM;
        END IF;
    END;
END;
$$;

-- ============================================================================
-- SCENARIO 7: IN_PROGRESS -> RESOLVED DIRECT TRANSITION ELIMINATED
-- ============================================================================
DO $$
BEGIN
    BEGIN
        PERFORM public.transition_spot_status(
            'c0000000-0000-0000-0000-000000000082',
            'RESOLVED',
            'super_admin',
            'a0000000-0000-0000-0000-000000000001',
            'Attempting direct transition from IN_PROGRESS to RESOLVED'
        );
        RAISE EXCEPTION 'SCENARIO 7 FAILED: Direct IN_PROGRESS -> RESOLVED transition was allowed!';
    EXCEPTION WHEN OTHERS THEN
        IF SQLERRM LIKE '%Illegal status transition from IN_PROGRESS to RESOLVED%' THEN
            RAISE NOTICE 'SCENARIO 7 PASSED: IN_PROGRESS -> RESOLVED direct transition cleanly rejected.';
        ELSE
            RAISE EXCEPTION 'SCENARIO 7 FAILED: Unexpected error: %', SQLERRM;
        END IF;
    END;
END;
$$;

-- ============================================================================
-- SCENARIO 8: DATABASE TRIGGER INVARIANT ENFORCEMENT ON RESOLVED STATE
-- ============================================================================
SET ROLE authenticated;
SET request.jwt.claim.role = 'authenticated';
SET request.jwt.claim.sub = 'a0000000-0000-0000-0000-000000000001'; -- Super Admin

DO $$
BEGIN
    -- 1. Direct update from IN_PROGRESS blocked
    BEGIN
        UPDATE public.spots SET status = 'RESOLVED' WHERE id = 'c0000000-0000-0000-0000-000000000082';
        RAISE EXCEPTION 'SCENARIO 8A FAILED: Direct SQL update IN_PROGRESS -> RESOLVED was allowed!';
    EXCEPTION WHEN OTHERS THEN
        IF SQLERRM LIKE '%can only be transitioned to RESOLVED from RESOLUTION_SUBMITTED state%' THEN
            RAISE NOTICE 'SCENARIO 8A PASSED: Trigger blocks direct SQL transition to RESOLVED from IN_PROGRESS.';
        ELSE
            RAISE EXCEPTION 'SCENARIO 8A FAILED: Unexpected error: %', SQLERRM;
        END IF;
    END;

    -- 2. Direct update from HANDED_OFF blocked
    BEGIN
        UPDATE public.spots SET status = 'RESOLVED' WHERE id = 'c0000000-0000-0000-0000-000000000083';
        RAISE EXCEPTION 'SCENARIO 8B FAILED: Direct SQL update HANDED_OFF -> RESOLVED was allowed!';
    EXCEPTION WHEN OTHERS THEN
        IF SQLERRM LIKE '%can only be transitioned to RESOLVED from RESOLUTION_SUBMITTED state%' THEN
            RAISE NOTICE 'SCENARIO 8B PASSED: Trigger blocks direct SQL transition to RESOLVED from HANDED_OFF.';
        ELSE
            RAISE EXCEPTION 'SCENARIO 8B FAILED: Unexpected error: %', SQLERRM;
        END IF;
    END;

    -- 3. Direct transition from RESOLUTION_SUBMITTED without approved submission blocked
    -- Set status to RESOLUTION_SUBMITTED first
    UPDATE public.spots SET status = 'RESOLUTION_SUBMITTED' WHERE id = 'c0000000-0000-0000-0000-000000000082';

    BEGIN
        UPDATE public.spots SET status = 'RESOLVED' WHERE id = 'c0000000-0000-0000-0000-000000000082';
        RAISE EXCEPTION 'SCENARIO 8C FAILED: Transition to RESOLVED without approved resolution submission allowed!';
    EXCEPTION WHEN OTHERS THEN
        IF SQLERRM LIKE '%lacks an approved resolution submission with verified after-repair photo evidence%' THEN
            RAISE NOTICE 'SCENARIO 8C PASSED: Trigger blocks transition to RESOLVED without approved resolution submission.';
        ELSE
            RAISE EXCEPTION 'SCENARIO 8C FAILED: Unexpected error: %', SQLERRM;
        END IF;
    END;

    -- Reset Spot 82 to IN_PROGRESS
    UPDATE public.spots SET status = 'IN_PROGRESS' WHERE id = 'c0000000-0000-0000-0000-000000000082';
END;
$$;

-- ============================================================================
-- SCENARIO 9: LEGITIMATE RESOLUTION PATH VERIFICATION
-- ============================================================================
SET ROLE authenticated;
SET request.jwt.claim.role = 'authenticated';
SET request.jwt.claim.sub = 'a0000000-0000-0000-0000-000000000002'; -- Authority User

DO $$
DECLARE
    v_sub_id uuid;
BEGIN
    -- Authority submits resolution request
    v_sub_id := public.submit_resolution_request(
        'c0000000-0000-0000-0000-000000000082',
        'a0000000-0000-0000-0000-000000000002',
        'Repaired pipe and sealed ground properly.',
        'e1000000-0000-0000-0000-000000000082'
    );

    IF v_sub_id IS NULL THEN
        RAISE EXCEPTION 'SCENARIO 9 FAILED: submit_resolution_request returned null!';
    END IF;
END;
$$;

SET ROLE authenticated;
SET request.jwt.claim.role = 'authenticated';
SET request.jwt.claim.sub = 'a0000000-0000-0000-0000-000000000001'; -- Super Admin

DO $$
DECLARE
    v_sub_id uuid;
    v_spot record;
BEGIN
    SELECT id INTO v_sub_id FROM public.resolution_submissions
    WHERE spot_id = 'c0000000-0000-0000-0000-000000000082' AND review_status = 'pending';

    -- Super Admin reviews and approves
    PERFORM public.review_resolution_request(
        v_sub_id,
        'a0000000-0000-0000-0000-000000000001',
        'approved',
        'Approved by super admin after verifying high quality after-photo.'
    );

    SELECT * INTO v_spot FROM public.spots WHERE id = 'c0000000-0000-0000-0000-000000000082';
    IF v_spot.status != 'RESOLVED' OR v_spot.resolved_at IS NULL THEN
        RAISE EXCEPTION 'SCENARIO 9 FAILED: Spot status was not transitioned to RESOLVED!';
    END IF;

    RAISE NOTICE 'SCENARIO 9 PASSED: Legitimate authority resolution submission and super-admin review successfully transitions spot to RESOLVED.';
END;
$$;

-- ============================================================================
-- SCENARIO 10: 25-50M GRID COORDINATE DISCRETIZATION IN PUBLIC PROJECTIONS
-- ============================================================================
RESET ROLE;
SET ROLE anon;
SET request.jwt.claim.role = 'anon';

DO $$
DECLARE
    v_rec record;
    v_expected_lat numeric;
    v_expected_lon numeric;
BEGIN
    -- Query Spot 81 in public_spots
    SELECT * INTO v_rec FROM public.public_spots WHERE spot_code = 'SPT-KHR-000981';
    IF NOT FOUND THEN
        RAISE EXCEPTION 'SCENARIO 10 FAILED: Spot 81 not found in public_spots!';
    END IF;

    -- Formula: round(round(19.0475100 / 0.0003) * 0.0003, 4) = 19.0470
    -- Formula: round(round(73.0699400 / 0.0003) * 0.0003, 4) = 73.0692
    v_expected_lat := round(round(19.0475100 / 0.0003) * 0.0003, 4);
    v_expected_lon := round(round(73.0699400 / 0.0003) * 0.0003, 4);

    IF v_rec.public_latitude != v_expected_lat OR v_rec.public_longitude != v_expected_lon THEN
        RAISE EXCEPTION 'SCENARIO 10 FAILED: Coordinates not discretized to 0.0003 grid! Got (%, %), expected (%, %)',
            v_rec.public_latitude, v_rec.public_longitude, v_expected_lat, v_expected_lon;
    END IF;

    RAISE NOTICE 'SCENARIO 10 PASSED: Public projection accurately applies 25-50m grid discretization (% lat, % lon).',
        v_rec.public_latitude, v_rec.public_longitude;
END;
$$;

-- ============================================================================
-- SCENARIO 11: SEARCH PATH HARDENING VERIFICATION
-- ============================================================================
RESET ROLE;

DO $$
DECLARE
    v_func record;
    v_bad_count int := 0;
BEGIN
    FOR v_func IN
        SELECT proname, proconfig
        FROM pg_proc
        JOIN pg_namespace ON pg_namespace.oid = pg_proc.pronamespace
        WHERE nspname = 'public'
          AND proname IN (
              'create_citizen_challenge',
              'transition_spot_status',
              'submit_resolution_request',
              'review_resolution_request',
              'create_spot_for_report',
              'link_report_to_spot',
              'find_duplicate_candidates',
              'record_authority_handoff'
          )
    LOOP
        IF v_func.proconfig IS NULL OR NOT (v_func.proconfig::text LIKE '%search_path=pg_catalog, public, auth, pg_temp%') THEN
            RAISE WARNING 'Function % has non-hardened search_path: %', v_func.proname, v_func.proconfig;
            v_bad_count := v_bad_count + 1;
        END IF;
    END LOOP;

    IF v_bad_count > 0 THEN
        RAISE EXCEPTION 'SCENARIO 11 FAILED: % public workflow functions have non-hardened search_path!', v_bad_count;
    END IF;

    RAISE NOTICE 'SCENARIO 11 PASSED: All public workflow functions have explicitly pinned search_path.';
END;
$$;

-- ============================================================================
-- SCENARIO 12: RESOLUTION APPROVAL PROVENANCE & EVIDENCE HARDENING ADVERSARIAL TESTS
-- Authority: TRD Section 6.4, 9.3, 11 & Phase 4D Final Security Remediation
-- ============================================================================
RESET ROLE;
SET search_path = public, auth;
SET request.jwt.claim.role = 'service_role';

DO $$
DECLARE
    v_test_spot_id uuid := 'c0000000-0000-0000-0000-000000000099';
    v_sub_id uuid;
    v_invalid_ev_id uuid := 'e1000000-0000-0000-0000-000000000091';
    v_valid_ev_id uuid := 'e1000000-0000-0000-0000-000000000092';
    v_super_admin_id uuid := 'a0000000-0000-0000-0000-000000000001';
    v_authority_a_id uuid := 'a0000000-0000-0000-0000-000000000002';
    v_org_a_id uuid := 'b0000000-0000-0000-0000-000000000001';
    v_spot record;
BEGIN
    -- Create test spot in RESOLUTION_SUBMITTED status
    INSERT INTO public.spots (
        id, spot_code, pilot_id, group_id, category_id, issue_type_id,
        canonical_latitude, canonical_longitude, anchor_accuracy_m, status,
        assigned_organisation_id, public_approved, is_demo
    ) VALUES (
        v_test_spot_id, 'SPT-KHR-000099', 'kharghar_itm_v1',
        'utilities_lighting_greenery', 'water_supply_public_taps', 'water_pipeline_leakage',
        19.0475100, 73.0699400, 4.0, 'RESOLUTION_SUBMITTED',
        v_org_a_id, true, false
    ) ON CONFLICT (id) DO UPDATE SET status = 'RESOLUTION_SUBMITTED';

    -- Create invalid evidence (evidence_stage = 'other', mime_type = 'text/plain')
    INSERT INTO public.evidence (
        id, spot_id, evidence_stage, storage_path_private, file_size_bytes, mime_type, sha256
    ) VALUES (
        v_invalid_ev_id, v_test_spot_id, 'other', 'evidence-private/spots/test_doc.txt',
        1024, 'text/plain', '9191919191919191919191919191919191919191919191919191919191919191'
    ) ON CONFLICT (id) DO NOTHING;

    -- Create valid after-photo evidence (evidence_stage = 'authority_after', mime_type = 'image/jpeg')
    INSERT INTO public.evidence (
        id, spot_id, evidence_stage, storage_path_private, file_size_bytes, mime_type, sha256
    ) VALUES (
        v_valid_ev_id, v_test_spot_id, 'authority_after', 'evidence-private/spots/valid_after.jpg',
        1048576, 'image/jpeg', '9292929292929292929292929292929292929292929292929292929292929292'
    ) ON CONFLICT (id) DO NOTHING;

    -- Sub-scenario 12A: Attempt to directly insert pre-approved submission with invalid (non-after-photo) evidence
    BEGIN
        INSERT INTO public.resolution_submissions (
            spot_id, submitted_by, completion_note, after_photo_evidence_id, review_status,
            reviewed_by, reviewed_at
        ) VALUES (
            v_test_spot_id, v_authority_a_id, 'Adversarial submission', v_invalid_ev_id, 'approved',
            v_super_admin_id, now()
        );
        RAISE EXCEPTION 'SCENARIO 12A FAILED: Direct insert with non-after-photo evidence should have been blocked!';
    EXCEPTION WHEN OTHERS THEN
        IF SQLERRM NOT LIKE '%must have evidence_stage authority_after%' THEN
            RAISE EXCEPTION 'SCENARIO 12A FAILED: Unexpected error message: %', SQLERRM;
        END IF;
        RAISE NOTICE 'SCENARIO 12A PASSED: Direct insert with invalid evidence stage rejected by guard_resolution_submission.';
    END;

    -- Sub-scenario 12B: Attempt to directly insert pre-approved submission without super-admin reviewer provenance
    BEGIN
        INSERT INTO public.resolution_submissions (
            spot_id, submitted_by, completion_note, after_photo_evidence_id, review_status,
            reviewed_by, reviewed_at
        ) VALUES (
            v_test_spot_id, v_authority_a_id, 'Adversarial submission', v_valid_ev_id, 'approved',
            v_authority_a_id, now()
        );
        RAISE EXCEPTION 'SCENARIO 12B FAILED: Direct insert with non-admin reviewer should have been blocked!';
    EXCEPTION WHEN OTHERS THEN
        IF SQLERRM NOT LIKE '%is not an active super administrator%' THEN
            RAISE EXCEPTION 'SCENARIO 12B FAILED: Unexpected error message: %', SQLERRM;
        END IF;
        RAISE NOTICE 'SCENARIO 12B PASSED: Direct insert with non-admin reviewer provenance rejected.';
    END;

    -- Sub-scenario 12C: Create legitimate pending submission, then attempt direct SQL UPDATE of review_status to approved
    INSERT INTO public.resolution_submissions (
        spot_id, submitted_by, completion_note, after_photo_evidence_id, review_status
    ) VALUES (
        v_test_spot_id, v_authority_a_id, 'Pending repair submission', v_valid_ev_id, 'pending'
    ) RETURNING id INTO v_sub_id;

    BEGIN
        UPDATE public.resolution_submissions
        SET review_status = 'approved', reviewed_by = v_super_admin_id, reviewed_at = now()
        WHERE id = v_sub_id;
        RAISE EXCEPTION 'SCENARIO 12C FAILED: Direct UPDATE of review_status should have been blocked!';
    EXCEPTION WHEN OTHERS THEN
        IF SQLERRM NOT LIKE '%Direct modification of review_status forbidden%' THEN
            RAISE EXCEPTION 'SCENARIO 12C FAILED: Unexpected error message: %', SQLERRM;
        END IF;
        RAISE NOTICE 'SCENARIO 12C PASSED: Direct SQL mutation of review_status bypassing review_resolution_request rejected.';
    END;

    -- Sub-scenario 12D: Attempt direct UPDATE of spot to RESOLVED while submission is pending
    BEGIN
        UPDATE public.spots SET status = 'RESOLVED', resolved_at = now() WHERE id = v_test_spot_id;
        RAISE EXCEPTION 'SCENARIO 12D FAILED: Direct spot resolution with pending submission should have been blocked!';
    EXCEPTION WHEN OTHERS THEN
        IF SQLERRM NOT LIKE '%lacks an approved resolution submission%' THEN
            RAISE EXCEPTION 'SCENARIO 12D FAILED: Unexpected error message: %', SQLERRM;
        END IF;
        RAISE NOTICE 'SCENARIO 12D PASSED: Direct spot transition to RESOLVED without approved submission rejected by guard_spot_resolution.';
    END;

    -- Sub-scenario 12E: Legitimate review_resolution_request execution succeeds and sets RESOLVED
    PERFORM public.review_resolution_request(
        v_sub_id,
        v_super_admin_id,
        'approved',
        'Super admin verified after-photo repair evidence'
    );

    SELECT * INTO v_spot FROM public.spots WHERE id = v_test_spot_id;
    IF v_spot.status != 'RESOLVED' OR v_spot.resolved_at IS NULL THEN
        RAISE EXCEPTION 'SCENARIO 12E FAILED: Spot status was not transitioned to RESOLVED by legitimate workflow!';
    END IF;
    RAISE NOTICE 'SCENARIO 12E PASSED: Legitimate review_resolution_request successfully transitioned spot to RESOLVED.';

    -- Sub-scenario 12F: Attempt to tamper with submission after it has been reviewed
    BEGIN
        UPDATE public.resolution_submissions
        SET completion_note = 'Tampered after approval'
        WHERE id = v_sub_id;
        RAISE EXCEPTION 'SCENARIO 12F FAILED: Mutating already reviewed submission should have been blocked!';
    EXCEPTION WHEN OTHERS THEN
        IF SQLERRM NOT LIKE '%Cannot modify resolution submission%' THEN
            RAISE EXCEPTION 'SCENARIO 12F FAILED: Unexpected error message: %', SQLERRM;
        END IF;
        RAISE NOTICE 'SCENARIO 12F PASSED: Tampering with reviewed resolution submission rejected by immutability guard.';
    END;

END;
$$;

RESET ROLE;

DO $$
BEGIN
    RAISE NOTICE '=======================================================';
    RAISE NOTICE 'ALL 12 PHASE 4D REMEDIATION SCENARIOS VERIFIED SUCCESSFULLY!';
    RAISE NOTICE '=======================================================';
END;
$$;
