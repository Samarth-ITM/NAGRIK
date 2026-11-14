-- NAGRIK SCHEMA MIGRATION 3: STORAGE BUCKETS & STORAGE RLS POLICIES
-- Authority: TRD Section 11 & PRD Section 8, 10
-- Target Engine: Supabase PostgreSQL (15+) Storage Schema

-- ============================================================================
-- 1. PROVISION STORAGE BUCKETS
-- ============================================================================

-- evidence-private: Private citizen originals & authority uploads (Not publicly readable)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
    'evidence-private',
    'evidence-private',
    false,
    10485760, -- 10MB limit
    array['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'audio/ogg', 'audio/mpeg', 'audio/mp4', 'application/pdf']
)
on conflict (id) do update set
    public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- evidence-public-approved: Sanitised, super-admin-approved derivatives (Publicly readable)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
    'evidence-public-approved',
    'evidence-public-approved',
    true,
    5242880, -- 5MB limit
    array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
    public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- demo-evidence: Synthetic demonstration images completely isolated from live evidence (Publicly readable)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
    'demo-evidence',
    'demo-evidence',
    true,
    5242880, -- 5MB limit
    array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
    public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- ============================================================================
-- 2. STORAGE ROW LEVEL SECURITY POLICIES
-- ============================================================================

-- A. Public read access for public buckets
create policy "storage_public_read_approved"
    on storage.objects
    for select
    using (bucket_id in ('evidence-public-approved', 'demo-evidence'));

-- B. Super-admin full access across all storage buckets
create policy "storage_super_admin_all"
    on storage.objects
    for all
    to authenticated
    using (
        bucket_id in ('evidence-private', 'evidence-public-approved', 'demo-evidence')
        and public.is_super_admin()
    )
    with check (
        bucket_id in ('evidence-private', 'evidence-public-approved', 'demo-evidence')
        and public.is_super_admin()
    );

-- C. Authority access to private bucket:
-- Read private evidence linked to spots assigned to their organisation
create policy "storage_authority_read_private"
    on storage.objects
    for select
    to authenticated
    using (
        bucket_id = 'evidence-private'
        and exists (
            select 1 from public.evidence e
            join public.spots s on e.spot_id = s.id
            where e.storage_path_private = storage.objects.name
            and s.assigned_organisation_id in (select public.get_user_organisations())
        )
    );

-- Upload after-photo/video evidence to private bucket
create policy "storage_authority_insert_private"
    on storage.objects
    for insert
    to authenticated
    with check (
        bucket_id = 'evidence-private'
        and exists (
            select 1 from public.organisation_memberships
            where user_id = auth.uid()
            and is_active = true
            and membership_role in ('authority_admin', 'authority_operator')
        )
    );
