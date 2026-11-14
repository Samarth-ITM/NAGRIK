-- NAGRIK SEED DATA
-- Authority: TRD Section 6, 21 & PRD Section 10, 11
-- Target Engine: Supabase PostgreSQL (15+)

-- ============================================================================
-- 1. PILOT SETTINGS
-- ============================================================================
insert into public.pilot_settings (
    id,
    pilot_name,
    anchor_description,
    centre_latitude,
    centre_longitude,
    radius_m,
    is_active,
    settings_payload
)
values (
    'kharghar_itm_v1',
    'Sector 4, Kharghar (ITM Pilot)',
    'ITM Skills University Campus Perimeter, Kharghar, Navi Mumbai',
    19.0475000,
    73.0699000,
    500,
    true,
    jsonb_build_object(
        'reopen_window_days', 30,
        'candidate_search_radius_m', 10,
        'strong_candidate_m', 5,
        'accuracy_threshold_m', 20,
        'allow_voice_notes', true,
        'require_citizen_consent', true
    )
)
on conflict (id) do update set
    pilot_name = excluded.pilot_name,
    anchor_description = excluded.anchor_description,
    centre_latitude = excluded.centre_latitude,
    centre_longitude = excluded.centre_longitude,
    radius_m = excluded.radius_m,
    is_active = excluded.is_active,
    settings_payload = excluded.settings_payload;

-- ============================================================================
-- 2. DEMO ORGANISATION (CIDCO — DEMO ONLY)
-- Strict Rule: is_demo = true, permanently marked as synthetic demo authority.
-- ============================================================================
insert into public.organisations (
    id,
    name,
    slug,
    organisation_type,
    is_demo,
    is_active
)
values (
    'd0000000-0000-0000-0000-000000000001',
    'CIDCO — DEMO ONLY',
    'cidco-demo',
    'demo_authority',
    true,
    true
)
on conflict (slug) do update set
    name = excluded.name,
    organisation_type = excluded.organisation_type,
    is_demo = excluded.is_demo,
    is_active = excluded.is_active;

-- ============================================================================
-- 3. SYNTHETIC DEMO CITIZEN CONTACT
-- ============================================================================
insert into public.citizen_contacts (
    id,
    telegram_user_hash,
    encrypted_chat_id,
    language,
    consent_version,
    consent_at
)
values (
    'd0000000-0000-0000-0000-000000000002',
    'demo_citizen_hash_synthetic_kharghar',
    'demo_aes256_synthetic_chat_id',
    'en',
    'v1.0',
    '2026-10-20T00:00:00Z'
)
on conflict (telegram_user_hash) do update set
    language = excluded.language;

-- ============================================================================
-- 4. 12 SYNTHETIC DEMO SPOTS (MATCHING TRD SECTION 21.2 & DEMO CATALOGUE)
-- ============================================================================
insert into public.spots (
    id,
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
    is_demo,
    created_at,
    updated_at,
    resolved_at
)
values
    -- 1. Road-surface pothole
    (
        'd1000000-0000-0000-0000-000000000101',
        'SPT-KHR-000101',
        'kharghar_itm_v1',
        'roads_mobility',
        'road_surface',
        'pothole',
        19.0478000,
        73.0702000,
        3.5,
        'IN_PROGRESS',
        'high',
        'd0000000-0000-0000-0000-000000000001',
        true,
        true,
        '2026-11-08T09:15:00Z',
        '2026-11-13T14:30:00Z',
        null
    ),
    -- 2. Broken footpath
    (
        'd1000000-0000-0000-0000-000000000102',
        'SPT-KHR-000102',
        'kharghar_itm_v1',
        'roads_mobility',
        'footpaths_pedestrian',
        'broken_missing_paving',
        19.0482000,
        73.0694000,
        4.0,
        'VERIFIED',
        'medium',
        'd0000000-0000-0000-0000-000000000001',
        true,
        true,
        '2026-11-10T11:20:00Z',
        '2026-11-12T10:00:00Z',
        null
    ),
    -- 3. Damaged speed breaker
    (
        'd1000000-0000-0000-0000-000000000103',
        'SPT-KHR-000103',
        'kharghar_itm_v1',
        'roads_mobility',
        'road_safety_assets',
        'damaged_speed_breaker',
        19.0469000,
        73.0691000,
        3.0,
        'RESOLUTION_SUBMITTED',
        'high',
        'd0000000-0000-0000-0000-000000000001',
        true,
        true,
        '2026-11-05T08:00:00Z',
        '2026-11-14T16:45:00Z',
        null
    ),
    -- 4. Open excavation trench
    (
        'd1000000-0000-0000-0000-000000000104',
        'SPT-KHR-000104',
        'kharghar_itm_v1',
        'roads_mobility',
        'road_obstructions_open_works',
        'open_excavation_trench',
        19.0489000,
        73.0708000,
        5.0,
        'UNDER_REVIEW',
        'high',
        'd0000000-0000-0000-0000-000000000001',
        true,
        true,
        '2026-11-14T07:45:00Z',
        '2026-11-14T08:30:00Z',
        null
    ),
    -- 5. Illegal garbage dump
    (
        'd1000000-0000-0000-0000-000000000105',
        'SPT-KHR-000105',
        'kharghar_itm_v1',
        'waste_cleanliness_drainage',
        'garbage_waste_collection',
        'garbage_accumulation',
        19.0461000,
        73.0715000,
        3.0,
        'RESOLVED',
        'medium',
        'd0000000-0000-0000-0000-000000000001',
        true,
        true,
        '2026-10-28T14:10:00Z',
        '2026-11-04T12:00:00Z',
        '2026-11-04T12:00:00Z'
    ),
    -- 6. Blocked roadside drain
    (
        'd1000000-0000-0000-0000-000000000106',
        'SPT-KHR-000106',
        'kharghar_itm_v1',
        'waste_cleanliness_drainage',
        'drains_stormwater',
        'blocked_drain',
        19.0471000,
        73.0685000,
        4.0,
        'ASSIGNED',
        'high',
        'd0000000-0000-0000-0000-000000000001',
        true,
        true,
        '2026-11-09T10:30:00Z',
        '2026-11-13T11:15:00Z',
        null
    ),
    -- 7. Broken drain cover
    (
        'd1000000-0000-0000-0000-000000000107',
        'SPT-KHR-000107',
        'kharghar_itm_v1',
        'waste_cleanliness_drainage',
        'drains_stormwater',
        'broken_missing_drain_cover',
        19.0485000,
        73.0688000,
        3.0,
        'NEW',
        'medium',
        'd0000000-0000-0000-0000-000000000001',
        true,
        true,
        '2026-11-15T01:10:00Z',
        '2026-11-15T01:10:00Z',
        null
    ),
    -- 8. Streetlight pole exposed cable
    (
        'd1000000-0000-0000-0000-000000000108',
        'SPT-KHR-000108',
        'kharghar_itm_v1',
        'utilities_lighting_greenery',
        'street_lighting_electrical',
        'exposed_damaged_cable',
        19.0479000,
        73.0712000,
        2.5,
        'IN_PROGRESS',
        'high',
        'd0000000-0000-0000-0000-000000000001',
        true,
        true,
        '2026-11-11T18:20:00Z',
        '2026-11-14T09:40:00Z',
        null
    ),
    -- 9. Water pipeline leakage
    (
        'd1000000-0000-0000-0000-000000000109',
        'SPT-KHR-000109',
        'kharghar_itm_v1',
        'utilities_lighting_greenery',
        'water_supply_public_taps',
        'water_pipeline_leakage',
        19.0465000,
        73.0701000,
        3.0,
        'RESOLVED',
        'high',
        'd0000000-0000-0000-0000-000000000001',
        true,
        true,
        '2026-11-01T07:15:00Z',
        '2026-11-03T16:00:00Z',
        '2026-11-03T16:00:00Z'
    ),
    -- 10. Fallen tree branch
    (
        'd1000000-0000-0000-0000-000000000110',
        'SPT-KHR-000110',
        'kharghar_itm_v1',
        'utilities_lighting_greenery',
        'trees_green_spaces',
        'fallen_branch_tree',
        19.0492000,
        73.0697000,
        4.0,
        'RESOLVED',
        'medium',
        'd0000000-0000-0000-0000-000000000001',
        true,
        true,
        '2026-10-25T16:40:00Z',
        '2026-10-27T11:00:00Z',
        '2026-10-27T11:00:00Z'
    ),
    -- 11. Streetlight not working
    (
        'd1000000-0000-0000-0000-000000000111',
        'SPT-KHR-000111',
        'kharghar_itm_v1',
        'utilities_lighting_greenery',
        'street_lighting_electrical',
        'streetlight_not_working',
        19.0486000,
        73.0705000,
        3.5,
        'VERIFIED',
        'medium',
        'd0000000-0000-0000-0000-000000000001',
        true,
        true,
        '2026-11-12T19:50:00Z',
        '2026-11-13T09:10:00Z',
        null
    ),
    -- 12. Overflowing public dumpster
    (
        'd1000000-0000-0000-0000-000000000112',
        'SPT-KHR-000112',
        'kharghar_itm_v1',
        'waste_cleanliness_drainage',
        'garbage_waste_collection',
        'overflowing_public_bin',
        19.0470000,
        73.0718000,
        3.0,
        'UNDER_REVIEW',
        'medium',
        'd0000000-0000-0000-0000-000000000001',
        true,
        true,
        '2026-11-14T15:30:00Z',
        '2026-11-15T00:30:00Z',
        null
    )
on conflict (spot_code) do update set
    status = excluded.status,
    canonical_latitude = excluded.canonical_latitude,
    canonical_longitude = excluded.canonical_longitude,
    public_approved = excluded.public_approved,
    is_demo = excluded.is_demo;

-- ============================================================================
-- 5. SYNTHETIC DEMO EVIDENCE
-- ============================================================================
insert into public.evidence (
    id,
    spot_id,
    evidence_stage,
    storage_path_private,
    storage_path_public,
    mime_type,
    file_size_bytes,
    sha256,
    public_approved_at
)
values
    -- Initial photo for pothole
    (
        'de000000-0000-0000-0000-000000000001',
        'd1000000-0000-0000-0000-000000000101',
        'citizen_initial',
        'demo/pothole_initial.webp',
        'demo/pothole_initial.webp',
        'image/webp',
        142850,
        'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
        now()
    ),
    -- After photo for resolved garbage accumulation
    (
        'de000000-0000-0000-0000-000000000002',
        'd1000000-0000-0000-0000-000000000105',
        'authority_after',
        'demo/garbage_after.webp',
        'demo/garbage_after.webp',
        'image/webp',
        185420,
        'f3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b866',
        now()
    ),
    -- After photo for resolved water pipeline
    (
        'de000000-0000-0000-0000-000000000003',
        'd1000000-0000-0000-0000-000000000109',
        'authority_after',
        'demo/waterpipe_after.webp',
        'demo/waterpipe_after.webp',
        'image/webp',
        167890,
        'a3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b877',
        now()
    )
on conflict (id) do nothing;

-- ============================================================================
-- 6. SYNTHETIC DEMO STATUS HISTORY
-- ============================================================================
insert into public.status_history (
    id,
    spot_id,
    previous_status,
    new_status,
    actor_type,
    note,
    source,
    created_at
)
values
    (
        'dh000000-0000-0000-0000-000000000001',
        'd1000000-0000-0000-0000-000000000101',
        'NEW',
        'VERIFIED',
        'super_admin',
        'Verified spot location and severity from citizen photo.',
        'admin_dashboard',
        '2026-11-09T10:00:00Z'
    ),
    (
        'dh000000-0000-0000-0000-000000000002',
        'd1000000-0000-0000-0000-000000000101',
        'VERIFIED',
        'ASSIGNED',
        'super_admin',
        'Assigned to CIDCO Demonstration Authority.',
        'admin_dashboard',
        '2026-11-10T12:00:00Z'
    ),
    (
        'dh000000-0000-0000-0000-000000000003',
        'd1000000-0000-0000-0000-000000000101',
        'ASSIGNED',
        'IN_PROGRESS',
        'authority_user',
        'Repair team mobilised with cold-mix asphalt.',
        'authority_dashboard',
        '2026-11-13T14:30:00Z'
    ),
    (
        'dh000000-0000-0000-0000-000000000004',
        'd1000000-0000-0000-0000-000000000105',
        'RESOLUTION_SUBMITTED',
        'RESOLVED',
        'super_admin',
        'Inspected and confirmed: waste cleared completely and sanitised.',
        'admin_dashboard',
        '2026-11-04T12:00:00Z'
    )
on conflict (id) do nothing;
