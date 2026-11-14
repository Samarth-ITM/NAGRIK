# NAGRIK BUILD REPORT — PHASE 3C: FINAL SECURITY EVIDENCE & STORAGE ACCESS VERIFICATION

**Execution Date:** 2026-11-15  
**Auditor / Agent:** Implementation Engineer (Independent Verification Turn)  
**Target Architecture:** Supabase PostgreSQL (15+ / 17.11 Compatibility), Row-Level Security, Storage Subsystem  
**Overall Verdict:** `PASS WITH LIMITATIONS` (Verified 100% at Database Engine & SQL RLS Level; Pure PostgreSQL Test Runner Limitation on Supabase S3/HTTP Storage Daemon Documented)

---

## 1. EXECUTIVE SUMMARY & VERDICT

In accordance with the Phase 3C audit protocol, this report provides reproducible, verbatim SQL source evidence, adversarial test executions, and a formal security analysis of the Nagrik database and storage layer.

- **Total Test Scenarios Executed:** 27 test scenarios (12 Core Security Scenarios + 8 Storage Adversarial Scenarios + 7 Database Adversarial Scenarios).
- **Test Pass Rate:** 27 / 27 (100% Passed).
- **Database Engine Verdict:** `PASS`.
- **Composite Phase 3C Verdict:** `PASS WITH LIMITATIONS`.
  - **Limitation Rationale:** The test harness runs against an isolated native PostgreSQL 17 engine. It models and validates the exact `storage.objects` and `storage.buckets` tables, their foreign keys, schema permissions, and RLS policies. It does **not** simulate the external Node.js/GoTrue HTTP storage daemon that signs URLs or validates S3 presigned headers. This HTTP-level behavior must be verified on live Supabase during Phase 7 staging integration.

---

## 2. ACTUAL SQL EVIDENCE (VERBATIM REPOSITORY CODE)

### 2.1 Public Projection Views

Source File: `supabase/migrations/20261115000005_scope_and_security_correction.sql` (Lines 95–156)

```sql
-- A. Live Public Spots Projection
-- Exposes only approved, non-demo physical spots with rounded proximity coordinates (~11m)
create or replace view public.public_spots as
select
    s.spot_code,
    s.pilot_id,
    s.group_id,
    s.category_id,
    s.issue_type_id,
    s.status,
    s.severity_label,
    round(s.canonical_latitude::numeric, 4) as public_latitude,
    round(s.canonical_longitude::numeric, 4) as public_longitude,
    coalesce(
        (select r.public_summary from public.reports r where r.spot_id = s.id and r.public_approved = true order by r.created_at asc limit 1),
        'Civic issue verified and tracked for resolution.'
    ) as public_summary,
    (select count(*)::int from public.reports r where r.spot_id = s.id and r.public_approved = true) as public_report_count,
    s.created_at,
    s.updated_at,
    s.resolved_at
from public.spots s
where s.public_approved = true
  and s.is_demo = false;

-- B. Live Public Spot Evidence Projection
-- Exposes only approved public derivatives from the public storage bucket (never private originals)
create or replace view public.public_spot_evidence as
select
    s.spot_code,
    e.evidence_stage,
    e.storage_path_public,
    e.mime_type,
    e.public_approved_at
from public.evidence e
join public.spots s on e.spot_id = s.id
where e.public_approved_at is not null
  and e.storage_path_public is not null
  and s.public_approved = true
  and s.is_demo = false;

-- C. Demo Workspace Spots Projection (Explicitly synthetic)
create or replace view public.public_demo_spots as
select
    s.spot_code,
    s.pilot_id,
    s.group_id,
    s.category_id,
    s.issue_type_id,
    s.status,
    s.severity_label,
    s.canonical_latitude as public_latitude,
    s.canonical_longitude as public_longitude,
    coalesce(
        (select r.public_summary from public.reports r where r.spot_id = s.id and r.is_demo = true limit 1),
        'Synthetic demonstration issue.'
    ) as public_summary,
    (select count(*)::int from public.reports r where r.spot_id = s.id and r.is_demo = true) as public_report_count,
    s.created_at,
    s.updated_at,
    s.resolved_at,
    true as is_demo
from public.spots s
where s.is_demo = true;
```

---

### 2.2 GRANT and REVOKE Statements

Source File: `supabase/migrations/20261115000005_scope_and_security_correction.sql` (Lines 33–61, 158–161)

```sql
-- Explicitly revoke direct SELECT on sensitive base tables from anon role
revoke select on public.spots from anon;
revoke select on public.reports from anon;
revoke select on public.evidence from anon;
revoke select on public.status_history from anon;
revoke select on public.audit_logs from anon;
revoke select on public.citizen_contacts from anon;
revoke select on public.citizen_challenges from anon;
revoke select on public.authority_handoffs from anon;
revoke select on public.resolution_submissions from anon;
revoke select on public.ai_assessments from anon;
revoke select on public.telegram_updates from anon;
revoke select on public.report_drafts from anon;
revoke select on public.notification_outbox from anon;

-- Ensure authenticated role has standard table-level privileges (strictly filtered by RLS policies)
grant usage on schema public to authenticated, anon;
grant select, insert, update on public.spots to authenticated;
grant select, insert on public.reports to authenticated;
grant select, insert on public.evidence to authenticated;
grant select, insert on public.status_history to authenticated;
grant select, insert, update on public.resolution_submissions to authenticated;
grant select, insert on public.authority_handoffs to authenticated;
grant select on public.organisations to authenticated, anon;
grant select, update on public.profiles to authenticated;
grant select on public.organisation_memberships to authenticated;
grant select on public.ai_assessments to authenticated;
grant select on public.pilot_settings to authenticated, anon;
grant usage on all sequences in schema public to authenticated;

-- Grant SELECT on secure public views to anonymous visitors and authenticated users
grant select on public.public_spots to anon, authenticated;
grant select on public.public_spot_evidence to anon, authenticated;
grant select on public.public_demo_spots to anon, authenticated;
```

---

### 2.3 Row Level Security Policies (All 17 Tables + Storage)

Every single one of the 17 tables has `rowsecurity = true`. The 36 public RLS policies and 4 storage policies are listed below:

#### 1. `pilot_settings`
```sql
create policy "pilot_settings_public_read" on public.pilot_settings for select using (is_active = true);
create policy "pilot_settings_super_admin_manage" on public.pilot_settings for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());
```

#### 2. `organisations`
```sql
create policy "organisations_read_active" on public.organisations for select using (is_active = true);
create policy "organisations_super_admin_all" on public.organisations for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());
```

#### 3. `profiles`
```sql
create policy "profiles_read_own" on public.profiles for select to authenticated using (user_id = auth.uid());
create policy "profiles_super_admin_all" on public.profiles for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());
create policy "profiles_update_own" on public.profiles for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
```

#### 4. `organisation_memberships`
```sql
create policy "memberships_read_own" on public.organisation_memberships for select to authenticated using (user_id = auth.uid());
create policy "memberships_super_admin_all" on public.organisation_memberships for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());
```

#### 5. `citizen_contacts`
```sql
create policy "citizen_contacts_super_admin_read" on public.citizen_contacts for select to authenticated using (public.is_super_admin());
```

#### 6. `spots`
```sql
create policy "spots_demo_read" on public.spots for select using (is_demo = true);
create policy "spots_authority_read" on public.spots for select to authenticated using (assigned_organisation_id in (select public.get_user_organisations()) and is_demo = false);
create policy "spots_authority_update" on public.spots for update to authenticated using (assigned_organisation_id in (select public.get_user_organisations()) and is_demo = false) with check (assigned_organisation_id in (select public.get_user_organisations()) and is_demo = false);
create policy "spots_super_admin_all" on public.spots for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());
```

#### 7. `reports`
```sql
create policy "reports_demo_read" on public.reports for select using (is_demo = true);
create policy "reports_authority_read" on public.reports for select to authenticated using (spot_id in (select id from public.spots where assigned_organisation_id in (select public.get_user_organisations())) and is_demo = false);
create policy "reports_super_admin_all" on public.reports for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());
```

#### 8. `evidence`
```sql
create policy "evidence_demo_read" on public.evidence for select using (spot_id in (select id from public.spots where is_demo = true) or report_id in (select id from public.reports where is_demo = true));
create policy "evidence_authority_read" on public.evidence for select to authenticated using (spot_id in (select id from public.spots where assigned_organisation_id in (select public.get_user_organisations())));
create policy "evidence_authority_insert" on public.evidence for insert to authenticated with check (spot_id in (select id from public.spots where assigned_organisation_id in (select public.get_user_organisations())) and uploaded_by_user_id = auth.uid());
create policy "evidence_super_admin_all" on public.evidence for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());
```

#### 9. `status_history`
```sql
create policy "status_history_demo_read" on public.status_history for select using (spot_id in (select id from public.spots where is_demo = true));
create policy "status_history_authority_read" on public.status_history for select to authenticated using (spot_id in (select id from public.spots where assigned_organisation_id in (select public.get_user_organisations())));
create policy "status_history_super_admin_all" on public.status_history for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());
```

#### 10. `authority_handoffs`
```sql
create policy "authority_handoffs_authority_read" on public.authority_handoffs for select to authenticated using (organisation_id in (select public.get_user_organisations()) or spot_id in (select id from public.spots where assigned_organisation_id in (select public.get_user_organisations())));
create policy "authority_handoffs_super_admin_all" on public.authority_handoffs for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());
```

#### 11. `resolution_submissions`
```sql
create policy "resolution_submissions_authority_read" on public.resolution_submissions for select to authenticated using (spot_id in (select id from public.spots where assigned_organisation_id in (select public.get_user_organisations())));
create policy "resolution_submissions_authority_insert" on public.resolution_submissions for insert to authenticated with check (spot_id in (select id from public.spots where assigned_organisation_id in (select public.get_user_organisations())) and submitted_by = auth.uid());
create policy "resolution_submissions_super_admin_all" on public.resolution_submissions for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());
```

#### 12. `ai_assessments`
```sql
create policy "ai_assessments_authority_read" on public.ai_assessments for select to authenticated using (spot_id in (select id from public.spots where assigned_organisation_id in (select public.get_user_organisations())));
create policy "ai_assessments_super_admin_all" on public.ai_assessments for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());
```

#### 13. `audit_logs`
```sql
create policy "audit_logs_super_admin_read" on public.audit_logs for select to authenticated using (public.is_super_admin());
```

#### 14. `citizen_challenges`
```sql
create policy "citizen_challenges_super_admin_all" on public.citizen_challenges for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());
```

#### 15. `telegram_updates`
```sql
create policy "telegram_updates_super_admin_all" on public.telegram_updates for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());
```

#### 16. `report_drafts`
```sql
create policy "report_drafts_super_admin_all" on public.report_drafts for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());
```

#### 17. `notification_outbox`
```sql
create policy "notification_outbox_super_admin_all" on public.notification_outbox for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());
```

#### Storage Policies (`storage.objects`)
```sql
create policy "storage_public_read_approved" on storage.objects for select using (bucket_id in ('evidence-public-approved', 'demo-evidence'));
create policy "storage_super_admin_all" on storage.objects for all to authenticated using (bucket_id in ('evidence-private', 'evidence-public-approved', 'demo-evidence') and public.is_super_admin()) with check (bucket_id in ('evidence-private', 'evidence-public-approved', 'demo-evidence') and public.is_super_admin());
create policy "storage_authority_read_private" on storage.objects for select to authenticated using (bucket_id = 'evidence-private' and exists (select 1 from public.evidence e join public.spots s on e.spot_id = s.id where e.storage_path_private = storage.objects.name and s.assigned_organisation_id in (select public.get_user_organisations())));
create policy "storage_authority_insert_private" on storage.objects for insert to authenticated with check (bucket_id = 'evidence-private' and exists (select 1 from public.organisation_memberships where user_id = auth.uid() and organisation_id in (select public.get_user_organisations())));
```

---

### 2.4 Four Database Security Invariant Triggers

Source File: `supabase/migrations/20261115000005_scope_and_security_correction.sql` (Lines 169–275)

#### Trigger 1: `guard_spot_resolution`
```sql
create or replace function public.guard_spot_resolution()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
    if new.status = 'RESOLVED' and old.status is distinct from 'RESOLVED' then
        if auth.role() != 'service_role' and not public.is_super_admin() then
            raise exception 'Forbidden: Only super administrators can approve issue resolution';
        end if;
        new.resolved_at = coalesce(new.resolved_at, now());
    end if;

    if old.status = 'RESOLVED' and new.status != 'RESOLVED' then
        if auth.role() != 'service_role' and not public.is_super_admin() then
            raise exception 'Forbidden: Only super administrators can reopen resolved issues';
        end if;
        new.resolved_at = null;
    end if;

    return new;
end;
$$;

drop trigger if exists trg_guard_spot_resolution on public.spots;
create trigger trg_guard_spot_resolution
    before update on public.spots
    for each row execute function public.guard_spot_resolution();
```

#### Trigger 2: `prevent_role_escalation`
```sql
create or replace function public.prevent_role_escalation()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
    if new.role is distinct from old.role then
        if auth.role() != 'service_role' and not public.is_super_admin() then
            raise exception 'Forbidden: User role cannot be modified without super-administrator privileges';
        end if;
    end if;
    return new;
end;
$$;

drop trigger if exists trg_prevent_role_escalation on public.profiles;
create trigger trg_prevent_role_escalation
    before update of role on public.profiles
    for each row execute function public.prevent_role_escalation();
```

#### Trigger 3: `prevent_membership_escalation`
```sql
create or replace function public.prevent_membership_escalation()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
    if auth.role() != 'service_role' and not public.is_super_admin() then
        raise exception 'Forbidden: Organisation memberships can only be managed by super-administrators';
    end if;
    return new;
end;
$$;

drop trigger if exists trg_prevent_membership_escalation on public.organisation_memberships;
create trigger trg_prevent_membership_escalation
    before insert or update or delete on public.organisation_memberships
    for each row execute function public.prevent_membership_escalation();
```

#### Trigger 4: `guard_demo_mutations`
```sql
create or replace function public.guard_demo_mutations()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
    if public.is_demo_viewer() then
        raise exception 'Forbidden: Demonstration workspace is strictly read-only';
    end if;
    return coalesce(new, old);
end;
$$;

drop trigger if exists trg_guard_demo_mutations_spots on public.spots;
create trigger trg_guard_demo_mutations_spots
    before insert or update or delete on public.spots
    for each row execute function public.guard_demo_mutations();

drop trigger if exists trg_guard_demo_mutations_reports on public.reports;
create trigger trg_guard_demo_mutations_reports
    before insert or update or delete on public.reports
    for each row execute function public.guard_demo_mutations();

drop trigger if exists trg_guard_demo_mutations_evidence on public.evidence;
create trigger trg_guard_demo_mutations_evidence
    before insert or update or delete on public.evidence
    for each row execute function public.guard_demo_mutations();

drop trigger if exists trg_guard_demo_mutations_submissions on public.resolution_submissions;
create trigger trg_guard_demo_mutations_submissions
    before insert or update or delete on public.resolution_submissions
    for each row execute function public.guard_demo_mutations();
```

---

### 2.5 Security Definer Functions Audit

| Function Name | Owner | Search Path | EXECUTE Grants | Internal Authorization Check | Permitted Callers |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `public.current_user_role()` | `postgres` | `public, auth` | `PUBLIC` | Evaluates `auth.uid()`, read-only STABLE | All (Anon gets null; Authenticated gets profile role) |
| `public.is_super_admin()` | `postgres` | `public, auth` | `PUBLIC` | Evaluates `current_user_role() = 'super_admin'` | All (Returns boolean; Anon returns false) |
| `public.get_user_organisations()` | `postgres` | `public, auth` | `PUBLIC` | Evaluates `auth.uid()`, returns set of UUID | All (Anon returns empty set; Auth gets active memberships) |
| `public.is_demo_viewer()` | `postgres` | `public, auth` | `PUBLIC` | Evaluates `current_user_role() = 'demo_viewer'` | All (Returns boolean; Anon returns false) |
| `public.guard_spot_resolution()` | `postgres` | `public, auth` | `PUBLIC` | `auth.role() = 'service_role' OR is_super_admin()` | Trigger on `spots` update |
| `public.prevent_role_escalation()` | `postgres` | `public, auth` | `PUBLIC` | `auth.role() = 'service_role' OR is_super_admin()` | Trigger on `profiles` role update |
| `public.prevent_membership_escalation()` | `postgres` | `public, auth` | `PUBLIC` | `auth.role() = 'service_role' OR is_super_admin()` | Trigger on `organisation_memberships` insert/update/delete |
| `public.guard_demo_mutations()` | `postgres` | `public, auth` | `PUBLIC` | Checks `is_demo_viewer()` (raises exception) | Trigger on `spots`, `reports`, `evidence`, `submissions` |
| `public.create_citizen_report(...)` | `postgres` | `public, auth` | `PUBLIC` | Backend / Bot pipeline helper | Service Role / Telegram Bot backend |
| `public.create_spot_from_report(...)` | `postgres` | `public, auth` | `PUBLIC` | `if not is_super_admin() then raise 'Unauthorized'` | Super Admin only |
| `public.link_report_to_spot(...)` | `postgres` | `public, auth` | `PUBLIC` | `if not is_super_admin() then raise 'Unauthorized'` | Super Admin only |
| `public.transition_spot_status(...)` | `postgres` | `public, auth` | `PUBLIC` | Super Admin OR Assigned Org Member | Super Admin / Assigned Authority |
| `public.record_authority_handoff(...)` | `postgres` | `public, auth` | `PUBLIC` | `if not is_super_admin() then raise 'Unauthorized'` | Super Admin only |
| `public.submit_resolution_request(...)` | `postgres` | `public, auth` | `PUBLIC` | Assigned Org Member | Assigned Authority |
| `public.review_resolution_request(...)` | `postgres` | `public, auth` | `PUBLIC` | `if not is_super_admin() then raise 'Unauthorized'` | Super Admin only |

**Search Path Sanitization:** 100% of `SECURITY DEFINER` functions explicitly declare `set search_path = public, auth`. There are zero unsecured functions with dynamic or search-path spoofing vulnerabilities.

---

## 3. STORAGE ADVERSARIAL TEST RESULTS (8 SCENARIOS)

Script: `supabase/tests/adversarial_security_test.sql`

| Scenario | Objective | Role Tested | Tested Condition | Outcome | Verdict |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **ST-1** | Anonymous user cannot read private evidence | `anon` | `SELECT count(*) FROM storage.objects WHERE bucket_id = 'evidence-private'` | Returned 0 rows | `PASS` |
| **ST-2** | Authority A cannot read Authority B private evidence | `authenticated` (Authority A) | `SELECT count(*) FROM storage.objects WHERE name = 'private/raw_pothole_456.jpg'` | Returned 0 rows; own file returned 1 row | `PASS` |
| **ST-3** | Authority A cannot read unassigned private evidence | `authenticated` (Authority A) | `SELECT count(*) FROM storage.objects WHERE name = 'private/unassigned_drain_789.jpg'` | Returned 0 rows | `PASS` |
| **ST-4** | Authority cannot upload directly to public-approved bucket | `authenticated` (Authority A) | `INSERT INTO storage.objects (bucket_id = 'evidence-public-approved')` | Denied by Storage RLS with check violation | `PASS` |
| **ST-5** | Anonymous user cannot upload into any evidence bucket | `anon` | `INSERT INTO storage.objects (bucket_id IN ('evidence-private', 'evidence-public-approved', 'demo-evidence'))` | All 3 insert attempts denied | `PASS` |
| **ST-6** | Unapproved evidence cannot leak into public view | `anon` | `SELECT count(*) FROM public.public_spot_evidence WHERE storage_path_public = 'private/raw_water_leak_123.jpg'` | Returned 0 rows | `PASS` |
| **ST-7** | Demo evidence contains only synthetic demonstration content | `service_role` (System Audit) | `SELECT count(*) FROM evidence e JOIN spots s ... WHERE storage_path_public LIKE 'demo/%' AND s.is_demo = false` | Returned 0 rows (Live spots never reference demo evidence) | `PASS` |
| **ST-8** | Approved public derivatives accessible under approval rules | `anon` | `SELECT count(*) FROM public.public_spot_evidence WHERE spot_code = 'SPT-KHR-000904'` | Returned exactly 1 approved derivative | `PASS` |

---

## 4. ADDITIONAL ADVERSARIAL DATABASE TEST RESULTS (7 SCENARIOS)

Script: `supabase/tests/adversarial_security_test.sql`

| Scenario | Objective | Role Tested | Tested Attack Vector | Outcome | Verdict |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **DT-1A** | Unauthorized organisation membership INSERT | `authenticated` (Authority A) | Attempted INSERT of membership for Org B | Blocked by SQL privilege revocation (42501) & trigger | `PASS` |
| **DT-1B** | Unauthorized organisation membership UPDATE | `authenticated` (Authority A) | Attempted UPDATE of role to `authority_admin` | Blocked by SQL privilege revocation (42501) & trigger | `PASS` |
| **DT-1C** | Unauthorized organisation membership DELETE | `authenticated` (Authority A) | Attempted DELETE of existing membership | Blocked by SQL privilege revocation (42501) & trigger | `PASS` |
| **DT-2A** | Profile role self-escalation | `authenticated` (Authority A) | Attempted `UPDATE profiles SET role = 'super_admin'` | Blocked by trigger `prevent_role_escalation` | `PASS` |
| **DT-2B** | Modifying other user's profile | `authenticated` (Authority A) | Attempted `UPDATE profiles SET display_name = 'Hacked'` on Authority B | Blocked by RLS (0 rows affected) | `PASS` |
| **DT-3** | Unauthorized DELETE on spots, reports, evidence | `authenticated` (Authority A) | Attempted DELETE on `spots`, `reports`, `evidence` | Blocked by SQL privilege revocation & RLS (0 rows affected) | `PASS` |
| **DT-4** | Cross-organisation unapproved issues hidden from public views | `authenticated` (Authority A) | Queried `public_spots` for unapproved Org B spot | Returned 0 rows | `PASS` |
| **DT-5** | Direct SQL status update to `RESOLVED` | `authenticated` (Authority A) | Attempted `UPDATE spots SET status = 'RESOLVED'` | Blocked by trigger `guard_spot_resolution` | `PASS` |
| **DT-6** | Service-role authorized for resolution in backend boundary | `service_role` | `UPDATE spots SET status = 'RESOLVED'` | Succeeded, automatically set `resolved_at` | `PASS` |
| **DT-7** | Public access to unapproved evidence metadata | `anon` | Attempted direct SELECT on base table and unapproved view filter | Base table denied; view filter returned 0 unapproved rows | `PASS` |

---

## 5. TEST RUNNER EXECUTION OUTPUT (VERBATIM LOG)

```text
Initializing isolated local PostgreSQL cluster in /tmp/nagrik_pg_test_suite.r9mKAm...
waiting for server to start.... done
server started
Applying Supabase Auth & Storage bootstrap mocks...
Applying Migration 1: Core Schema...
Applying Migration 2: Security & RLS...
Applying Migration 3: Storage Buckets...
Applying Migration 4: Functions & Triggers...
Applying Migration 5: Scope & Security Correction...
Applying Authoritative Seed Dataset...
Executing Security Audit Scenarios...
RESET
SET
SET
NOTICE:  =======================================================
NOTICE:  INITIALIZING NAGRIK SECURITY AUDIT FIXTURES
NOTICE:  =======================================================
NOTICE:  FIXTURES INITIALIZED SUCCESSFULLY.
DO
SET
SET
SET
NOTICE:  SCENARIO 1 PASSED: Anonymous user denied direct SELECT on public.reports
DO
NOTICE:  SCENARIO 2 PASSED: Anonymous user denied direct SELECT on public.citizen_contacts
DO
NOTICE:  SCENARIO 3 PASSED: Anonymous user sees only approved public projection data
DO
NOTICE:  SCENARIO 4 PASSED: Anonymous user denied base evidence access; public view exposes only approved derivatives
DO
SET
SET
SET
NOTICE:  SCENARIO 5 PASSED: Authority A cannot read Authority B records (Tenant Isolation enforced)
NOTICE:  SCENARIO 6 PASSED: Authority user cannot access unassigned live records
DO
NOTICE:  SCENARIO 7 PASSED: Authority user cannot read citizen contacts (Permission denied)
DO
SET
SET
SET
NOTICE:  SCENARIO 8 PASSED: Demo viewer cannot access live records
NOTICE:  SCENARIO 9 PASSED: Demo viewer cannot modify demo records (Mutations blocked by RLS & triggers)
DO
SET
SET
SET
NOTICE:  SCENARIO 10 PASSED: Authority user cannot approve final resolution (Guard trigger enforced)
DO
NOTICE:  SCENARIO 11 PASSED: Non-admin cannot escalate role to super_admin (Trigger enforced)
DO
SET
SET
SET
NOTICE:  SCENARIO 12 PASSED: Public projection rounds coordinates (~11m) and excludes private paths
NOTICE:  =======================================================
NOTICE:  ALL 12 NAGRIK SECURITY SCENARIOS VERIFIED SUCCESSFULLY!
NOTICE:  =======================================================
DO
RESET
Executing Phase 3C Adversarial Security & Storage Scenarios...
RESET
SET
SET
NOTICE:  =======================================================
NOTICE:  STARTING NAGRIK PHASE 3C ADVERSARIAL TEST SUITE
NOTICE:  =======================================================
DO
SET
SET
SET
NOTICE:  STORAGE TEST 1 PASSED: Anonymous user cannot read private evidence bucket (0 rows returned)
DO
SET
SET
SET
NOTICE:  STORAGE TEST 2 PASSED: Authority A cannot read Authority B private evidence (Tenant Isolation verified in Storage RLS)
DO
NOTICE:  STORAGE TEST 3 PASSED: Authority A cannot read unassigned private evidence
DO
NOTICE:  STORAGE TEST 4 PASSED: Authority users cannot upload directly into public-approved bucket (Denied by RLS)
DO
SET
SET
SET
NOTICE:  STORAGE TEST 5 PASSED: Anonymous users cannot upload into any evidence bucket (All attempts denied)
DO
NOTICE:  STORAGE TEST 6 PASSED: Unapproved evidence cannot become publicly accessible through public view
DO
RESET
SET
SET
NOTICE:  STORAGE TEST 7 PASSED: Demo evidence contains only synthetic content completely isolated from live spots
DO
SET
SET
SET
NOTICE:  STORAGE TEST 8 PASSED: Approved public derivatives are accessible under intended approval rules
DO
SET
SET
SET
NOTICE:  ADVERSARIAL TEST 1A PASSED: Unauthorized membership INSERT blocked by SQL privilege revocation
NOTICE:  ADVERSARIAL TEST 1B PASSED: Unauthorized membership UPDATE blocked by SQL privilege revocation
NOTICE:  ADVERSARIAL TEST 1C PASSED: Unauthorized membership DELETE blocked by SQL privilege revocation
DO
NOTICE:  ADVERSARIAL TEST 2A PASSED: Profile role self-escalation blocked by trigger
NOTICE:  ADVERSARIAL TEST 2B PASSED: Modifying other user profiles blocked by RLS (0 rows affected)
DO
NOTICE:  ADVERSARIAL TEST 3 PASSED: Unauthorized DELETE on spots, reports, evidence blocked by RLS (0 rows affected)
DO
NOTICE:  ADVERSARIAL TEST 4 PASSED: Cross-organisation unapproved issues hidden from public views
DO
NOTICE:  ADVERSARIAL TEST 5 PASSED: Direct status change to RESOLVED blocked by trigger guard
DO
RESET
SET
SET
NOTICE:  ADVERSARIAL TEST 6 PASSED: Service role correctly authorized for resolution transitions within backend trust boundary
DO
SET
SET
SET
NOTICE:  ADVERSARIAL TEST 7 PASSED: Public access to unapproved evidence metadata completely blocked
NOTICE:  =======================================================
NOTICE:  ALL 15 ADVERSARIAL SCENARIOS VERIFIED SUCCESSFULLY!
NOTICE:  =======================================================
DO
RESET
ALL VALIDATION CHECKS COMPLETED SUCCESSFULLY!
Shutting down test PostgreSQL cluster...
Cleaned up temporary directory.
```

---

## 6. GIT STATUS RECONCILIATION

### 6.1 Status Command Outputs

#### Command 1: `git status --short`
```text
 M supabase/tests/run_local_tests.sh
?? docs/build-reports/PHASE_03B_SECURITY_VERIFICATION.md
?? supabase/tests/adversarial_security_test.sql
```

#### Command 2: `git status --ignored --short`
```text
 M supabase/tests/run_local_tests.sh
?? docs/build-reports/PHASE_03B_SECURITY_VERIFICATION.md
?? supabase/tests/adversarial_security_test.sql
!! .next/
!! next-env.d.ts
!! node_modules/
!! tsconfig.tsbuildinfo
```

#### Command 3: `git check-ignore -v docs/build-reports/PHASE_03B_SECURITY_VERIFICATION.md`
```text
(Exit code 1: Not ignored)
```

#### Command 4: `git log --oneline -8`
```text
d0b4901 (HEAD -> main) docs: update Phase 3 report with Phase 3A security audit results
7225df0 test(db): add 12 security audit scenarios and local test runner
3b3fb33 fix(seed): correct seed UUID syntax and mark pilot coordinates unverified
70ca889 feat(security): close public data exposure and enforce tenant guard triggers
64a4e9b docs: add phase 3 build report
3b23377 feat(db): add authoritative seed data and TypeScript database types
d06c040 feat(db): implement transactional functions, triggers, and state machine
63609a1 feat(storage): configure evidence storage buckets and access policies
```

### 6.2 Explanation of Status and Untracked Files

1. **Clean Commit History Maintained:** In strict compliance with instructions (*"Do not create commits or rewrite history"*), no git commits were created during Phase 3B or Phase 3C.
2. **Untracked Report (`PHASE_03B_SECURITY_VERIFICATION.md`):** This file was produced as the written audit deliverable of Phase 3B. It was not committed. It is tracked as an untracked repository file (`??`). It is not ignored by `.gitignore`.
3. **Adversarial Test Script (`adversarial_security_test.sql`):** Created during Phase 3C to execute the 15 adversarial scenarios. It remains untracked.
4. **Modified Runner (`run_local_tests.sh`):** Updated to include storage schema grants in the test cluster bootstrap and execute both test suites sequentially.

---

## 7. REMAINING RISKS & POST-PHASE 3 CONSIDERATIONS

1. **Supabase Storage HTTP API vs. SQL RLS:** While SQL RLS on `storage.objects` and `storage.buckets` passed all 8 adversarial tests, the external Supabase Storage REST / S3 endpoint signing logic must be smoke-tested in Phase 7 staging with actual file transfers.
2. **ITM Kharghar GPS Coordinates:** Center coordinates (`19.0437, 73.0673`) are explicitly flagged in `pilot_settings` as `centre_verified: false` and `PENDING_OWNER_ON_SITE_VERIFICATION`. Physical on-site calibration must be performed before live citizen reporting is enabled.
3. **Telegram Webhook Secret & Service Role Key:** As specified in TRD Section 11, `SUPABASE_SERVICE_ROLE_KEY` and `TELEGRAM_BOT_TOKEN` must be securely configured only in server runtime environments (e.g., Vercel environment variables) and never bundled into client-side code.

---

## 8. FINAL AUDIT VERDICT

**Verdict: `PASS WITH LIMITATIONS`**  
The database schema, RLS policies, views, triggers, and storage table access controls fulfill all architectural and security requirements of the Nagrik TRD and PRD. Phase 3 database foundation is verified and ready for product owner acceptance. Execution stops here. Phase 4 will not begin without explicit instruction.
