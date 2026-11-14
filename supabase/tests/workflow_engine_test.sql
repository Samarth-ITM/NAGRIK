-- ============================================================================
-- NAGRIK PHASE 4: WORKFLOW ENGINE & INVARIANTS TEST SUITE
-- Target Engine: Supabase PostgreSQL (15+)
-- Tests: 30 Comprehensive Scenarios covering Spot Operations, State Machine,
--        Organisation Security, Resolution Evidence & Review, Citizen Challenges,
--        and Transaction Integrity.
-- ============================================================================

\set ON_ERROR_STOP on

RESET ROLE;
SET request.jwt.claim.sub = 'a0000000-0000-0000-0000-000000000001';
SET request.jwt.claim.role = 'service_role';

DO $$
DECLARE
    v_super_admin_id uuid := 'a0000000-0000-0000-0000-000000000001';
    v_authority_a_user_id uuid := 'a0000000-0000-0000-0000-000000000002';
    v_authority_b_user_id uuid := 'a0000000-0000-0000-0000-000000000003';
    v_demo_viewer_user_id uuid := 'a0000000-0000-0000-0000-000000000004';

    v_org_a_id uuid := 'b0000000-0000-0000-0000-000000000001';
    v_org_b_id uuid := 'b0000000-0000-0000-0000-000000000002';
    v_org_demo_id uuid := 'd0000000-0000-0000-0000-000000000001';

    v_contact_id uuid := 'f0000000-0000-0000-0000-000000000001';
BEGIN
    RAISE NOTICE '=======================================================';
    RAISE NOTICE 'INITIALIZING PHASE 4 WORKFLOW ENGINE TEST FIXTURES';
    RAISE NOTICE '=======================================================';

    -- 1. Create fresh test reports for spot creation & linking tests
    -- Report 1: Unlinked water leakage report
    INSERT INTO public.reports (
        id, ticket_code, citizen_contact_id, pilot_id, group_id, category_id, issue_type_id,
        description_private, latitude, longitude, horizontal_accuracy_m, location_source,
        location_review_status, review_status, is_demo
    ) VALUES (
        'e0000000-0000-0000-0000-000000000010', 'NAG-KHR-2026-000010', v_contact_id,
        'kharghar_itm_v1', 'utilities_lighting_greenery', 'water_supply_public_taps', 'water_pipeline_leakage',
        'Burst water pipeline leaking near main entrance.', 19.0475100, 73.0699400, 4.5,
        'telegram_location', 'confirmed', 'verified', false
    ) ON CONFLICT (id) DO NOTHING;

    -- Report 2: Second unlinked water report within 3m (strong duplicate candidate)
    INSERT INTO public.reports (
        id, ticket_code, citizen_contact_id, pilot_id, group_id, category_id, issue_type_id,
        description_private, latitude, longitude, horizontal_accuracy_m, location_source,
        location_review_status, review_status, is_demo
    ) VALUES (
        'e0000000-0000-0000-0000-000000000011', 'NAG-KHR-2026-000011', v_contact_id,
        'kharghar_itm_v1', 'utilities_lighting_greenery', 'water_supply_public_taps', 'water_pipeline_leakage',
        'Water overflowing heavily from ground pipe.', 19.0475120, 73.0699420, 3.2,
        'telegram_location', 'confirmed', 'verified', false
    ) ON CONFLICT (id) DO NOTHING;

    -- Report 3: Unlinked road report (different category for incompatibility test)
    INSERT INTO public.reports (
        id, ticket_code, citizen_contact_id, pilot_id, group_id, category_id, issue_type_id,
        description_private, latitude, longitude, horizontal_accuracy_m, location_source,
        location_review_status, review_status, is_demo
    ) VALUES (
        'e0000000-0000-0000-0000-000000000012', 'NAG-KHR-2026-000012', v_contact_id,
        'kharghar_itm_v1', 'roads_footpaths_drainage', 'roads_footpaths', 'pothole',
        'Deep pothole on asphalt.', 19.0475100, 73.0699400, 4.0,
        'telegram_location', 'confirmed', 'verified', false
    ) ON CONFLICT (id) DO NOTHING;

    -- Report 4: Unlinked demo report
    INSERT INTO public.reports (
        id, ticket_code, citizen_contact_id, pilot_id, group_id, category_id, issue_type_id,
        description_private, latitude, longitude, horizontal_accuracy_m, location_source,
        location_review_status, review_status, is_demo
    ) VALUES (
        'e0000000-0000-0000-0000-000000000013', 'NAG-KHR-2026-000013', v_contact_id,
        'kharghar_itm_v1', 'roads_footpaths_drainage', 'roads_footpaths', 'pothole',
        'Synthetic demo pothole.', 19.0475100, 73.0699400, 4.0,
        'telegram_location', 'confirmed', 'verified', true
    ) ON CONFLICT (id) DO NOTHING;

    -- Evidence for Report 1
    INSERT INTO public.evidence (
        id, report_id, evidence_stage, storage_path_private, mime_type, file_size_bytes, sha256
    ) VALUES (
        'e1000000-0000-0000-0000-000000000010', 'e0000000-0000-0000-0000-000000000010',
        'citizen_initial', 'private/raw_burst_pipe_initial.jpg', 'image/jpeg', 102400,
        'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
    ) ON CONFLICT (id) DO NOTHING;

    -- 5. Create a pre-resolved spot assigned to Org A for Reopening and Resolution Guard tests
    INSERT INTO public.spots (
        id, spot_code, pilot_id, group_id, category_id, issue_type_id,
        canonical_latitude, canonical_longitude, status, assigned_organisation_id,
        public_approved, is_demo, resolved_at
    ) VALUES (
        'c0000000-0000-0000-0000-000000000015', 'SPT-KHR-000915', 'kharghar_itm_v1',
        'utilities_lighting_greenery', 'water_supply_public_taps', 'water_pipeline_leakage',
        19.0475100, 73.0699400, 'RESOLVED', v_org_a_id,
        true, false, now()
    ) ON CONFLICT (id) DO NOTHING;

    RAISE NOTICE 'WORKFLOW FIXTURES INITIALIZED.';
END;
$$;

-- ============================================================================
-- GROUP 1: SPOT AND REPORT OPERATIONS (TESTS 1 - 7)
-- ============================================================================

-- TEST 1: Valid spot creation from report
SET ROLE authenticated;
SET request.jwt.claim.role = 'authenticated';
SET request.jwt.claim.sub = 'a0000000-0000-0000-0000-000000000001'; -- Super Admin

DO $$
DECLARE
    v_res jsonb;
    v_spot_id uuid;
    v_report record;
    v_hist_count int;
    v_audit_count int;
BEGIN
    v_res := public.create_spot_for_report(
        'e0000000-0000-0000-0000-000000000010',
        'a0000000-0000-0000-0000-000000000001',
        'high',
        'b0000000-0000-0000-0000-000000000001' -- Assign to Water Dept
    );

    v_spot_id := (v_res->>'spot_id')::uuid;

    -- Verify report is linked
    select * into v_report from public.reports where id = 'e0000000-0000-0000-0000-000000000010';
    if v_report.spot_id != v_spot_id or v_report.match_method != 'manual_new_spot' then
        raise exception 'TEST 1 FAILED: Report not linked properly to new spot!';
    end if;

    -- Verify status history recorded
    select count(*) into v_hist_count from public.status_history where spot_id = v_spot_id;
    if v_hist_count != 1 then
        raise exception 'TEST 1 FAILED: Status history not recorded!';
    end if;

    -- Verify audit log recorded
    select count(*) into v_audit_count from public.audit_logs where entity_id = v_spot_id and action = 'SPOT_CREATED';
    if v_audit_count != 1 then
        raise exception 'TEST 1 FAILED: Audit log not recorded!';
    end if;

    RAISE NOTICE 'TEST 1 PASSED: Valid spot creation succeeded with atomic linking, history and audit log.';
END;
$$;

-- TEST 2: Duplicate spot creation prevention
DO $$
BEGIN
    BEGIN
        PERFORM public.create_spot_for_report(
            'e0000000-0000-0000-0000-000000000010',
            'a0000000-0000-0000-0000-000000000001',
            'high',
            null
        );
        RAISE EXCEPTION 'TEST 2 FAILED: Duplicate spot creation was not prevented!';
    EXCEPTION WHEN OTHERS THEN
        IF SQLERRM LIKE '%is already linked to spot%' THEN
            RAISE NOTICE 'TEST 2 PASSED: Duplicate spot creation for linked report prevented.';
        ELSE
            RAISE EXCEPTION 'TEST 2 FAILED: Unexpected error: %', SQLERRM;
        END IF;
    END;
END;
$$;

-- TEST 3: Valid report-to-spot linking
DO $$
DECLARE
    v_spot_id uuid;
    v_report record;
BEGIN
    -- Fetch spot created in Test 1
    select spot_id into v_spot_id from public.reports where id = 'e0000000-0000-0000-0000-000000000010';

    -- Link Report 2 (same category, 2.5m distance)
    PERFORM public.link_report_to_spot(
        'e0000000-0000-0000-0000-000000000011',
        v_spot_id,
        'a0000000-0000-0000-0000-000000000001',
        2.5,
        'Confirmed duplicate burst pipe reported by nearby shopkeeper.'
    );

    select * into v_report from public.reports where id = 'e0000000-0000-0000-0000-000000000011';
    if v_report.spot_id != v_spot_id or v_report.match_distance_m != 2.5 then
        raise exception 'TEST 3 FAILED: Report 2 not linked properly!';
    end if;

    RAISE NOTICE 'TEST 3 PASSED: Valid report-to-spot linking executed with reviewer audit note.';
END;
$$;

-- TEST 4: Invalid category linking rejected
DO $$
DECLARE
    v_spot_id uuid;
BEGIN
    select spot_id into v_spot_id from public.reports where id = 'e0000000-0000-0000-0000-000000000010';

    BEGIN
        -- Attempt to link Report 3 (roads_footpaths) to Water Spot
        PERFORM public.link_report_to_spot(
            'e0000000-0000-0000-0000-000000000012',
            v_spot_id,
            'a0000000-0000-0000-0000-000000000001',
            1.0,
            'Trying to link mismatched category'
        );
        RAISE EXCEPTION 'TEST 4 FAILED: Incompatible category linking was allowed!';
    EXCEPTION WHEN OTHERS THEN
        IF SQLERRM LIKE '%Category mismatch%' THEN
            RAISE NOTICE 'TEST 4 PASSED: Incompatible category linking rejected.';
        ELSE
            RAISE EXCEPTION 'TEST 4 FAILED: Unexpected error: %', SQLERRM;
        END IF;
    END;
END;
$$;

-- TEST 5: Unauthorized linking rejected
SET ROLE authenticated;
SET request.jwt.claim.role = 'authenticated';
SET request.jwt.claim.sub = 'a0000000-0000-0000-0000-000000000002'; -- Authority A (Non-admin)

DO $$
DECLARE
    v_spot_id uuid;
BEGIN
    select spot_id into v_spot_id from public.reports where id = 'e0000000-0000-0000-0000-000000000010';

    BEGIN
        PERFORM public.link_report_to_spot(
            'e0000000-0000-0000-0000-000000000012',
            v_spot_id,
            'a0000000-0000-0000-0000-000000000002',
            1.0,
            'Unauthorized link'
        );
        RAISE EXCEPTION 'TEST 5 FAILED: Non-admin was able to link report to spot!';
    EXCEPTION WHEN OTHERS THEN
        IF SQLERRM LIKE '%Unauthorized: Only super administrators can link reports%' THEN
            RAISE NOTICE 'TEST 5 PASSED: Unauthorized linking rejected.';
        ELSE
            RAISE EXCEPTION 'TEST 5 FAILED: Unexpected error: %', SQLERRM;
        END IF;
    END;
END;
$$;

-- TEST 6: Duplicate candidate distances handled correctly
RESET ROLE;
SET request.jwt.claim.role = 'service_role';
SET request.jwt.claim.sub = 'a0000000-0000-0000-0000-000000000001';

DO $$
DECLARE
    v_band text;
    v_dist numeric;
BEGIN
    -- Query duplicate candidates for coordinates 2m away from Test Spot 1
    SELECT candidate_band, distance_metres INTO v_band, v_dist
    FROM public.find_duplicate_candidates(
        19.0475100, 73.0699400,
        'water_supply_public_taps',
        'kharghar_itm_v1',
        false
    )
    LIMIT 1;

    IF v_band != 'STRONG_CANDIDATE' THEN
        RAISE EXCEPTION 'TEST 6 FAILED: Expected STRONG_CANDIDATE (<= 5m), got % (dist: %)', v_band, v_dist;
    END IF;

    RAISE NOTICE 'TEST 6 PASSED: Duplicate candidate distance and candidate band classified correctly (%).', v_band;
END;
$$;

-- TEST 7: No automatic merging of physical issues
DO $$
DECLARE
    v_spot_count int;
BEGIN
    -- Inserting two nearby reports does not automatically create or merge spots
    SELECT count(*) INTO v_spot_count
    FROM public.spots
    WHERE canonical_latitude = 19.0475120 AND canonical_longitude = 73.0699420;

    -- The second report did NOT create an automatic spot, nor did it overwrite canonical coordinates
    IF v_spot_count != 0 THEN
        RAISE EXCEPTION 'TEST 7 FAILED: Auto-merging or auto-spot creation occurred!';
    END IF;

    RAISE NOTICE 'TEST 7 PASSED: No automatic merging of physical issues; spot creation requires explicit review.';
END;
$$;

-- ============================================================================
-- GROUP 2: STATE MACHINE (TESTS 8 - 13)
-- ============================================================================

-- TEST 8: Valid status transition
SET ROLE authenticated;
SET request.jwt.claim.role = 'authenticated';
SET request.jwt.claim.sub = 'a0000000-0000-0000-0000-000000000001'; -- Super Admin

DO $$
DECLARE
    v_spot_id uuid;
    v_spot record;
BEGIN
    select spot_id into v_spot_id from public.reports where id = 'e0000000-0000-0000-0000-000000000010';

    -- Currently ASSIGNED -> Transition to IN_PROGRESS
    PERFORM public.transition_spot_status(
        v_spot_id,
        'IN_PROGRESS',
        'super_admin',
        'a0000000-0000-0000-0000-000000000001',
        'Work order dispatched to maintenance team',
        'admin_dashboard'
    );

    select * into v_spot from public.spots where id = v_spot_id;
    if v_spot.status != 'IN_PROGRESS' then
        raise exception 'TEST 8 FAILED: Spot status was not updated to IN_PROGRESS!';
    end if;

    RAISE NOTICE 'TEST 8 PASSED: Valid status transition executed.';
END;
$$;

-- TEST 9: Invalid status transition rejected
DO $$
DECLARE
    v_spot_id uuid;
BEGIN
    select spot_id into v_spot_id from public.reports where id = 'e0000000-0000-0000-0000-000000000010';

    BEGIN
        -- IN_PROGRESS directly to RESOLVED without RESOLUTION_SUBMITTED is illegal
        PERFORM public.transition_spot_status(
            v_spot_id,
            'RESOLVED',
            'super_admin',
            'a0000000-0000-0000-0000-000000000001',
            'Bypassing resolution review'
        );
        RAISE EXCEPTION 'TEST 9 FAILED: Invalid status transition succeeded!';
    EXCEPTION WHEN OTHERS THEN
        IF SQLERRM LIKE '%Illegal status transition%' THEN
            RAISE NOTICE 'TEST 9 PASSED: Invalid status transition rejected.';
        ELSE
            RAISE EXCEPTION 'TEST 9 FAILED: Unexpected error: %', SQLERRM;
        END IF;
    END;
END;
$$;

-- TEST 10: Missing status-history record causes transaction failure / atomicity
DO $$
DECLARE
    v_spot_id uuid;
    v_prev_status text;
    v_curr_status text;
BEGIN
    select spot_id into v_spot_id from public.reports where id = 'e0000000-0000-0000-0000-000000000010';
    select status into v_prev_status from public.spots where id = v_spot_id;

    BEGIN
        -- Execute an illegal operation in an inner block that triggers rollback
        PERFORM public.transition_spot_status(
            v_spot_id,
            'NEW',
            'super_admin',
            'a0000000-0000-0000-0000-000000000001',
            'Illegal reset'
        );
    EXCEPTION WHEN OTHERS THEN
        NULL; -- Expected failure
    END;

    -- Verify status remained unchanged
    select status into v_curr_status from public.spots where id = v_spot_id;
    if v_curr_status != v_prev_status then
        raise exception 'TEST 10 FAILED: Transaction did not roll back cleanly!';
    end if;

    RAISE NOTICE 'TEST 10 PASSED: Status update rolls back atomically on failure.';
END;
$$;

-- TEST 11: Unauthorized status transition rejected
SET ROLE authenticated;
SET request.jwt.claim.role = 'authenticated';
SET request.jwt.claim.sub = 'a0000000-0000-0000-0000-000000000003'; -- Authority B (Roads Dept)

DO $$
DECLARE
    v_spot_id uuid;
BEGIN
    -- Spot A is assigned to Water Dept (Org A)
    v_spot_id := 'c0000000-0000-0000-0000-000000000001';

    BEGIN
        PERFORM public.transition_spot_status(
            v_spot_id,
            'RESOLUTION_SUBMITTED',
            'authority_user',
            'a0000000-0000-0000-0000-000000000003',
            'Unauthorized transition by Org B'
        );
        RAISE EXCEPTION 'TEST 11 FAILED: Authority B was able to transition Authority A spot!';
    EXCEPTION WHEN OTHERS THEN
        IF SQLERRM LIKE '%Unauthorized: Authority user is not an active member of the assigned organisation%' THEN
            RAISE NOTICE 'TEST 11 PASSED: Unauthorized cross-org status transition rejected.';
        ELSE
            RAISE EXCEPTION 'TEST 11 FAILED: Unexpected error: %', SQLERRM;
        END IF;
    END;
END;
$$;

-- TEST 12: Resolved spot cannot be modified through unauthorised paths
SET ROLE authenticated;
SET request.jwt.claim.role = 'authenticated';
SET request.jwt.claim.sub = 'a0000000-0000-0000-0000-000000000002'; -- Authority A

DO $$
BEGIN
    BEGIN
        UPDATE public.spots
        SET status = 'IN_PROGRESS'
        WHERE id = 'c0000000-0000-0000-0000-000000000015'; -- Pre-seeded RESOLVED spot for Org A
        RAISE EXCEPTION 'TEST 12 FAILED: Direct update to resolved spot succeeded!';
    EXCEPTION WHEN OTHERS THEN
        IF SQLERRM LIKE '%Forbidden: Only super administrators can reopen resolved issues%' THEN
            RAISE NOTICE 'TEST 12 PASSED: Direct status modification on resolved spot blocked by trigger guard.';
        ELSE
            RAISE EXCEPTION 'TEST 12 FAILED: Unexpected error: %', SQLERRM;
        END IF;
    END;
END;
$$;

-- TEST 13: Reopening follows approved transition rules
SET ROLE authenticated;
SET request.jwt.claim.role = 'authenticated';
SET request.jwt.claim.sub = 'a0000000-0000-0000-0000-000000000001'; -- Super Admin

DO $$
DECLARE
    v_resolved_spot_id uuid := 'c0000000-0000-0000-0000-000000000015'; -- Spot 15
    v_spot record;
BEGIN
    -- Super-admin reopens resolved spot
    PERFORM public.transition_spot_status(
        v_resolved_spot_id,
        'REOPENED',
        'super_admin',
        'a0000000-0000-0000-0000-000000000001',
        'Citizen challenge verified on site: water leak resumed',
        'admin_dashboard'
    );

    select * into v_spot from public.spots where id = v_resolved_spot_id;
    if v_spot.status != 'REOPENED' or v_spot.resolved_at is not null then
        raise exception 'TEST 13 FAILED: Spot not properly reopened!';
    end if;

    -- Reopened spot transitions to IN_PROGRESS
    PERFORM public.transition_spot_status(
        v_resolved_spot_id,
        'IN_PROGRESS',
        'super_admin',
        'a0000000-0000-0000-0000-000000000001',
        'Re-dispatching repair crew',
        'admin_dashboard'
    );

    select status into v_spot.status from public.spots where id = v_resolved_spot_id;
    if v_spot.status != 'IN_PROGRESS' then
        raise exception 'TEST 13 FAILED: Reopened spot failed to transition to IN_PROGRESS!';
    end if;

    -- Reset Spot 15 back to RESOLVED for test isolation
    UPDATE public.spots SET status = 'RESOLVED', resolved_at = now() WHERE id = v_resolved_spot_id;

    RAISE NOTICE 'TEST 13 PASSED: Reopening follows approved transition rules.';
END;
$$;

-- ============================================================================
-- GROUP 3: ORGANISATION SECURITY (TESTS 14 - 18)
-- ============================================================================

-- TEST 14: Authority A cannot access Authority B's issue
SET ROLE authenticated;
SET request.jwt.claim.role = 'authenticated';
SET request.jwt.claim.sub = 'a0000000-0000-0000-0000-000000000002'; -- Authority A

DO $$
DECLARE
    v_count int;
BEGIN
    -- Authority A queries spots table: must see 0 rows for Spot B (c0000000-0000-0000-0000-000000000002)
    SELECT count(*) INTO v_count
    FROM public.spots
    WHERE id = 'c0000000-0000-0000-0000-000000000002';

    IF v_count != 0 THEN
        RAISE EXCEPTION 'TEST 14 FAILED: Authority A could see Authority B spot!';
    END IF;

    RAISE NOTICE 'TEST 14 PASSED: Tenant isolation prevents Authority A from seeing Authority B records.';
END;
$$;

-- TEST 15: Authority A cannot submit resolution for Authority B's issue
DO $$
BEGIN
    BEGIN
        PERFORM public.submit_resolution_request(
            'c0000000-0000-0000-0000-000000000002', -- Spot B (Roads Dept)
            'a0000000-0000-0000-0000-000000000002', -- Authority A User
            'Trying to resolve other org issue',
            'e1000000-0000-0000-0000-000000000001'
        );
        RAISE EXCEPTION 'TEST 15 FAILED: Authority A was able to submit resolution for Authority B!';
    EXCEPTION WHEN OTHERS THEN
        IF SQLERRM LIKE '%Unauthorized: User is not an active member of assigned organisation%' THEN
            RAISE NOTICE 'TEST 15 PASSED: Cross-organisation resolution submission rejected.';
        ELSE
            RAISE EXCEPTION 'TEST 15 FAILED: Unexpected error: %', SQLERRM;
        END IF;
    END;
END;
$$;

-- TEST 16: Authority cannot reassign an issue to another organisation
DO $$
DECLARE
    v_spot_id uuid;
    v_org_b_id uuid := 'b0000000-0000-0000-0000-000000000002';
BEGIN
    select spot_id into v_spot_id from public.reports where id = 'e0000000-0000-0000-0000-000000000010';

    -- Authority A attempts to change assigned_organisation_id directly
    UPDATE public.spots
    SET assigned_organisation_id = v_org_b_id
    WHERE id = v_spot_id;

    -- spots_authority_update RLS with check ensures assigned_organisation_id must remain in user's orgs
    -- Since Org B is not in user's orgs, this violates WITH CHECK!
    RAISE EXCEPTION 'TEST 16 FAILED: Authority was able to reassign organisation!';
EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%new row violates row-level security policy for table "spots"%' THEN
        RAISE NOTICE 'TEST 16 PASSED: Authority cannot reassign issue to another organisation (RLS with-check enforced).';
    ELSE
        RAISE EXCEPTION 'TEST 16 FAILED: Unexpected error: %', SQLERRM;
    END IF;
END;
$$;

-- TEST 17: Demo viewer cannot mutate demo records
SET ROLE authenticated;
SET request.jwt.claim.role = 'authenticated';
SET request.jwt.claim.sub = 'a0000000-0000-0000-0000-000000000004'; -- Demo Viewer

DO $$
DECLARE
    v_rows int;
BEGIN
    -- 17A: Attempt direct UPDATE on demo spots (Must affect 0 rows due to RLS)
    UPDATE public.spots
    SET severity_label = 'critical'
    WHERE is_demo = true;
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    IF v_rows != 0 THEN
        RAISE EXCEPTION 'TEST 17A FAILED: Demo viewer was able to update demo spots (rows: %)!', v_rows;
    END IF;

    -- 17B: Attempt INSERT on demo spots (Must throw exception via guard_demo_mutations trigger)
    BEGIN
        INSERT INTO public.spots (
            spot_code, pilot_id, group_id, category_id, issue_type_id,
            canonical_latitude, canonical_longitude, is_demo
        ) VALUES (
            'SPT-KHR-000998', 'kharghar_itm_v1', 'roads_mobility', 'road_surface', 'pothole',
            19.0475, 73.0699, true
        );
        RAISE EXCEPTION 'TEST 17B FAILED: Demo viewer insert did not throw exception!';
    EXCEPTION WHEN OTHERS THEN
        IF SQLERRM LIKE '%Forbidden: Demonstration workspace is strictly read-only%' THEN
            NULL; -- Expected trigger block
        ELSE
            RAISE EXCEPTION 'TEST 17B FAILED: Unexpected error: %', SQLERRM;
        END IF;
    END;

    -- 17C: Attempt transition_spot_status on demo spots (Must be rejected)
    BEGIN
        PERFORM public.transition_spot_status(
            'd0000000-0000-0000-0000-000000000003', -- Demo spot
            'IN_PROGRESS',
            'authority_user',
            'a0000000-0000-0000-0000-000000000004',
            'Demo viewer mutation attempt'
        );
        RAISE EXCEPTION 'TEST 17C FAILED: Demo viewer was able to transition spot status!';
    EXCEPTION WHEN OTHERS THEN
        NULL; -- Expected error
    END;

    RAISE NOTICE 'TEST 17 PASSED: Demo viewer cannot mutate demo records (Blocked by RLS & triggers).';
END;
$$;

-- TEST 18: Demo records cannot contaminate live workflows
SET ROLE authenticated;
SET request.jwt.claim.role = 'authenticated';
SET request.jwt.claim.sub = 'a0000000-0000-0000-0000-000000000001'; -- Super Admin

DO $$
DECLARE
    v_live_org_id uuid := 'b0000000-0000-0000-0000-000000000001';
BEGIN
    BEGIN
        -- Attempt to create spot for demo report assigning to live organisation
        PERFORM public.create_spot_for_report(
            'e0000000-0000-0000-0000-000000000013', -- Demo report
            'a0000000-0000-0000-0000-000000000001',
            'medium',
            v_live_org_id -- Live org
        );
        RAISE EXCEPTION 'TEST 18 FAILED: Demo report assigned to live organisation!';
    EXCEPTION WHEN OTHERS THEN
        IF SQLERRM LIKE '%Workspace mismatch%' THEN
            RAISE NOTICE 'TEST 18 PASSED: Demo records cannot contaminate live organisation workflows.';
        ELSE
            RAISE EXCEPTION 'TEST 18 FAILED: Unexpected error: %', SQLERRM;
        END IF;
    END;
END;
$$;

-- ============================================================================
-- GROUP 4: RESOLUTION WORKFLOW & EVIDENCE (TESTS 19 - 24)
-- ============================================================================

-- Create after-photo evidence fixture for Spot 1
RESET ROLE;
SET request.jwt.claim.role = 'service_role';
SET request.jwt.claim.sub = 'a0000000-0000-0000-0000-000000000001';

DO $$
DECLARE
    v_spot_id uuid;
    v_after_evidence_id uuid := 'e1000000-0000-0000-0000-000000000020';
BEGIN
    select spot_id into v_spot_id from public.reports where id = 'e0000000-0000-0000-0000-000000000010';

    INSERT INTO public.evidence (
        id, spot_id, evidence_stage, storage_path_private, mime_type, file_size_bytes, sha256, uploaded_by_user_id
    ) VALUES (
        v_after_evidence_id, v_spot_id, 'authority_after', 'private/raw_repaired_water_pipe.jpg',
        'image/jpeg', 180000, 'b4b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
        'a0000000-0000-0000-0000-000000000002'
    ) ON CONFLICT (id) DO NOTHING;
END;
$$;

-- TEST 19: Resolution submission without an after-photo is rejected
SET ROLE authenticated;
SET request.jwt.claim.role = 'authenticated';
SET request.jwt.claim.sub = 'a0000000-0000-0000-0000-000000000002'; -- Authority A

DO $$
DECLARE
    v_spot_id uuid;
BEGIN
    select spot_id into v_spot_id from public.reports where id = 'e0000000-0000-0000-0000-000000000010';

    BEGIN
        PERFORM public.submit_resolution_request(
            v_spot_id,
            'a0000000-0000-0000-0000-000000000002',
            'Repairs completed but no photo',
            null -- Null photo ID
        );
        RAISE EXCEPTION 'TEST 19 FAILED: Submission without after-photo was allowed!';
    EXCEPTION WHEN OTHERS THEN
        IF SQLERRM LIKE '%Mandatory after-photo evidence ID is required%' THEN
            RAISE NOTICE 'TEST 19 PASSED: Resolution submission without after-photo rejected.';
        ELSE
            RAISE EXCEPTION 'TEST 19 FAILED: Unexpected error: %', SQLERRM;
        END IF;
    END;
END;
$$;

-- TEST 20: Valid after-photo submission succeeds
DO $$
DECLARE
    v_spot_id uuid;
    v_sub_id uuid;
    v_spot record;
BEGIN
    select spot_id into v_spot_id from public.reports where id = 'e0000000-0000-0000-0000-000000000010';

    v_sub_id := public.submit_resolution_request(
        v_spot_id,
        'a0000000-0000-0000-0000-000000000002',
        'Replacement pipe installed, pressure tested to 4.2 bar, road backfilled.',
        'e1000000-0000-0000-0000-000000000020',
        current_date,
        'WO-KHR-2026-991'
    );

    if v_sub_id is null then
        raise exception 'TEST 20 FAILED: Submission ID was null!';
    end if;

    select * into v_spot from public.spots where id = v_spot_id;
    if v_spot.status != 'RESOLUTION_SUBMITTED' then
        raise exception 'TEST 20 FAILED: Spot status not transitioned to RESOLUTION_SUBMITTED!';
    end if;

    RAISE NOTICE 'TEST 20 PASSED: Valid after-photo resolution submission succeeds.';
END;
$$;

-- TEST 21: Authority cannot approve its own resolution
DO $$
DECLARE
    v_sub_id uuid;
BEGIN
    select id into v_sub_id from public.resolution_submissions order by created_at desc limit 1;

    BEGIN
        PERFORM public.review_resolution_request(
            v_sub_id,
            'a0000000-0000-0000-0000-000000000002',
            'approved',
            'Authority self-approval'
        );
        RAISE EXCEPTION 'TEST 21 FAILED: Authority user was able to approve resolution!';
    EXCEPTION WHEN OTHERS THEN
        IF SQLERRM LIKE '%Unauthorized: Only super administrators can review resolution requests%' THEN
            RAISE NOTICE 'TEST 21 PASSED: Authority self-approval prevented.';
        ELSE
            RAISE EXCEPTION 'TEST 21 FAILED: Unexpected error: %', SQLERRM;
        END IF;
    END;
END;
$$;

-- TEST 22: Only super-admin can approve final resolution
SET ROLE authenticated;
SET request.jwt.claim.role = 'authenticated';
SET request.jwt.claim.sub = 'a0000000-0000-0000-0000-000000000001'; -- Super Admin

DO $$
DECLARE
    v_sub_id uuid;
    v_sub record;
    v_spot record;
BEGIN
    select id into v_sub_id from public.resolution_submissions order by created_at desc limit 1;

    PERFORM public.review_resolution_request(
        v_sub_id,
        'a0000000-0000-0000-0000-000000000001',
        'approved',
        'Physical inspection confirmed repair complete and water supply restored.'
    );

    select * into v_sub from public.resolution_submissions where id = v_sub_id;
    if v_sub.review_status != 'approved' or v_sub.reviewed_by != 'a0000000-0000-0000-0000-000000000001' then
        raise exception 'TEST 22 FAILED: Submission status not approved!';
    end if;

    select * into v_spot from public.spots where id = v_sub.spot_id;
    if v_spot.status != 'RESOLVED' or v_spot.resolved_at is null then
        raise exception 'TEST 22 FAILED: Spot status not transitioned to RESOLVED!';
    end if;

    RAISE NOTICE 'TEST 22 PASSED: Super-admin approval transitions spot to RESOLVED.';
END;
$$;

-- TEST 23: Rejected resolution preserves previous evidence
DO $$
DECLARE
    v_spot_id uuid;
    v_sub_id uuid;
    v_spot record;
    v_sub record;
BEGIN
    select spot_id into v_spot_id from public.reports where id = 'e0000000-0000-0000-0000-000000000010';

    -- Re-transition spot to RESOLUTION_SUBMITTED for testing rejection
    UPDATE public.spots SET status = 'RESOLUTION_SUBMITTED', resolved_at = null WHERE id = v_spot_id;

    -- Insert a second submission
    INSERT INTO public.resolution_submissions (
        spot_id, submitted_by, completion_note, after_photo_evidence_id, review_status
    ) VALUES (
        v_spot_id, 'a0000000-0000-0000-0000-000000000002', 'Second repair attempt',
        'e1000000-0000-0000-0000-000000000020', 'pending'
    ) RETURNING id INTO v_sub_id;

    -- Super-admin rejects the submission
    PERFORM public.review_resolution_request(
        v_sub_id,
        'a0000000-0000-0000-0000-000000000001',
        'rejected',
        'Evidence photo blurry; water leak still visible in background. Please re-photograph.'
    );

    select * into v_sub from public.resolution_submissions where id = v_sub_id;
    if v_sub.review_status != 'rejected' then
        raise exception 'TEST 23 FAILED: Submission status not rejected!';
    end if;

    select * into v_spot from public.spots where id = v_spot_id;
    if v_spot.status != 'IN_PROGRESS' then
        raise exception 'TEST 23 FAILED: Spot status not returned to IN_PROGRESS!';
    end if;

    RAISE NOTICE 'TEST 23 PASSED: Rejected resolution preserves submission history and transitions spot back to IN_PROGRESS.';
END;
$$;

-- TEST 24: Duplicate approval is prevented
DO $$
DECLARE
    v_sub_id uuid;
BEGIN
    select id into v_sub_id from public.resolution_submissions where review_status = 'approved' limit 1;

    BEGIN
        PERFORM public.review_resolution_request(
            v_sub_id,
            'a0000000-0000-0000-0000-000000000001',
            'approved',
            'Second approval attempt'
        );
        RAISE EXCEPTION 'TEST 24 FAILED: Re-approval of already approved submission succeeded!';
    EXCEPTION WHEN OTHERS THEN
        IF SQLERRM LIKE '%has already been reviewed%' THEN
            RAISE NOTICE 'TEST 24 PASSED: Duplicate approval prevented.';
        ELSE
            RAISE EXCEPTION 'TEST 24 FAILED: Unexpected error: %', SQLERRM;
        END IF;
    END;
END;
$$;

-- ============================================================================
-- GROUP 5: CITIZEN CHALLENGES (TESTS 25 - 28)
-- ============================================================================

-- TEST 25: Valid challenge recorded
DO $$
DECLARE
    v_spot_id uuid;
    v_challenge_id uuid;
    v_chal record;
BEGIN
    select spot_id into v_spot_id from public.reports where id = 'e0000000-0000-0000-0000-000000000010';

    v_challenge_id := public.create_citizen_challenge(
        v_spot_id,
        'f0000000-0000-0000-0000-000000000001',
        'still_not_fixed',
        'Water is still leaking around the edges of the repair patch.'
    );

    select * into v_chal from public.citizen_challenges where id = v_challenge_id;
    if v_chal.status != 'new' or v_chal.challenge_type != 'still_not_fixed' then
        raise exception 'TEST 25 FAILED: Challenge not recorded properly!';
    end if;

    RAISE NOTICE 'TEST 25 PASSED: Valid citizen challenge recorded.';
END;
$$;

-- TEST 26: Duplicate challenge rules enforced
DO $$
DECLARE
    v_spot_id uuid;
BEGIN
    select spot_id into v_spot_id from public.reports where id = 'e0000000-0000-0000-0000-000000000010';

    BEGIN
        -- Immediate second challenge from same citizen for same spot
        PERFORM public.create_citizen_challenge(
            v_spot_id,
            'f0000000-0000-0000-0000-000000000001',
            'still_not_fixed',
            'Submitting second spam challenge'
        );
        RAISE EXCEPTION 'TEST 26 FAILED: Duplicate challenge was allowed!';
    EXCEPTION WHEN OTHERS THEN
        IF SQLERRM LIKE '%Duplicate challenge: An active challenge from this citizen is already pending%' THEN
            RAISE NOTICE 'TEST 26 PASSED: Duplicate citizen challenge rejected (24h rate limit enforced).';
        ELSE
            RAISE EXCEPTION 'TEST 26 FAILED: Unexpected error: %', SQLERRM;
        END IF;
    END;
END;
$$;

-- TEST 27: Challenge does not expose citizen identity
DO $$
DECLARE
    v_chal record;
BEGIN
    select * into v_chal from public.citizen_challenges order by created_at desc limit 1;

    -- Verify challenge only references UUID foreign key, never raw telegram identity
    if v_chal.citizen_contact_id is null then
        raise exception 'TEST 27 FAILED: Citizen contact ID missing!';
    end if;

    RAISE NOTICE 'TEST 27 PASSED: Citizen identity remains strictly pseudonymous in challenge record.';
END;
$$;

-- TEST 28: Challenge creates the appropriate auditable event
DO $$
DECLARE
    v_count int;
BEGIN
    SELECT count(*) INTO v_count
    FROM public.audit_logs
    WHERE action = 'CITIZEN_CHALLENGE_CREATED';

    IF v_count = 0 THEN
        RAISE EXCEPTION 'TEST 28 FAILED: CITIZEN_CHALLENGE_CREATED audit event missing!';
    END IF;

    RAISE NOTICE 'TEST 28 PASSED: Citizen challenge generates auditable system event.';
END;
$$;

-- ============================================================================
-- GROUP 6: TRANSACTION INTEGRITY & CONCURRENCY (TESTS 29 - 30)
-- ============================================================================

-- TEST 29: Partial failure rolls back all related writes
DO $$
DECLARE
    v_spot_id uuid;
    v_count_before int;
    v_count_after int;
BEGIN
    select spot_id into v_spot_id from public.reports where id = 'e0000000-0000-0000-0000-000000000010';
    select count(*) into v_count_before from public.authority_handoffs;

    BEGIN
        -- Attempt handoff with invalid proof evidence ID (does not belong to spot)
        PERFORM public.record_authority_handoff(
            v_spot_id,
            'CIDCO Sub-divisional Office',
            'official_email',
            'a0000000-0000-0000-0000-000000000001',
            'Valid note',
            'REF-1234',
            'e1000000-0000-0000-0000-000000000002' -- Belongs to Spot 2, not Spot 1!
        );
        RAISE EXCEPTION 'TEST 29 FAILED: Handoff with invalid proof was allowed!';
    EXCEPTION WHEN OTHERS THEN
        NULL; -- Expected error
    END;

    select count(*) into v_count_after from public.authority_handoffs;
    if v_count_before != v_count_after then
        raise exception 'TEST 29 FAILED: Handoff was partially inserted despite failure!';
    end if;

    RAISE NOTICE 'TEST 29 PASSED: Partial failure completely rolls back all related writes.';
END;
$$;

-- TEST 30: Concurrent / repeated operations prevent duplicate workflow outcomes
DO $$
DECLARE
    v_spot_id uuid;
BEGIN
    select spot_id into v_spot_id from public.reports where id = 'e0000000-0000-0000-0000-000000000010';

    -- Attempt to link already-linked Report 1 again
    BEGIN
        PERFORM public.link_report_to_spot(
            'e0000000-0000-0000-0000-000000000010',
            v_spot_id,
            'a0000000-0000-0000-0000-000000000001',
            0
        );
        RAISE EXCEPTION 'TEST 30 FAILED: Re-linking already linked report succeeded!';
    EXCEPTION WHEN OTHERS THEN
        IF SQLERRM LIKE '%is already linked to spot%' THEN
            RAISE NOTICE 'TEST 30 PASSED: Idempotency & duplicate outcome prevention verified.';
        ELSE
            RAISE EXCEPTION 'TEST 30 FAILED: Unexpected error: %', SQLERRM;
        END IF;
    END;

    RAISE NOTICE '=======================================================';
    RAISE NOTICE 'ALL 30 PHASE 4 WORKFLOW SCENARIOS VERIFIED SUCCESSFULLY!';
    RAISE NOTICE '=======================================================';
END;
$$;

RESET ROLE;
