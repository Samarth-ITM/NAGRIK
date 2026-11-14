# PHASE 03B: INDEPENDENT SECURITY VERIFICATION & EVIDENCE AUDIT

## 1. Executive Verdict
**PASS**

The independent security verification and evidence audit of the Nagrik Phase 3 / Phase 3A implementation is complete. All 10 authoritative source files were inspected directly, and the complete schema, RLS policies, storage configuration, security triggers, and 12 security test scenarios were executed against an isolated, native PostgreSQL 17.11 instance.

All critical security boundaries claimed in Phase 3A are objectively verified:
1. **Public Data Boundary:** Direct `SELECT` on all 13 private/internal base tables is revoked from role `anon`. Public consumption is strictly channeled through 3 dedicated projection views (`public_spots`, `public_spot_evidence`, `public_demo_spots`). Citizen private descriptions, contact foreign keys, internal UUIDs, reviewer notes, and exact cm-level GPS coordinates are completely excluded. Public coordinates are rounded to 4 decimal places (~11m proximity).
2. **Authority Tenant Isolation:** Authority users are strictly scoped via `assigned_organisation_id in (select public.get_user_organisations())`. Authority A cannot read or modify Authority B's records or unassigned live records. Authority users have zero access to citizen contacts.
3. **Privilege Escalation & Invariants:** Triggers intercept and prevent role escalation on `profiles`, unauthorized membership modification on `organisation_memberships`, unauthorized resolution approval (`RESOLVED`) on `spots`, and any mutation by `demo_viewer` users. Identity checks inspect `auth.role()` and `public.is_super_admin()` to prevent `SECURITY DEFINER` context bypasses.
4. **Scope Control & Pilot Guard:** Application workflow RPC functions remain deferred outside active migrations in `supabase/deferred_workflows/deferred_workflow_functions.sql`. Pilot coordinates remain unverified with `production_geofence_active: false`.

---

## 2. Files Inspected Directly
1. [supabase/migrations/20261115000001_core_schema.sql](file:///Users/samarth/Downloads/STUFF/WORK/Personal/NAGRIK/supabase/migrations/20261115000001_core_schema.sql) (341 lines) — Sequences, 17 tables, check constraints, composite performance indexes.
2. [supabase/migrations/20261115000002_security_and_rls.sql](file:///Users/samarth/Downloads/STUFF/WORK/Personal/NAGRIK/supabase/migrations/20261115000002_security_and_rls.sql) (450 lines) — RLS activation, helper functions, and base policies.
3. [supabase/migrations/20261115000003_storage_buckets.sql](file:///Users/samarth/Downloads/STUFF/WORK/Personal/NAGRIK/supabase/migrations/20261115000003_storage_buckets.sql) (104 lines) — Storage bucket provisioning (`evidence-private`, `evidence-public-approved`, `demo-evidence`) and storage RLS.
4. [supabase/migrations/20261115000004_functions_and_triggers.sql](file:///Users/samarth/Downloads/STUFF/WORK/Personal/NAGRIK/supabase/migrations/20261115000004_functions_and_triggers.sql) (922 lines) — `handle_updated_at` trigger, code generators (`generate_ticket_code`, `generate_spot_code`).
5. [supabase/migrations/20261115000005_scope_and_security_correction.sql](file:///Users/samarth/Downloads/STUFF/WORK/Personal/NAGRIK/supabase/migrations/20261115000005_scope_and_security_correction.sql) (288 lines) — Scope correction, base table revocations, 3 public projection views, and 4 security invariant triggers.
6. [supabase/seed.sql](file:///Users/samarth/Downloads/STUFF/WORK/Personal/NAGRIK/supabase/seed.sql) (473 lines) — Pilot settings with unverified geofence guard, CIDCO demo authority (`is_demo = true`), 12 synthetic demo spots (`SPT-KHR-000101` to `SPT-KHR-000112`), and valid hex UUID fixtures.
7. [supabase/tests/security_audit_test.sql](file:///Users/samarth/Downloads/STUFF/WORK/Personal/NAGRIK/supabase/tests/security_audit_test.sql) (361 lines) — 12 automated security scenario assertions using realistic PostgreSQL role switches (`SET ROLE anon`, `SET ROLE authenticated`).
8. [supabase/tests/run_local_tests.sh](file:///Users/samarth/Downloads/STUFF/WORK/Personal/NAGRIK/supabase/tests/run_local_tests.sh) (103 lines) — Automated local PostgreSQL test runner script with isolated cluster lifecycle management.
9. [supabase/deferred_workflows/deferred_workflow_functions.sql](file:///Users/samarth/Downloads/STUFF/WORK/Personal/NAGRIK/supabase/deferred_workflows/deferred_workflow_functions.sql) (140 lines) — Preserved definitions of 8 application workflow RPCs deferred to Phases 4 and 5.
10. [src/types/database.ts](file:///Users/samarth/Downloads/STUFF/WORK/Personal/NAGRIK/src/types/database.ts) (789 lines) — Complete TypeScript definitions matching the active database schema, views, and functions.

---

## 3. Actual Public View SQL and Grants

### A. View Definitions
```sql
-- 1. Live Public Spots Projection
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

-- 2. Live Public Spot Evidence Projection
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

-- 3. Synthetic Demo Workspace Projection
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

### B. Revocations & Grants
```sql
-- Revoke direct SELECT on base tables from anon
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

-- Grant SELECT exclusively on safe public views
grant select on public.public_spots to anon, authenticated;
grant select on public.public_spot_evidence to anon, authenticated;
grant select on public.public_demo_spots to anon, authenticated;
```

### C. Security Analysis of Views
- **Column Allowlist:** Every column is explicitly named. No `SELECT *` is used.
- **Sensitive Fields Excluded:** Internal `id` (UUID), `citizen_contact_id`, `description_private`, `matched_by`, `match_note`, `matched_at`, `telegram_update_id`, `storage_path_private`, `uploaded_by_user_id`, `uploaded_by_contact_id`, and `assigned_organisation_id` are completely excluded.
- **Coordinate Sanitisation:** Raw `canonical_latitude` and `canonical_longitude` are sanitized with `round(..., 4)` (~11.1m precision at Kharghar latitude), preventing exact centimeter-level anchor triangulation while preserving map rendering accuracy.
- **Tenant Bypass Check:** An authority user querying `public_spots` only sees records where `public_approved = true AND is_demo = false`. They cannot view unapproved issues, private descriptions, or routing details of other departments.

---

## 4. Table-by-Table RLS and Privilege Audit

| Table | RLS Status | Active Policies | Anonymous Access | Authenticated Citizen | Authority Access | Super-Admin Access | Service-Role Access |
|---|---|---|---|---|---|---|---|
| `organisations` | Enabled | `organisations_read_active`, `organisations_super_admin_all` | Read active | Read active | Read active | Full CRUD | Full CRUD (BypassRLS) |
| `profiles` | Enabled | `profiles_read_own`, `profiles_update_own`, `profiles_super_admin_all` | No access | Read/Update own profile (role trigger-guarded) | Read/Update own profile (role trigger-guarded) | Full CRUD | Full CRUD |
| `organisation_memberships` | Enabled | `memberships_read_own`, `memberships_super_admin_all` | No access | Read own | Read own (mutations trigger-guarded) | Full CRUD | Full CRUD |
| `citizen_contacts` | Enabled | `citizen_contacts_super_admin_read` | Denied | Denied | Denied (0 rows) | Read only | Full CRUD |
| `spots` | Enabled | `spots_demo_read`, `spots_authority_read`, `spots_authority_update`, `spots_super_admin_all` | Denied (Revoked) | Denied | Scoped to assigned organisation (resolution trigger-guarded) | Full CRUD | Full CRUD |
| `reports` | Enabled | `reports_demo_read`, `reports_authority_read`, `reports_super_admin_all` | Denied (Revoked) | Denied | Scoped to reports on assigned spots | Full CRUD | Full CRUD |
| `evidence` | Enabled | `evidence_demo_read`, `evidence_authority_read`, `evidence_authority_insert`, `evidence_super_admin_all` | Denied (Revoked) | Denied | Scoped to evidence on assigned spots; insert after-photos | Full CRUD | Full CRUD |
| `status_history` | Enabled | `status_history_demo_read`, `status_history_authority_read`, `status_history_super_admin_all` | Denied (Revoked) | Denied | Scoped to history on assigned spots | Full CRUD | Full CRUD |
| `audit_logs` | Enabled | `audit_logs_super_admin_read` | Denied (Revoked) | Denied | Denied | Read only (No UPDATE/DELETE) | Full CRUD |
| `authority_handoffs` | Enabled | `authority_handoffs_authority_read`, `authority_handoffs_super_admin_all` | Denied (Revoked) | Denied | Scoped to assigned spots or destination org | Full CRUD | Full CRUD |
| `resolution_submissions` | Enabled | `resolution_submissions_authority_read`, `resolution_submissions_authority_insert`, `resolution_submissions_super_admin_all` | Denied (Revoked) | Denied | Scoped to assigned spots; insert own submissions | Full CRUD | Full CRUD |
| `ai_assessments` | Enabled | `ai_assessments_authority_read`, `ai_assessments_super_admin_all` | Denied (Revoked) | Denied | Scoped to assigned spots (advisory only) | Full CRUD | Full CRUD |
| `telegram_updates` | Enabled | `telegram_updates_super_admin_all` | Denied (Revoked) | Denied | Denied | Full access | Full CRUD |
| `report_drafts` | Enabled | `report_drafts_super_admin_all` | Denied (Revoked) | Denied | Denied | Full access | Full CRUD |
| `citizen_challenges` | Enabled | `citizen_challenges_super_admin_all` | Denied (Revoked) | Denied | Denied | Full access | Full CRUD |
| `notification_outbox` | Enabled | `notification_outbox_super_admin_all` | Denied (Revoked) | Denied | Denied | Full access | Full CRUD |
| `pilot_settings` | Enabled | `pilot_settings_public_read`, `pilot_settings_super_admin_manage` | Read active | Read active | Read active | Full CRUD | Full CRUD |

---

## 5. SECURITY DEFINER and Privilege Audit

All security helper functions and triggers were audited for `search_path`, parameter safety, and caller verification:

1. **`public.current_user_role()`**
   - Signature: `returns text`
   - Security: `security definer`, `set search_path = public, auth`
   - Parameter Safety: Takes no arguments. Reads `auth.uid()` from verified JWT context.
   - Recursion Safety: Queries `public.profiles` as owner (`postgres`), avoiding RLS recursion.
2. **`public.is_super_admin()`**
   - Signature: `returns boolean`
   - Security: `security definer`, `set search_path = public, auth`
   - Parameter Safety: Takes no arguments. Checks `current_user_role() = 'super_admin'`.
3. **`public.get_user_organisations()`**
   - Signature: `returns setof uuid`
   - Security: `security definer`, `set search_path = public, auth`
   - Parameter Safety: Takes no arguments. Selects `organisation_id` for verified `auth.uid()` where `is_active = true`.
4. **`public.is_demo_viewer()`**
   - Signature: `returns boolean`
   - Security: `security definer`, `set search_path = public, auth`
   - Parameter Safety: Takes no arguments. Checks `current_user_role() = 'demo_viewer'`.

---

## 6. Storage Policy Audit

| Bucket | Visibility | Max Size | Allowed MIME Types | SELECT Policy | INSERT Policy | UPDATE / DELETE Policies |
|---|---|---|---|---|---|---|
| `evidence-private` | **Private** (`public = false`) | 10 MB | JPEG, PNG, WEBP, MP4, OGG, MP3, PDF | Super-admin OR Authority user where object path matches private evidence on assigned spot | Active authority members (`authority_admin`, `authority_operator`) OR Super-admin | Super-admin only |
| `evidence-public-approved` | **Public** (`public = true`) | 5 MB | JPEG, PNG, WEBP | Unrestricted public read (`bucket_id = 'evidence-public-approved'`) | Super-admin only | Super-admin only |
| `demo-evidence` | **Public** (`public = true`) | 5 MB | JPEG, PNG, WEBP | Unrestricted public read (`bucket_id = 'demo-evidence'`) | Super-admin only | Super-admin only |

- **Cross-Organisation Evidence Privacy:** `storage_authority_read_private` requires:
  `EXISTS (SELECT 1 FROM public.evidence e JOIN public.spots s ON e.spot_id = s.id WHERE e.storage_path_private = storage.objects.name AND s.assigned_organisation_id IN (SELECT public.get_user_organisations()))`.
  An authority user cannot read another department's private uploads.
- **Original Evidence Protection:** Original citizen photos and authority repair photos are placed strictly in `evidence-private`. The public bucket holds only sanitized derivative assets approved by the super-admin.

---

## 7. Trigger and Invariant Audit

All 4 security triggers were inspected for caller context handling under Supabase authentication:

1. **`trg_guard_spot_resolution` on `public.spots`:**
   - Intercepts: `BEFORE UPDATE OF status`
   - Check: `if new.status = 'RESOLVED' and old.status is distinct from 'RESOLVED' then if auth.role() != 'service_role' and not public.is_super_admin() then raise exception ...`
   - Verification: An authority user calling `UPDATE spots SET status = 'RESOLVED'` has `auth.role() = 'authenticated'` and `is_super_admin() = false`. The trigger throws an exception.
2. **`trg_prevent_role_escalation` on `public.profiles`:**
   - Intercepts: `BEFORE UPDATE OF role`
   - Check: `if new.role is distinct from old.role then if auth.role() != 'service_role' and not public.is_super_admin() then raise exception ...`
   - Verification: An authenticated non-admin attempting `UPDATE profiles SET role = 'super_admin'` is blocked.
3. **`trg_prevent_membership_escalation` on `public.organisation_memberships`:**
   - Intercepts: `BEFORE INSERT OR UPDATE OR DELETE`
   - Check: `if auth.role() != 'service_role' and not public.is_super_admin() then raise exception ...`
   - Verification: Direct client mutations on memberships are blocked.
4. **`trg_guard_demo_mutations` on `spots`, `reports`, `evidence`, `resolution_submissions`:**
   - Intercepts: `BEFORE INSERT OR UPDATE OR DELETE`
   - Check: `if public.is_demo_viewer() then raise exception ...`
   - Verification: Demo viewers are strictly constrained to read-only access.

---

## 8. PostgreSQL Runtime Execution Output

Verbatim test execution log from isolated native PostgreSQL 17.11 cluster:

```text
Initializing isolated local PostgreSQL cluster in /tmp/nagrik_pg_test_suite.h2G3tW...
waiting for server to start.... done
server started
Applying Supabase Auth & Storage bootstrap mocks...
Applying Migration 1: Core Schema...
Applying Migration 2: Security & RLS...
Applying Migration 3: Storage Buckets...
Applying Migration 4: Functions & Triggers...
Applying Migration 5: Scope & Security Correction...
psql:supabase/migrations/20261115000005_scope_and_security_correction.sql:64: NOTICE:  policy "spots_authority_update" for relation "public.spots" does not exist, skipping
psql:supabase/migrations/20261115000005_scope_and_security_correction.sql:79: NOTICE:  policy "profiles_update_own" for relation "public.profiles" does not exist, skipping
psql:supabase/migrations/20261115000005_scope_and_security_correction.sql:194: NOTICE:  trigger "trg_guard_spot_resolution" for relation "public.spots" does not exist, skipping
psql:supabase/migrations/20261115000005_scope_and_security_correction.sql:216: NOTICE:  trigger "trg_prevent_role_escalation" for relation "public.profiles" does not exist, skipping
psql:supabase/migrations/20261115000005_scope_and_security_correction.sql:236: NOTICE:  trigger "trg_prevent_membership_escalation" for relation "public.organisation_memberships" does not exist, skipping
psql:supabase/migrations/20261115000005_scope_and_security_correction.sql:256: NOTICE:  trigger "trg_guard_demo_mutations_spots" for relation "public.spots" does not exist, skipping
psql:supabase/migrations/20261115000005_scope_and_security_correction.sql:261: NOTICE:  trigger "trg_guard_demo_mutations_reports" for relation "public.reports" does not exist, skipping
psql:supabase/migrations/20261115000005_scope_and_security_correction.sql:266: NOTICE:  trigger "trg_guard_demo_mutations_evidence" for relation "public.evidence" does not exist, skipping
psql:supabase/migrations/20261115000005_scope_and_security_correction.sql:271: NOTICE:  trigger "trg_guard_demo_mutations_submissions" for relation "public.resolution_submissions" does not exist, skipping
Applying Authoritative Seed Dataset...
Executing Security Audit Scenarios...
RESET
SET
SET
psql:supabase/tests/security_audit_test.sql:105: NOTICE:  =======================================================
psql:supabase/tests/security_audit_test.sql:105: NOTICE:  INITIALIZING NAGRIK SECURITY AUDIT FIXTURES
psql:supabase/tests/security_audit_test.sql:105: NOTICE:  =======================================================
psql:supabase/tests/security_audit_test.sql:105: NOTICE:  FIXTURES INITIALIZED SUCCESSFULLY.
DO
SET
SET
SET
psql:supabase/tests/security_audit_test.sql:123: NOTICE:  SCENARIO 1 PASSED: Anonymous user denied direct SELECT on public.reports
DO
psql:supabase/tests/security_audit_test.sql:137: NOTICE:  SCENARIO 2 PASSED: Anonymous user denied direct SELECT on public.citizen_contacts
DO
psql:supabase/tests/security_audit_test.sql:158: NOTICE:  SCENARIO 3 PASSED: Anonymous user sees only approved public projection data
DO
psql:supabase/tests/security_audit_test.sql:182: NOTICE:  SCENARIO 4 PASSED: Anonymous user denied base evidence access; public view exposes only approved derivatives
DO
SET
SET
SET
psql:supabase/tests/security_audit_test.sql:218: NOTICE:  SCENARIO 5 PASSED: Authority A cannot read Authority B records (Tenant Isolation enforced)
psql:supabase/tests/security_audit_test.sql:218: NOTICE:  SCENARIO 6 PASSED: Authority user cannot access unassigned live records
DO
psql:supabase/tests/security_audit_test.sql:237: NOTICE:  SCENARIO 7 PASSED: Authority user cannot read citizen contacts (Permission denied)
DO
SET
SET
SET
psql:supabase/tests/security_audit_test.sql:278: NOTICE:  SCENARIO 8 PASSED: Demo viewer cannot access live records
psql:supabase/tests/security_audit_test.sql:278: NOTICE:  SCENARIO 9 PASSED: Demo viewer cannot modify demo records (Mutations blocked by RLS & triggers)
DO
SET
SET
SET
psql:supabase/tests/security_audit_test.sql:302: NOTICE:  SCENARIO 10 PASSED: Authority user cannot approve final resolution (Guard trigger enforced)
DO
psql:supabase/tests/security_audit_test.sql:322: NOTICE:  SCENARIO 11 PASSED: Non-admin cannot escalate role to super_admin (Trigger enforced)
DO
SET
SET
SET
psql:supabase/tests/security_audit_test.sql:359: NOTICE:  SCENARIO 12 PASSED: Public projection rounds coordinates (~11m) and excludes private paths
psql:supabase/tests/security_audit_test.sql:359: NOTICE:  =======================================================
psql:supabase/tests/security_audit_test.sql:359: NOTICE:  ALL 12 NAGRIK SECURITY SCENARIOS VERIFIED SUCCESSFULLY!
psql:supabase/tests/security_audit_test.sql:359: NOTICE:  =======================================================
DO
RESET
ALL VALIDATION CHECKS COMPLETED SUCCESSFULLY!
Shutting down test PostgreSQL cluster...
Cleaned up temporary directory.
```

- **Exit Code:** `0`
- **Total Scenarios Executed:** 12 of 12.
- **Total Scenarios Passed:** 12 of 12 (100%).
- **Total Scenarios Skipped:** 0.

---

## 9. Individual Security Scenario Audit

| Scenario # | Tested Boundary | Role Context | Actual Test Mechanism | Result |
|---|---|---|---|---|
| **1** | Anonymous user cannot read private reports | `SET ROLE anon` | Direct `SELECT count(*) FROM public.reports` &rarr; caught `insufficient_privilege` | **PASSED** |
| **2** | Anonymous user cannot read citizen contacts | `SET ROLE anon` | Direct `SELECT count(*) FROM public.citizen_contacts` &rarr; caught `insufficient_privilege` | **PASSED** |
| **3** | Anonymous user can only read approved public projection | `SET ROLE anon` | `SELECT` on `public.public_spots` returned approved spot `SPT-KHR-000904`, returned 0 for unapproved spot `SPT-KHR-000901` | **PASSED** |
| **4** | Anonymous user cannot access private evidence | `SET ROLE anon` | Direct `SELECT` on `evidence` denied; `public_spot_evidence` returned only approved derivative | **PASSED** |
| **5** | Authority A cannot read Authority B records | `SET ROLE authenticated` (`sub: Authority A`) | Querying spots where `assigned_organisation_id = Org B` returned 0 rows (RLS enforced) | **PASSED** |
| **6** | Authority user cannot access unassigned live records | `SET ROLE authenticated` (`sub: Authority A`) | Querying spots where `assigned_organisation_id IS NULL` returned 0 rows (RLS enforced) | **PASSED** |
| **7** | Authority user cannot read citizen identity | `SET ROLE authenticated` (`sub: Authority A`) | Direct query on `citizen_contacts` denied (caught `insufficient_privilege` / 0 rows) | **PASSED** |
| **8** | Demo viewer cannot read live records | `SET ROLE authenticated` (`sub: Demo Viewer`) | Querying spots where `is_demo = false` returned 0 rows (RLS enforced) | **PASSED** |
| **9** | Demo viewer cannot modify demo records | `SET ROLE authenticated` (`sub: Demo Viewer`) | `UPDATE` returned 0 rows updated; `INSERT` threw trigger exception | **PASSED** |
| **10** | Authority user cannot approve final resolution | `SET ROLE authenticated` (`sub: Authority A`) | `UPDATE spots SET status = 'RESOLVED'` threw trigger exception `Forbidden: Only super administrators can approve issue resolution` | **PASSED** |
| **11** | Non-admin cannot escalate role to super-admin | `SET ROLE authenticated` (`sub: Authority A`) | `UPDATE profiles SET role = 'super_admin'` threw trigger exception `Forbidden: User role cannot be modified without super-administrator privileges` | **PASSED** |
| **12** | Public projection does not expose private coordinates or paths | `SET ROLE anon` | Verified `public_spots` coordinates rounded to 4 decimals (19.0469, 73.0691); verified `storage_path_private` column absent in `public_spot_evidence` | **PASSED** |

---

## 10. Missing Tests & Unresolved Risks

### A. Test Suite Limitations
1. **Mock Storage Layer in Local PostgreSQL:** The test script runs against standard PostgreSQL 17 with a schema mock of `storage.buckets` and `storage.objects`. It validates SQL RLS policies on `storage.objects` directly, but does not simulate Supabase Storage S3/HTTP signed URL signing.
2. **Citizen Self-Access Scope:** Citizens in Nagrik interact exclusively via Telegram Bot (pseudonymous reporting) without web user accounts. Thus, no citizen web login RLS policies exist (by design per TRD Section 6 and PRD Section 8).
3. **View Updatability:** PostgreSQL automatically treats views with aggregates (`count(*)`) or subqueries as non-updatable. Direct `INSERT`, `UPDATE`, or `DELETE` on `public.public_spots` is prohibited by the PostgreSQL engine.

### B. Unresolved Operational Risks
1. **Pilot Geofence Verification:**
   - *Current Centre:* `19.0475000, 73.0699000` (Approximate Sector 4 ITM campus perimeter).
   - *Verification Status:* `PENDING_OWNER_ON_SITE_VERIFICATION`.
   - *Requirement:* The project owner must physically pin the ITM main public pedestrian entrance with high-accuracy GPS (accuracy < 5m) before activating live production geofencing.
2. **Remote Supabase Application:** Migrations have been validated in a local PostgreSQL 17 environment; applying them to a remote Supabase production project remains unperformed (by design, awaiting deployment phase).

---

## 11. Git Status Audit
- **Current Branch:** `main`
- **Current Commit:** `d0b4901` (`docs: update Phase 3 report with Phase 3A security audit results`)
- **Working Tree Status:** Clean (`nothing to commit, working tree clean`)
- **Phase 3A Commits Verified in History:**
  - `70ca889` — `feat(security): close public data exposure and enforce tenant guard triggers`
  - `3b3fb33` — `fix(seed): correct seed UUID syntax and mark pilot coordinates unverified`
  - `7225df0` — `test(db): add 12 security audit scenarios and local test runner`
  - `d0b4901` — `docs: update Phase 3 report with Phase 3A security audit results`
- **Source Documents:** Authoritative documents in `docs/docs/` (`prd.md`, `trd.md`, `technicalscope.md`) remain untouched and read-only.

---

## 12. Evidence-Based Final Verdict
**PASS**

All 12 security test scenarios execute and pass with zero warnings or skipped tests on native PostgreSQL 17. The public data exposure vulnerability is closed via dedicated projection views with rounded coordinates, tenant isolation is enforced by both RLS policies and database triggers, application workflows remain cleanly deferred, and the working tree is clean.
