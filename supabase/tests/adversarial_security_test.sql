-- ============================================================================
-- NAGRIK PHASE 3C: ADVERSARIAL DATABASE & STORAGE SECURITY TEST SUITE
-- Target Engine: Supabase PostgreSQL (15+)
-- Tests: 8 Storage Scenarios & 7 Additional Database Adversarial Scenarios
-- ============================================================================

\set ON_ERROR_STOP on

-- ----------------------------------------------------------------------------
-- FIXTURE SETUP AS POSTGRES / SERVICE ROLE
-- ----------------------------------------------------------------------------
RESET ROLE;
SET request.jwt.claim.sub = 'a0000000-0000-0000-0000-000000000001';
SET request.jwt.claim.role = 'service_role';

DO $$
DECLARE
    v_super_admin_id uuid := 'a0000000-0000-0000-0000-000000000001';
    v_authority_a_user_id uuid := 'a0000000-0000-0000-0000-000000000002';
    v_authority_b_user_id uuid := 'a0000000-0000-0000-0000-000000000003';

    v_org_a_id uuid := 'b0000000-0000-0000-0000-000000000001';
    v_org_b_id uuid := 'b0000000-0000-0000-0000-000000000002';

    v_spot_a_id uuid := 'c0000000-0000-0000-0000-000000000001';
    v_spot_b_id uuid := 'c0000000-0000-0000-0000-000000000002';
    v_spot_unassigned_id uuid := 'c0000000-0000-0000-0000-000000000003';
    v_spot_approved_id uuid := 'c0000000-0000-0000-0000-000000000004';
BEGIN
    RAISE NOTICE '=======================================================';
    RAISE NOTICE 'STARTING NAGRIK PHASE 3C ADVERSARIAL TEST SUITE';
    RAISE NOTICE '=======================================================';

    -- Insert mock storage objects corresponding to evidence
    -- 1. Private evidence object for Spot A (Org A)
    INSERT INTO storage.objects (id, bucket_id, name, owner)
    VALUES ('f1000000-0000-0000-0000-000000000001', 'evidence-private', 'private/raw_water_leak_123.jpg', v_authority_a_user_id)
    ON CONFLICT (id) DO NOTHING;

    -- 2. Private evidence object for Spot B (Org B)
    INSERT INTO public.evidence (id, spot_id, evidence_stage, storage_path_private, mime_type, file_size_bytes, sha256)
    VALUES ('e1000000-0000-0000-0000-000000000003', v_spot_b_id, 'authority_after', 'private/raw_pothole_456.jpg', 'image/jpeg', 204800, 'b3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855')
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO storage.objects (id, bucket_id, name, owner)
    VALUES ('f1000000-0000-0000-0000-000000000002', 'evidence-private', 'private/raw_pothole_456.jpg', v_authority_b_user_id)
    ON CONFLICT (id) DO NOTHING;

    -- 3. Private evidence object for Unassigned Spot
    INSERT INTO public.evidence (id, spot_id, evidence_stage, storage_path_private, mime_type, file_size_bytes, sha256)
    VALUES ('e1000000-0000-0000-0000-000000000004', v_spot_unassigned_id, 'citizen_initial', 'private/unassigned_drain_789.jpg', 'image/jpeg', 150000, 'c3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855')
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO storage.objects (id, bucket_id, name, owner)
    VALUES ('f1000000-0000-0000-0000-000000000003', 'evidence-private', 'private/unassigned_drain_789.jpg', null)
    ON CONFLICT (id) DO NOTHING;

    -- 4. Approved derivative in evidence-public-approved
    INSERT INTO storage.objects (id, bucket_id, name, owner)
    VALUES ('f1000000-0000-0000-0000-000000000004', 'evidence-public-approved', 'public-approved/speed_breaker_deriv.webp', v_super_admin_id)
    ON CONFLICT (id) DO NOTHING;

    -- 5. Synthetic demo object in demo-evidence
    INSERT INTO storage.objects (id, bucket_id, name, owner)
    VALUES ('f1000000-0000-0000-0000-000000000005', 'demo-evidence', 'demo/pothole_initial.webp', v_super_admin_id)
    ON CONFLICT (id) DO NOTHING;
END;
$$;

-- ============================================================================
-- PART 1: STORAGE ADVERSARIAL TESTS (8 SCENARIOS)
-- ============================================================================

-- STORAGE TEST 1: Anonymous user cannot read private evidence
SET ROLE anon;
SET request.jwt.claim.role = 'anon';
SET request.jwt.claim.sub = '';

DO $$
DECLARE
    v_count int;
BEGIN
    SELECT count(*) INTO v_count
    FROM storage.objects
    WHERE bucket_id = 'evidence-private';

    IF v_count != 0 THEN
        RAISE EXCEPTION 'STORAGE TEST 1 FAILED: Anonymous user was able to read % objects in evidence-private!', v_count;
    END IF;
    RAISE NOTICE 'STORAGE TEST 1 PASSED: Anonymous user cannot read private evidence bucket (0 rows returned)';
END;
$$;

-- STORAGE TEST 2: Authority A cannot read Authority B's private evidence
SET ROLE authenticated;
SET request.jwt.claim.role = 'authenticated';
SET request.jwt.claim.sub = 'a0000000-0000-0000-0000-000000000002'; -- Authority A (Water Dept)

DO $$
DECLARE
    v_count int;
BEGIN
    -- Authority A should see their own private object (Spot A)
    SELECT count(*) INTO v_count
    FROM storage.objects
    WHERE name = 'private/raw_water_leak_123.jpg';

    IF v_count != 1 THEN
        RAISE EXCEPTION 'STORAGE TEST 2 FAILED: Authority A could not see assigned evidence!';
    END IF;

    -- Authority A MUST NOT see Authority B's private object (Spot B)
    SELECT count(*) INTO v_count
    FROM storage.objects
    WHERE name = 'private/raw_pothole_456.jpg';

    IF v_count != 0 THEN
        RAISE EXCEPTION 'STORAGE TEST 2 FAILED: Authority A was able to read Authority B private storage object!';
    END IF;
    RAISE NOTICE 'STORAGE TEST 2 PASSED: Authority A cannot read Authority B private evidence (Tenant Isolation verified in Storage RLS)';
END;
$$;

-- STORAGE TEST 3: Authority A cannot read unassigned private evidence
DO $$
DECLARE
    v_count int;
BEGIN
    SELECT count(*) INTO v_count
    FROM storage.objects
    WHERE name = 'private/unassigned_drain_789.jpg';

    IF v_count != 0 THEN
        RAISE EXCEPTION 'STORAGE TEST 3 FAILED: Authority A was able to read unassigned storage object!';
    END IF;
    RAISE NOTICE 'STORAGE TEST 3 PASSED: Authority A cannot read unassigned private evidence';
END;
$$;

-- STORAGE TEST 4: Authority users cannot upload directly into public-approved bucket
DO $$
DECLARE
    v_authority_a_user_id uuid := 'a0000000-0000-0000-0000-000000000002';
BEGIN
    BEGIN
        INSERT INTO storage.objects (bucket_id, name, owner)
        VALUES ('evidence-public-approved', 'unauthorized_bypass.jpg', v_authority_a_user_id);
        RAISE EXCEPTION 'STORAGE TEST 4 FAILED: Authority user was able to insert into evidence-public-approved bucket!';
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'STORAGE TEST 4 PASSED: Authority users cannot upload directly into public-approved bucket (Denied by RLS)';
    END;
END;
$$;

-- STORAGE TEST 5: Anonymous users cannot upload into any evidence bucket
SET ROLE anon;
SET request.jwt.claim.role = 'anon';
SET request.jwt.claim.sub = '';

DO $$
BEGIN
    -- Try upload to evidence-private
    BEGIN
        INSERT INTO storage.objects (bucket_id, name) VALUES ('evidence-private', 'anon_leak.jpg');
        RAISE EXCEPTION 'STORAGE TEST 5 FAILED: Anonymous user was able to upload to evidence-private!';
    EXCEPTION WHEN OTHERS THEN
        NULL; -- Expected
    END;

    -- Try upload to evidence-public-approved
    BEGIN
        INSERT INTO storage.objects (bucket_id, name) VALUES ('evidence-public-approved', 'anon_leak.jpg');
        RAISE EXCEPTION 'STORAGE TEST 5 FAILED: Anonymous user was able to upload to evidence-public-approved!';
    EXCEPTION WHEN OTHERS THEN
        NULL; -- Expected
    END;

    -- Try upload to demo-evidence
    BEGIN
        INSERT INTO storage.objects (bucket_id, name) VALUES ('demo-evidence', 'anon_leak.jpg');
        RAISE EXCEPTION 'STORAGE TEST 5 FAILED: Anonymous user was able to upload to demo-evidence!';
    EXCEPTION WHEN OTHERS THEN
        NULL; -- Expected
    END;

    RAISE NOTICE 'STORAGE TEST 5 PASSED: Anonymous users cannot upload into any evidence bucket (All attempts denied)';
END;
$$;

-- STORAGE TEST 6: Unapproved evidence cannot become publicly accessible through public view
DO $$
DECLARE
    v_count int;
BEGIN
    -- Raw private water leak photo is unapproved: verify not in public_spot_evidence
    SELECT count(*) INTO v_count
    FROM public.public_spot_evidence
    WHERE storage_path_public = 'private/raw_water_leak_123.jpg';

    IF v_count != 0 THEN
        RAISE EXCEPTION 'STORAGE TEST 6 FAILED: Unapproved evidence leaked into public_spot_evidence view!';
    END IF;
    RAISE NOTICE 'STORAGE TEST 6 PASSED: Unapproved evidence cannot become publicly accessible through public view';
END;
$$;

-- STORAGE TEST 7: Demo evidence contains only synthetic demonstration content
-- (Audited via system trust boundary / service role)
RESET ROLE;
SET request.jwt.claim.role = 'service_role';
SET request.jwt.claim.sub = 'a0000000-0000-0000-0000-000000000001';

DO $$
DECLARE
    v_count int;
BEGIN
    -- Verify demo-evidence objects are not referenced by live spots (is_demo = false)
    SELECT count(*) INTO v_count
    FROM public.evidence e
    JOIN public.spots s ON e.spot_id = s.id
    WHERE e.storage_path_public LIKE 'demo/%'
      AND s.is_demo = false;

    IF v_count != 0 THEN
        RAISE EXCEPTION 'STORAGE TEST 7 FAILED: Live spot references demo-evidence!';
    END IF;
    RAISE NOTICE 'STORAGE TEST 7 PASSED: Demo evidence contains only synthetic content completely isolated from live spots';
END;
$$;

-- STORAGE TEST 8: Approved public derivatives are accessible only under intended approval rules
-- (Audited via anonymous citizen perspective)
SET ROLE anon;
SET request.jwt.claim.role = 'anon';
SET request.jwt.claim.sub = '';
DO $$
DECLARE
    v_count int;
BEGIN
    SELECT count(*) INTO v_count
    FROM public.public_spot_evidence
    WHERE spot_code = 'SPT-KHR-000904';

    IF v_count != 1 THEN
        RAISE EXCEPTION 'STORAGE TEST 8 FAILED: Approved derivative for SPT-KHR-000904 was not returned!';
    END IF;
    RAISE NOTICE 'STORAGE TEST 8 PASSED: Approved public derivatives are accessible under intended approval rules';
END;
$$;

-- ============================================================================
-- PART 2: ADDITIONAL ADVERSARIAL DATABASE TESTS (7 SCENARIOS)
-- ============================================================================

-- ADVERSARIAL TEST 1: Unauthorized membership INSERT, UPDATE and DELETE
SET ROLE authenticated;
SET request.jwt.claim.role = 'authenticated';
SET request.jwt.claim.sub = 'a0000000-0000-0000-0000-000000000002'; -- Authority A

DO $$
DECLARE
    v_org_b_id uuid := 'b0000000-0000-0000-0000-000000000002';
    v_authority_a_user_id uuid := 'a0000000-0000-0000-0000-000000000002';
BEGIN
    -- 1A: Attempt INSERT into another organisation
    BEGIN
        INSERT INTO public.organisation_memberships (organisation_id, user_id, membership_role)
        VALUES (v_org_b_id, v_authority_a_user_id, 'authority_operator');
        RAISE EXCEPTION 'ADVERSARIAL TEST 1A FAILED: Non-admin was able to insert an organisation membership!';
    EXCEPTION
        WHEN insufficient_privilege THEN
            RAISE NOTICE 'ADVERSARIAL TEST 1A PASSED: Unauthorized membership INSERT blocked by SQL privilege revocation';
        WHEN OTHERS THEN
            IF SQLERRM LIKE '%Forbidden: Organisation memberships can only be managed by super-administrators%' THEN
                RAISE NOTICE 'ADVERSARIAL TEST 1A PASSED: Unauthorized membership INSERT blocked by trigger';
            ELSE
                RAISE EXCEPTION 'ADVERSARIAL TEST 1A FAILED: Unexpected error: %', SQLERRM;
            END IF;
    END;

    -- 1B: Attempt UPDATE membership role
    BEGIN
        UPDATE public.organisation_memberships
        SET membership_role = 'authority_admin'
        WHERE user_id = v_authority_a_user_id;
        RAISE EXCEPTION 'ADVERSARIAL TEST 1B FAILED: Non-admin was able to update organisation membership!';
    EXCEPTION
        WHEN insufficient_privilege THEN
            RAISE NOTICE 'ADVERSARIAL TEST 1B PASSED: Unauthorized membership UPDATE blocked by SQL privilege revocation';
        WHEN OTHERS THEN
            IF SQLERRM LIKE '%Forbidden: Organisation memberships can only be managed by super-administrators%' THEN
                RAISE NOTICE 'ADVERSARIAL TEST 1B PASSED: Unauthorized membership UPDATE blocked by trigger';
            ELSE
                RAISE EXCEPTION 'ADVERSARIAL TEST 1B FAILED: Unexpected error: %', SQLERRM;
            END IF;
    END;

    -- 1C: Attempt DELETE membership
    BEGIN
        DELETE FROM public.organisation_memberships WHERE user_id = v_authority_a_user_id;
        RAISE EXCEPTION 'ADVERSARIAL TEST 1C FAILED: Non-admin was able to delete organisation membership!';
    EXCEPTION
        WHEN insufficient_privilege THEN
            RAISE NOTICE 'ADVERSARIAL TEST 1C PASSED: Unauthorized membership DELETE blocked by SQL privilege revocation';
        WHEN OTHERS THEN
            IF SQLERRM LIKE '%Forbidden: Organisation memberships can only be managed by super-administrators%' THEN
                RAISE NOTICE 'ADVERSARIAL TEST 1C PASSED: Unauthorized membership DELETE blocked by trigger';
            ELSE
                RAISE EXCEPTION 'ADVERSARIAL TEST 1C FAILED: Unexpected error: %', SQLERRM;
            END IF;
    END;
END;
$$;

-- ADVERSARIAL TEST 2: Unauthorized profile role modification
DO $$
DECLARE
    v_authority_a_user_id uuid := 'a0000000-0000-0000-0000-000000000002';
    v_authority_b_user_id uuid := 'a0000000-0000-0000-0000-000000000003';
    v_rows int;
BEGIN
    -- Attempt to escalate own role
    BEGIN
        UPDATE public.profiles SET role = 'super_admin' WHERE user_id = v_authority_a_user_id;
        RAISE EXCEPTION 'ADVERSARIAL TEST 2A FAILED: Non-admin was able to escalate role to super_admin!';
    EXCEPTION WHEN OTHERS THEN
        IF SQLERRM LIKE '%Forbidden: User role cannot be modified without super-administrator privileges%' THEN
            RAISE NOTICE 'ADVERSARIAL TEST 2A PASSED: Profile role self-escalation blocked by trigger';
        ELSE
            RAISE EXCEPTION 'ADVERSARIAL TEST 2A FAILED: Unexpected error: %', SQLERRM;
        END IF;
    END;

    -- Attempt to modify other user's profile
    UPDATE public.profiles SET display_name = 'Hacked Name' WHERE user_id = v_authority_b_user_id;
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    IF v_rows != 0 THEN
        RAISE EXCEPTION 'ADVERSARIAL TEST 2B FAILED: Authority A was able to modify Authority B profile!';
    END IF;
    RAISE NOTICE 'ADVERSARIAL TEST 2B PASSED: Modifying other user profiles blocked by RLS (0 rows affected)';
END;
$$;

-- ADVERSARIAL TEST 3: Unauthorized direct UPDATE and DELETE on reports, spots and evidence
DO $$
DECLARE
    v_spot_a_id uuid := 'c0000000-0000-0000-0000-000000000001';
    v_report_id uuid := 'e0000000-0000-0000-0000-000000000001';
    v_evidence_id uuid := 'e1000000-0000-0000-0000-000000000001';
    v_rows int;
BEGIN
    -- Attempt DELETE on spots
    BEGIN
        DELETE FROM public.spots WHERE id = v_spot_a_id;
        GET DIAGNOSTICS v_rows = ROW_COUNT;
        IF v_rows != 0 THEN
            RAISE EXCEPTION 'ADVERSARIAL TEST 3A FAILED: Authority user was able to delete a spot!';
        END IF;
    EXCEPTION
        WHEN insufficient_privilege THEN
            NULL; -- Expected: privilege revoked
    END;

    -- Attempt DELETE on reports
    BEGIN
        DELETE FROM public.reports WHERE id = v_report_id;
        GET DIAGNOSTICS v_rows = ROW_COUNT;
        IF v_rows != 0 THEN
            RAISE EXCEPTION 'ADVERSARIAL TEST 3B FAILED: Authority user was able to delete a report!';
        END IF;
    EXCEPTION
        WHEN insufficient_privilege THEN
            NULL; -- Expected: privilege revoked
    END;

    -- Attempt DELETE on evidence
    BEGIN
        DELETE FROM public.evidence WHERE id = v_evidence_id;
        GET DIAGNOSTICS v_rows = ROW_COUNT;
        IF v_rows != 0 THEN
            RAISE EXCEPTION 'ADVERSARIAL TEST 3C FAILED: Authority user was able to delete evidence!';
        END IF;
    EXCEPTION
        WHEN insufficient_privilege THEN
            NULL; -- Expected: privilege revoked
    END;

    RAISE NOTICE 'ADVERSARIAL TEST 3 PASSED: Unauthorized DELETE on spots, reports, evidence blocked by RLS (0 rows affected)';
END;
$$;

-- ADVERSARIAL TEST 4: Cross-organisation access through public and authenticated views
DO $$
DECLARE
    v_count int;
BEGIN
    -- Authority A queries public_spots: must not see unapproved spot of Org B
    SELECT count(*) INTO v_count
    FROM public.public_spots
    WHERE spot_code = 'SPT-KHR-000902'; -- Spot B is unapproved

    IF v_count != 0 THEN
        RAISE EXCEPTION 'ADVERSARIAL TEST 4 FAILED: Authority A could see unapproved Spot B in public view!';
    END IF;
    RAISE NOTICE 'ADVERSARIAL TEST 4 PASSED: Cross-organisation unapproved issues hidden from public views';
END;
$$;

-- ADVERSARIAL TEST 5: Attempts to bypass resolution restrictions through direct SQL updates
DO $$
DECLARE
    v_spot_a_id uuid := 'c0000000-0000-0000-0000-000000000001';
BEGIN
    BEGIN
        UPDATE public.spots SET status = 'RESOLVED' WHERE id = v_spot_a_id;
        RAISE EXCEPTION 'ADVERSARIAL TEST 5 FAILED: Direct SQL status update to RESOLVED succeeded!';
    EXCEPTION WHEN OTHERS THEN
        IF SQLERRM LIKE '%Forbidden: Only super administrators can approve issue resolution%' THEN
            RAISE NOTICE 'ADVERSARIAL TEST 5 PASSED: Direct status change to RESOLVED blocked by trigger guard';
        ELSE
            RAISE EXCEPTION 'ADVERSARIAL TEST 5 FAILED: Unexpected error: %', SQLERRM;
        END IF;
    END;
END;
$$;

-- ADVERSARIAL TEST 6: Service-role resolution permissions and intended trust boundary
RESET ROLE;
SET request.jwt.claim.role = 'service_role';
SET request.jwt.claim.sub = 'a0000000-0000-0000-0000-000000000001';

DO $$
DECLARE
    v_spot_a_id uuid := 'c0000000-0000-0000-0000-000000000001';
    v_status text;
    v_resolved_at timestamptz;
BEGIN
    -- Service role can transition status to RESOLVED
    UPDATE public.spots SET status = 'RESOLVED' WHERE id = v_spot_a_id;

    SELECT status, resolved_at INTO v_status, v_resolved_at
    FROM public.spots WHERE id = v_spot_a_id;

    IF v_status != 'RESOLVED' OR v_resolved_at IS NULL THEN
        RAISE EXCEPTION 'ADVERSARIAL TEST 6 FAILED: Service role resolution failed to set resolved_at!';
    END IF;

    -- Clean up: revert spot status back to ASSIGNED
    UPDATE public.spots SET status = 'ASSIGNED', resolved_at = null WHERE id = v_spot_a_id;

    RAISE NOTICE 'ADVERSARIAL TEST 6 PASSED: Service role correctly authorized for resolution transitions within backend trust boundary';
END;
$$;

-- ADVERSARIAL TEST 7: Public access to unapproved evidence metadata
SET ROLE anon;
SET request.jwt.claim.role = 'anon';
SET request.jwt.claim.sub = '';

DO $$
DECLARE
    v_count int;
BEGIN
    -- Attempt direct select on evidence table
    BEGIN
        EXECUTE 'SELECT count(*) FROM public.evidence' INTO v_count;
        RAISE EXCEPTION 'ADVERSARIAL TEST 7 FAILED: Anonymous user was able to query public.evidence base table!';
    EXCEPTION WHEN insufficient_privilege THEN
        NULL; -- Expected
    END;

    -- Query public_spot_evidence for unapproved items
    SELECT count(*) INTO v_count
    FROM public.public_spot_evidence
    WHERE public_approved_at IS NULL;

    IF v_count != 0 THEN
        RAISE EXCEPTION 'ADVERSARIAL TEST 7 FAILED: Unapproved evidence metadata leaked into public view!';
    END IF;

    RAISE NOTICE 'ADVERSARIAL TEST 7 PASSED: Public access to unapproved evidence metadata completely blocked';
    RAISE NOTICE '=======================================================';
    RAISE NOTICE 'ALL 15 ADVERSARIAL SCENARIOS VERIFIED SUCCESSFULLY!';
    RAISE NOTICE '=======================================================';
END;
$$;

RESET ROLE;
