-- NAGRIK PHASE 4C: RPC IDENTITY HARDENING & SECURITY TESTS
-- Authority: TRD Section 6.4, 9.3, 14.3 & Phase 4C Security Remediation
-- Database: Supabase PostgreSQL (15+)

SET search_path = public, auth;

-- ============================================================================
-- INITIALIZE TEST FIXTURES FOR PHASE 4C
-- ============================================================================
DO $$
DECLARE
    v_org_a_id uuid := 'b0000000-0000-0000-0000-000000000001'; -- Water Dept
    v_org_b_id uuid := 'b0000000-0000-0000-0000-000000000002'; -- Roads Dept
    v_contact_id uuid := 'f0000000-0000-0000-0000-000000000001';
BEGIN
    RAISE NOTICE '=======================================================';
    RAISE NOTICE 'INITIALIZING PHASE 4C ADVERSARIAL SECURITY FIXTURES';
    RAISE NOTICE '=======================================================';

    -- Test Spot 1: Assigned to Org A (Water Dept), currently IN_PROGRESS
    INSERT INTO public.spots (
        id, spot_code, pilot_id, group_id, category_id, issue_type_id,
        canonical_latitude, canonical_longitude, anchor_accuracy_m, status,
        assigned_organisation_id, public_approved, is_demo
    ) VALUES (
        'c0000000-0000-0000-0000-000000000041', 'SPT-KHR-000941', 'kharghar_itm_v1',
        'utilities_lighting_greenery', 'water_supply_public_taps', 'water_pipeline_leakage',
        19.0475100, 73.0699400, 4.0, 'IN_PROGRESS',
        v_org_a_id, false, false
    ) ON CONFLICT (id) DO UPDATE SET status = 'IN_PROGRESS';

    -- Test Evidence for Spot 1: Authority after-photo in private storage
    INSERT INTO public.evidence (
        id, spot_id, evidence_stage, storage_path_private, file_size_bytes, mime_type,
        sha256
    ) VALUES (
        'e1000000-0000-0000-0000-000000000041', 'c0000000-0000-0000-0000-000000000041',
        'authority_after', 'evidence-private/spots/SPT-KHR-000941/after_repair.jpg',
        1048576, 'image/jpeg', '4141414141414141414141414141414141414141414141414141414141414141'
    ) ON CONFLICT (id) DO NOTHING;

    -- Test Spot 2: Assigned to Org A (Water Dept), currently ASSIGNED
    INSERT INTO public.spots (
        id, spot_code, pilot_id, group_id, category_id, issue_type_id,
        canonical_latitude, canonical_longitude, anchor_accuracy_m, status,
        assigned_organisation_id, public_approved, is_demo
    ) VALUES (
        'c0000000-0000-0000-0000-000000000042', 'SPT-KHR-000942', 'kharghar_itm_v1',
        'utilities_lighting_greenery', 'water_supply_public_taps', 'water_pipeline_leakage',
        19.0475200, 73.0699500, 4.0, 'ASSIGNED',
        v_org_a_id, false, false
    ) ON CONFLICT (id) DO UPDATE SET status = 'ASSIGNED';

    -- Test Report for Concurrency Lock Testing
    INSERT INTO public.reports (
        id, ticket_code, citizen_contact_id, pilot_id, group_id, category_id, issue_type_id,
        description_private, latitude, longitude, horizontal_accuracy_m, location_source,
        location_review_status, review_status, is_demo
    ) VALUES (
        'e0000000-0000-0000-0000-000000000041', 'NAG-KHR-2026-000041', v_contact_id,
        'kharghar_itm_v1', 'utilities_lighting_greenery', 'water_supply_public_taps', 'water_pipeline_leakage',
        'Burst water pipeline leaking near main entrance.', 19.0475100, 73.0699400, 4.5,
        'telegram_location', 'confirmed', 'verified', false
    ) ON CONFLICT (id) DO UPDATE SET spot_id = null;

    RAISE NOTICE 'PHASE 4C FIXTURES INITIALIZED.';
END;
$$;

-- ============================================================================
-- SCENARIO 1: Authenticated Authority A attempts to spoof Authority B in transition_spot_status
-- ============================================================================
SET ROLE authenticated;
SET request.jwt.claim.role = 'authenticated';
SET request.jwt.claim.sub = 'a0000000-0000-0000-0000-000000000002'; -- Authority A (Water Dept)

DO $$
BEGIN
    BEGIN
        -- Authority A passes Authority B's actor ID ('a0...03')
        PERFORM public.transition_spot_status(
            'c0000000-0000-0000-0000-000000000042',
            'IN_PROGRESS',
            'authority_user',
            'a0000000-0000-0000-0000-000000000003', -- SPOOFED ID: Authority B
            'Attempted transition with spoofed actor ID'
        );
        RAISE EXCEPTION 'SCENARIO 1 FAILED: Actor identity spoofing was permitted!';
    EXCEPTION WHEN OTHERS THEN
        IF SQLERRM LIKE '%Forbidden: Actor user ID does not match authenticated identity%' THEN
            RAISE NOTICE 'SCENARIO 1 PASSED: Actor identity spoofing in transition_spot_status rejected.';
        ELSE
            RAISE EXCEPTION 'SCENARIO 1 FAILED: Unexpected error message: %', SQLERRM;
        END IF;
    END;
END;
$$;

-- ============================================================================
-- SCENARIO 2: Authenticated Authority A attempts to spoof Authority B in submit_resolution_request
-- ============================================================================
SET ROLE authenticated;
SET request.jwt.claim.role = 'authenticated';
SET request.jwt.claim.sub = 'a0000000-0000-0000-0000-000000000002'; -- Authority A

DO $$
BEGIN
    BEGIN
        -- Authority A passes Authority B's ID ('a0...03')
        PERFORM public.submit_resolution_request(
            'c0000000-0000-0000-0000-000000000041',
            'a0000000-0000-0000-0000-000000000003', -- SPOOFED ID
            'Repair completed',
            'e1000000-0000-0000-0000-000000000041'
        );
        RAISE EXCEPTION 'SCENARIO 2 FAILED: Resolution submission with spoofed submitter ID was permitted!';
    EXCEPTION WHEN OTHERS THEN
        IF SQLERRM LIKE '%Forbidden: Submitter user ID does not match authenticated identity%' THEN
            RAISE NOTICE 'SCENARIO 2 PASSED: Submitter identity spoofing in submit_resolution_request rejected.';
        ELSE
            RAISE EXCEPTION 'SCENARIO 2 FAILED: Unexpected error message: %', SQLERRM;
        END IF;
    END;
END;
$$;

-- ============================================================================
-- SCENARIO 3: Authenticated non-admin attempts to supply Super-Admin actor ID
-- ============================================================================
SET ROLE authenticated;
SET request.jwt.claim.role = 'authenticated';
SET request.jwt.claim.sub = 'a0000000-0000-0000-0000-000000000002'; -- Authority A (Non-admin)

DO $$
BEGIN
    BEGIN
        -- Authority A claims to be super_admin and passes Super-Admin's UUID
        PERFORM public.transition_spot_status(
            'c0000000-0000-0000-0000-000000000041',
            'RESOLVED',
            'super_admin',
            'a0000000-0000-0000-0000-000000000001', -- SPOOFED ID: Super-Admin
            'Spoofed super admin resolution attempt'
        );
        RAISE EXCEPTION 'SCENARIO 3 FAILED: Non-admin was able to supply Super-Admin ID and resolve issue!';
    EXCEPTION WHEN OTHERS THEN
        IF SQLERRM LIKE '%Forbidden: Actor user ID does not match authenticated identity%' THEN
            RAISE NOTICE 'SCENARIO 3 PASSED: Non-admin supply of Super-Admin ID rejected by identity check.';
        ELSE
            RAISE EXCEPTION 'SCENARIO 3 FAILED: Unexpected error message: %', SQLERRM;
        END IF;
    END;
END;
$$;

-- ============================================================================
-- SCENARIO 4: Authenticated user supplies different org member's ID in create_spot_for_report
-- ============================================================================
SET ROLE authenticated;
SET request.jwt.claim.role = 'authenticated';
SET request.jwt.claim.sub = 'a0000000-0000-0000-0000-000000000002'; -- Authority A

DO $$
BEGIN
    BEGIN
        PERFORM public.create_spot_for_report(
            'e0000000-0000-0000-0000-000000000041',
            'a0000000-0000-0000-0000-000000000001' -- Super Admin ID
        );
        RAISE EXCEPTION 'SCENARIO 4 FAILED: Non-admin created spot!';
    EXCEPTION WHEN OTHERS THEN
        IF SQLERRM LIKE '%Unauthorized: Only super administrators can create spots%' THEN
            RAISE NOTICE 'SCENARIO 4 PASSED: Non-admin spot creation rejected.';
        ELSE
            RAISE EXCEPTION 'SCENARIO 4 FAILED: Unexpected error message: %', SQLERRM;
        END IF;
    END;
END;
$$;

-- ============================================================================
-- SCENARIO 5: Unauthenticated caller attempts RPC operations directly
-- ============================================================================
SET ROLE anon;
RESET request.jwt.claim.sub;
RESET request.jwt.claim.role;

DO $$
BEGIN
    BEGIN
        PERFORM public.transition_spot_status(
            'c0000000-0000-0000-0000-000000000042',
            'IN_PROGRESS',
            'authority_user',
            'a0000000-0000-0000-0000-000000000002',
            'Anonymous transition'
        );
        RAISE EXCEPTION 'SCENARIO 5 FAILED: Anonymous user executed transition_spot_status!';
    EXCEPTION WHEN OTHERS THEN
        IF SQLERRM LIKE '%permission denied%' OR SQLERRM LIKE '%Authentication required%' THEN
            RAISE NOTICE 'SCENARIO 5 PASSED: Unauthenticated RPC execution denied.';
        ELSE
            RAISE EXCEPTION 'SCENARIO 5 FAILED: Unexpected error: %', SQLERRM;
        END IF;
    END;
END;
$$;

-- ============================================================================
-- SCENARIO 6: Legitimate authenticated actor performs an authorised operation
-- ============================================================================
SET ROLE authenticated;
SET request.jwt.claim.role = 'authenticated';
SET request.jwt.claim.sub = 'a0000000-0000-0000-0000-000000000002'; -- Authority A

DO $$
DECLARE
    v_status text;
BEGIN
    -- Authority A transitions Spot 2 (assigned to Water Dept) from ASSIGNED to IN_PROGRESS
    PERFORM public.transition_spot_status(
        'c0000000-0000-0000-0000-000000000042',
        'IN_PROGRESS',
        'authority_user',
        'a0000000-0000-0000-0000-000000000002', -- Matching legitimate identity
        'Work started by Water Dept team'
    );

    select status into v_status from public.spots where id = 'c0000000-0000-0000-0000-000000000042';
    if v_status != 'IN_PROGRESS' then
        raise exception 'SCENARIO 6 FAILED: Status not updated to IN_PROGRESS';
    end if;

    RAISE NOTICE 'SCENARIO 6 PASSED: Legitimate authenticated actor executed authorised operation.';
END;
$$;

-- ============================================================================
-- SCENARIO 7: Legitimate trusted service-role operation follows backend trust boundary
-- ============================================================================
SET ROLE postgres;
SET request.jwt.claim.role = 'service_role';
SET request.jwt.claim.sub = 'a0000000-0000-0000-0000-000000000001';

DO $$
DECLARE
    v_audit_actor uuid;
BEGIN
    -- Service role executes transition on behalf of Super-Admin for automated workflow
    PERFORM public.transition_spot_status(
        'c0000000-0000-0000-0000-000000000042',
        'HANDED_OFF',
        'super_admin',
        'a0000000-0000-0000-0000-000000000001',
        'Handoff recorded by automated service worker'
    );

    -- Check audit log attribution
    select actor_user_id into v_audit_actor
    from public.audit_logs
    where entity_id = 'c0000000-0000-0000-0000-000000000042'
    order by created_at desc
    limit 1;

    if v_audit_actor != 'a0000000-0000-0000-0000-000000000001' then
        raise exception 'SCENARIO 7 FAILED: Audit attribution incorrect';
    end if;

    RAISE NOTICE 'SCENARIO 7 PASSED: Trusted service-role boundary executed with correct audit attribution.';
END;
$$;

RESET ROLE;
RESET request.jwt.claim.sub;
RESET request.jwt.claim.role;
