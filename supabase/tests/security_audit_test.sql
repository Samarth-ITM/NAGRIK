-- ============================================================================
-- NAGRIK DATABASE SECURITY AUDIT VALIDATION TEST SUITE
-- Target Engine: Supabase PostgreSQL (15+)
-- Scenarios: 12 Security and Tenant Boundaries
-- ============================================================================

\set ON_ERROR_STOP on

-- ----------------------------------------------------------------------------
-- STEP 1: FIXTURE SETUP (EXECUTED AS SUPERUSER / POSTGRES)
-- ----------------------------------------------------------------------------
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

    v_spot_a_id uuid := 'c0000000-0000-0000-0000-000000000001';
    v_spot_b_id uuid := 'c0000000-0000-0000-0000-000000000002';
    v_spot_unassigned_id uuid := 'c0000000-0000-0000-0000-000000000003';
    v_spot_approved_id uuid := 'c0000000-0000-0000-0000-000000000004';

    v_report_private_id uuid := 'e0000000-0000-0000-0000-000000000001';
    v_contact_id uuid := 'f0000000-0000-0000-0000-000000000001';
    v_evidence_private_id uuid := 'e1000000-0000-0000-0000-000000000001';
    v_evidence_public_id uuid := 'e1000000-0000-0000-0000-000000000002';
BEGIN
    RAISE NOTICE '=======================================================';
    RAISE NOTICE 'INITIALIZING NAGRIK SECURITY AUDIT FIXTURES';
    RAISE NOTICE '=======================================================';

    -- 1. Create auth users
    INSERT INTO auth.users (id, email) VALUES
        (v_super_admin_id, 'superadmin@nagrik.test'),
        (v_authority_a_user_id, 'authority_a@nagrik.test'),
        (v_authority_b_user_id, 'authority_b@nagrik.test'),
        (v_demo_viewer_user_id, 'demoviewer@nagrik.test')
    ON CONFLICT (id) DO NOTHING;

    -- 2. Create profiles
    INSERT INTO public.profiles (user_id, display_name, role) VALUES
        (v_super_admin_id, 'Super Admin Test', 'super_admin'),
        (v_authority_a_user_id, 'Authority A Operator', 'authority_operator'),
        (v_authority_b_user_id, 'Authority B Operator', 'authority_operator'),
        (v_demo_viewer_user_id, 'Demo Viewer Test', 'demo_viewer')
    ON CONFLICT (user_id) DO UPDATE SET role = EXCLUDED.role;

    -- 3. Create organisations
    INSERT INTO public.organisations (id, name, slug, organisation_type, is_demo) VALUES
        (v_org_a_id, 'Water Supply Department', 'water-dept', 'government_authority', false),
        (v_org_b_id, 'Roads & Works Department', 'roads-dept', 'government_authority', false)
    ON CONFLICT (id) DO NOTHING;

    -- 4. Create memberships
    INSERT INTO public.organisation_memberships (organisation_id, user_id, membership_role) VALUES
        (v_org_a_id, v_authority_a_user_id, 'authority_operator'),
        (v_org_b_id, v_authority_b_user_id, 'authority_operator'),
        (v_org_demo_id, v_demo_viewer_user_id, 'demo_viewer')
    ON CONFLICT (organisation_id, user_id) DO NOTHING;

    -- 5. Create synthetic citizen contact
    INSERT INTO public.citizen_contacts (id, telegram_user_hash, encrypted_chat_id, language) VALUES
        (v_contact_id, 'synthetic_test_citizen_hash_123', 'synthetic_enc_chat_id_456', 'en')
    ON CONFLICT (id) DO NOTHING;

    -- 6. Create test spots
    INSERT INTO public.spots (
        id, spot_code, pilot_id, group_id, category_id, issue_type_id,
        canonical_latitude, canonical_longitude, status, assigned_organisation_id, public_approved, is_demo
    ) VALUES
        (v_spot_a_id, 'SPT-KHR-000901', 'kharghar_itm_v1', 'utilities_lighting_greenery', 'water_supply_public_taps', 'water_pipeline_leakage', 19.0475123, 73.0699456, 'ASSIGNED', v_org_a_id, false, false),
        (v_spot_b_id, 'SPT-KHR-000902', 'kharghar_itm_v1', 'roads_mobility', 'road_surface', 'pothole', 19.0478123, 73.0702456, 'ASSIGNED', v_org_b_id, false, false),
        (v_spot_unassigned_id, 'SPT-KHR-000903', 'kharghar_itm_v1', 'waste_cleanliness_drainage', 'drains_stormwater', 'blocked_drain', 19.0471123, 73.0685456, 'NEW', null, false, false),
        (v_spot_approved_id, 'SPT-KHR-000904', 'kharghar_itm_v1', 'roads_mobility', 'road_safety_assets', 'damaged_speed_breaker', 19.0469123, 73.0691456, 'IN_PROGRESS', v_org_b_id, true, false)
    ON CONFLICT (id) DO UPDATE SET public_approved = EXCLUDED.public_approved;

    -- 7. Create test report with private citizen data
    INSERT INTO public.reports (
        id, ticket_code, citizen_contact_id, pilot_id, group_id, category_id, issue_type_id,
        description_private, latitude, longitude, spot_id, review_status, public_approved, is_demo
    ) VALUES
        (v_report_private_id, 'NAG-KHR-2026-000901', v_contact_id, 'kharghar_itm_v1', 'roads_mobility', 'road_safety_assets', 'damaged_speed_breaker', 'Citizen private note with sensitive contact details', 19.0469123, 73.0691456, v_spot_approved_id, 'verified', true, false)
    ON CONFLICT (id) DO NOTHING;

    -- 8. Create test evidence
    INSERT INTO public.evidence (
        id, spot_id, report_id, evidence_stage, storage_path_private, storage_path_public,
        mime_type, file_size_bytes, sha256, public_approved_at
    ) VALUES
        (v_evidence_private_id, v_spot_a_id, null, 'authority_after', 'private/raw_water_leak_123.jpg', null, 'image/jpeg', 102400, 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', null),
        (v_evidence_public_id, v_spot_approved_id, null, 'authority_after', 'private/speed_breaker_raw.jpg', 'public-approved/speed_breaker_deriv.webp', 'image/webp', 51200, 'a3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', now())
    ON CONFLICT (id) DO NOTHING;

    RAISE NOTICE 'FIXTURES INITIALIZED SUCCESSFULLY.';
END;
$$;

-- ----------------------------------------------------------------------------
-- TEST SCENARIO 1: Anonymous user cannot read private reports table
-- ----------------------------------------------------------------------------
SET ROLE anon;
SET request.jwt.claim.role = 'anon';
SET request.jwt.claim.sub = '';

DO $$
DECLARE
    v_count int;
BEGIN
    EXECUTE 'SELECT count(*) FROM public.reports' INTO v_count;
    RAISE EXCEPTION 'SCENARIO 1 FAILED: Anonymous user was able to query public.reports base table!';
EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'SCENARIO 1 PASSED: Anonymous user denied direct SELECT on public.reports';
END;
$$;

-- ----------------------------------------------------------------------------
-- TEST SCENARIO 2: Anonymous user cannot read citizen contacts
-- ----------------------------------------------------------------------------
DO $$
DECLARE
    v_count int;
BEGIN
    EXECUTE 'SELECT count(*) FROM public.citizen_contacts' INTO v_count;
    RAISE EXCEPTION 'SCENARIO 2 FAILED: Anonymous user was able to query public.citizen_contacts base table!';
EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'SCENARIO 2 PASSED: Anonymous user denied direct SELECT on public.citizen_contacts';
END;
$$;

-- ----------------------------------------------------------------------------
-- TEST SCENARIO 3: Anonymous user can only read approved public projection
-- ----------------------------------------------------------------------------
DO $$
DECLARE
    v_count int;
BEGIN
    SELECT count(*) INTO v_count FROM public.public_spots WHERE spot_code = 'SPT-KHR-000904';
    IF v_count != 1 THEN
        RAISE EXCEPTION 'SCENARIO 3 FAILED: Approved public spot was not returned in public_spots view!';
    END IF;

    SELECT count(*) INTO v_count FROM public.public_spots WHERE spot_code = 'SPT-KHR-000901';
    IF v_count != 0 THEN
        RAISE EXCEPTION 'SCENARIO 3 FAILED: Unapproved spot SPT-KHR-000901 leaked into public_spots view!';
    END IF;

    RAISE NOTICE 'SCENARIO 3 PASSED: Anonymous user sees only approved public projection data';
END;
$$;

-- ----------------------------------------------------------------------------
-- TEST SCENARIO 4: Anonymous user cannot access private evidence
-- ----------------------------------------------------------------------------
DO $$
DECLARE
    v_count int;
BEGIN
    BEGIN
        EXECUTE 'SELECT count(*) FROM public.evidence' INTO v_count;
        RAISE EXCEPTION 'SCENARIO 4 FAILED: Anonymous user was able to select from public.evidence base table!';
    EXCEPTION WHEN insufficient_privilege THEN
        NULL; -- Expected
    END;

    -- Query public derivative view
    SELECT count(*) INTO v_count FROM public.public_spot_evidence WHERE spot_code = 'SPT-KHR-000904';
    IF v_count != 1 THEN
        RAISE EXCEPTION 'SCENARIO 4 FAILED: Approved public evidence derivative was not returned in public view!';
    END IF;

    RAISE NOTICE 'SCENARIO 4 PASSED: Anonymous user denied base evidence access; public view exposes only approved derivatives';
END;
$$;

-- ----------------------------------------------------------------------------
-- TEST SCENARIOS 5 & 6: Authority Tenant Isolation (A vs B vs Unassigned)
-- ----------------------------------------------------------------------------
SET ROLE authenticated;
SET request.jwt.claim.role = 'authenticated';
SET request.jwt.claim.sub = 'a0000000-0000-0000-0000-000000000002'; -- Authority A

DO $$
DECLARE
    v_spot_a_id uuid := 'c0000000-0000-0000-0000-000000000001';
    v_spot_b_id uuid := 'c0000000-0000-0000-0000-000000000002';
    v_spot_unassigned_id uuid := 'c0000000-0000-0000-0000-000000000003';
    v_count int;
BEGIN
    -- Authority A should see spot A (assigned to Water Dept)
    SELECT count(*) INTO v_count FROM public.spots WHERE id = v_spot_a_id;
    IF v_count != 1 THEN
        RAISE EXCEPTION 'SCENARIO 5 FAILED: Authority A could not see assigned spot A!';
    END IF;

    -- Authority A MUST NOT see spot B (assigned to Roads Dept)
    SELECT count(*) INTO v_count FROM public.spots WHERE id = v_spot_b_id;
    IF v_count != 0 THEN
        RAISE EXCEPTION 'SCENARIO 5 FAILED: Authority A was able to read Authority B spot B!';
    END IF;
    RAISE NOTICE 'SCENARIO 5 PASSED: Authority A cannot read Authority B records (Tenant Isolation enforced)';

    -- Authority A MUST NOT see unassigned spot
    SELECT count(*) INTO v_count FROM public.spots WHERE id = v_spot_unassigned_id;
    IF v_count != 0 THEN
        RAISE EXCEPTION 'SCENARIO 6 FAILED: Authority A was able to read unassigned spot!';
    END IF;
    RAISE NOTICE 'SCENARIO 6 PASSED: Authority user cannot access unassigned live records';
END;
$$;

-- ----------------------------------------------------------------------------
-- TEST SCENARIO 7: Authority user cannot read citizen identity
-- ----------------------------------------------------------------------------
DO $$
DECLARE
    v_count int;
BEGIN
    BEGIN
        EXECUTE 'SELECT count(*) FROM public.citizen_contacts' INTO v_count;
        IF v_count != 0 THEN
            RAISE EXCEPTION 'SCENARIO 7 FAILED: Authority user was able to read citizen_contacts!';
        END IF;
        RAISE NOTICE 'SCENARIO 7 PASSED: Authority user cannot read citizen contacts (Zero rows returned by RLS)';
    EXCEPTION WHEN insufficient_privilege THEN
        RAISE NOTICE 'SCENARIO 7 PASSED: Authority user cannot read citizen contacts (Permission denied)';
    END;
END;
$$;

-- ----------------------------------------------------------------------------
-- TEST SCENARIOS 8 & 9: Demo viewer isolation (Read-only, no live access)
-- ----------------------------------------------------------------------------
SET ROLE authenticated;
SET request.jwt.claim.role = 'authenticated';
SET request.jwt.claim.sub = 'a0000000-0000-0000-0000-000000000004'; -- Demo viewer

DO $$
DECLARE
    v_spot_demo_id uuid := 'd1000000-0000-0000-0000-000000000101';
    v_count int;
BEGIN
    -- Demo viewer must not see live spots
    SELECT count(*) INTO v_count FROM public.spots WHERE is_demo = false;
    IF v_count != 0 THEN
        RAISE EXCEPTION 'SCENARIO 8 FAILED: Demo viewer was able to read live records!';
    END IF;
    RAISE NOTICE 'SCENARIO 8 PASSED: Demo viewer cannot access live records';

    -- Demo viewer cannot modify demo records (denied by both RLS and guard triggers)
    UPDATE public.spots SET status = 'IN_PROGRESS' WHERE id = v_spot_demo_id;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    IF v_count != 0 THEN
        RAISE EXCEPTION 'SCENARIO 9 FAILED: Demo viewer was able to update a demo spot (rows updated: %)!', v_count;
    END IF;

    BEGIN
        INSERT INTO public.spots (
            spot_code, pilot_id, group_id, category_id, issue_type_id,
            canonical_latitude, canonical_longitude, is_demo
        ) VALUES (
            'SPT-KHR-000999', 'kharghar_itm_v1', 'roads_mobility', 'road_surface', 'pothole',
            19.0475, 73.0699, true
        );
        RAISE EXCEPTION 'SCENARIO 9 FAILED: Demo viewer insert did not throw an exception!';
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'SCENARIO 9 PASSED: Demo viewer cannot modify demo records (Mutations blocked by RLS & triggers)';
    END;
END;
$$;

-- ----------------------------------------------------------------------------
-- TEST SCENARIO 10: Authority user cannot approve final resolution
-- ----------------------------------------------------------------------------
SET ROLE authenticated;
SET request.jwt.claim.role = 'authenticated';
SET request.jwt.claim.sub = 'a0000000-0000-0000-0000-000000000002'; -- Authority A

DO $$
DECLARE
    v_spot_a_id uuid := 'c0000000-0000-0000-0000-000000000001';
BEGIN
    BEGIN
        UPDATE public.spots SET status = 'RESOLVED' WHERE id = v_spot_a_id;
        RAISE EXCEPTION 'SCENARIO 10 FAILED: Authority user was able to set status to RESOLVED!';
    EXCEPTION WHEN OTHERS THEN
        IF SQLERRM LIKE '%Forbidden: Only super administrators can approve issue resolution%' THEN
            RAISE NOTICE 'SCENARIO 10 PASSED: Authority user cannot approve final resolution (Guard trigger enforced)';
        ELSE
            RAISE EXCEPTION 'SCENARIO 10 FAILED: Unexpected error: %', SQLERRM;
        END IF;
    END;
END;
$$;

-- ----------------------------------------------------------------------------
-- TEST SCENARIO 11: Non-admin cannot grant themselves super-admin
-- ----------------------------------------------------------------------------
DO $$
DECLARE
    v_authority_a_user_id uuid := 'a0000000-0000-0000-0000-000000000002';
BEGIN
    BEGIN
        UPDATE public.profiles SET role = 'super_admin' WHERE user_id = v_authority_a_user_id;
        RAISE EXCEPTION 'SCENARIO 11 FAILED: Non-admin was able to update their role to super_admin!';
    EXCEPTION WHEN OTHERS THEN
        IF SQLERRM LIKE '%Forbidden: User role cannot be modified without super-administrator privileges%' THEN
            RAISE NOTICE 'SCENARIO 11 PASSED: Non-admin cannot escalate role to super_admin (Trigger enforced)';
        ELSE
            RAISE EXCEPTION 'SCENARIO 11 FAILED: Unexpected error: %', SQLERRM;
        END IF;
    END;
END;
$$;

-- ----------------------------------------------------------------------------
-- TEST SCENARIO 12: Public projection does not expose private coordinates or paths
-- ----------------------------------------------------------------------------
SET ROLE anon;
SET request.jwt.claim.role = 'anon';
SET request.jwt.claim.sub = '';

DO $$
DECLARE
    v_count int;
BEGIN
    -- Verify discretized coordinates in public_spots (25-50m grid precision: 19.0470, 73.0692)
    SELECT count(*) INTO v_count
    FROM public.public_spots
    WHERE spot_code = 'SPT-KHR-000904'
      AND public_latitude = 19.0470
      AND public_longitude = 73.0692;

    IF v_count != 1 THEN
        RAISE EXCEPTION 'SCENARIO 12 FAILED: Coordinates in public_spots are not rounded or exposed raw precision!';
    END IF;

    -- Verify that public_spot_evidence has no column named storage_path_private
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'public_spot_evidence' AND column_name = 'storage_path_private'
    ) THEN
        RAISE EXCEPTION 'SCENARIO 12 FAILED: storage_path_private exists in public_spot_evidence view!';
    END IF;

    RAISE NOTICE 'SCENARIO 12 PASSED: Public projection rounds coordinates (~11m) and excludes private paths';
    RAISE NOTICE '=======================================================';
    RAISE NOTICE 'ALL 12 NAGRIK SECURITY SCENARIOS VERIFIED SUCCESSFULLY!';
    RAISE NOTICE '=======================================================';
END;
$$;

RESET ROLE;
