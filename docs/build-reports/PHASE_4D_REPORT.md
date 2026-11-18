# PHASE 04D REPORT — Database Security & Workflow Invariant Remediation

## 1. Executive Summary
Phase 4D executes the critical database security and Spot workflow invariant remediation required before introducing citizen intake in Phase 5. Building upon the verified Phase 1 through 4C implementations, this corrective engineering phase eliminates privilege leaks on the public schema and function execution grants, establishes hardened search paths across all PostgreSQL RPCs, closes lifecycle bypass paths to the `RESOLVED` state, hardens the `create_citizen_challenge` RPC against impersonation and concurrency races, implements the required 25–50m grid discretization formula for public coordinate privacy, enforces strict resolution approval provenance and after-repair photographic evidence verification, deploys tamper-proof PL/pgSQL runtime call-stack inspection (`PG_CONTEXT`) to permanently eliminate GUC forgery and service-role privilege escalation, and enforces exact schema and signature qualification to defeat caller-controlled temporary function bypasses. All remediation is implemented through forward-only database migrations `20261115000008_security_and_invariant_remediation.sql`, `20261115000009_resolution_provenance_and_evidence_hardening.sql`, `20261115000010_resolution_call_stack_and_service_role_hardening.sql`, and `20261115000011_exact_call_stack_and_schema_qualification.sql`. A dedicated 13-scenario adversarial test suite alongside a deterministic concurrency test harness with live `pg_stat_activity` lock observation and an isolated negative-control test was authored, integrated, and verified against an isolated local PostgreSQL 17 cluster, achieving a 100% pass rate across all cumulative database, unit, and build checks.

---

## 2. Phase Scope & Authority Boundaries
- **In-Scope (Fully Executed):**
  - Forward-only database migration `20261115000008_security_and_invariant_remediation.sql`.
  - Forward-only database migration `20261115000009_resolution_provenance_and_evidence_hardening.sql`.
  - Forward-only database migration `20261115000010_resolution_call_stack_and_service_role_hardening.sql`.
  - Forward-only database migration `20261115000011_exact_call_stack_and_schema_qualification.sql`.
  - Explicit revocation of `CREATE` on schema `public` from `PUBLIC`, `anon`, and `authenticated`.
  - Explicit revocation of `EXECUTE` on all public functions from `PUBLIC` and `anon`.
  - Modification of default privileges (`ALTER DEFAULT PRIVILEGES`) to revoke function execute rights from `PUBLIC` and `anon` on all future functions.
  - Pinning of `search_path = pg_catalog, public, auth, pg_temp` across all workflow functions.
  - Elimination of the direct `HANDED_OFF -> RESOLVED` and `IN_PROGRESS -> RESOLVED` transition bypasses in `transition_spot_status`.
  - Hardening of database trigger `guard_spot_resolution` to enforce that transitions to `RESOLVED` originate strictly from `RESOLUTION_SUBMITTED` with verified, approved after-repair photographic evidence, verified human super-admin reviewer provenance, and verified PL/pgSQL call-stack execution within `public.review_resolution_request(uuid,uuid,text,text)`.
  - Hardening of `create_citizen_challenge` with row-level locking (`FOR UPDATE`), restriction to `RESOLVED` spots, 24-hour rate limiting, caller identity authorization, and partial unique indexing (`idx_citizen_challenges_active_unique`).
  - Implementation of 25–50m coordinate grid discretization formula in `public_spots` and `public_demo_spots`.
  - Database trigger `guard_resolution_submission` on `public.resolution_submissions` enforcing pending-only inserts, evidence type/stage validation, immutability of reviewed records, rejection of `service_role` resolution approvals, and blocking direct SQL mutations via exact signature and schema matching on `PG_CONTEXT`.
  - Elimination of transaction-scoped GUC vulnerability (`nagrik.authorized_review_flow`) by transitioning to tamper-proof internal call-stack validation.
  - Hardening of call stack validation against temporary schema (`pg_temp`) functions and substring spoofing attacks.
  - Automated adversarial test suite `supabase/tests/phase_04d_remediation_test.sql` (13 scenarios).
  - Deterministic concurrency verification in `supabase/tests/run_local_tests.sh` observing live `pg_stat_activity` lock waits and an isolated negative-control test proving unique index collision when row locks are disabled.
- **Strictly Excluded (Preserved for Future Phases):**
  - Implementation of Telegram bot webhook endpoint, long-polling, or webhook handlers (Phase 5).
  - Implementation of citizen intake conversational state machines or draft handling (Phase 5).
  - Reactivation of `create_report_submission` for direct citizen reports (Phase 5).
  - Google Gemini AI categorization, multi-modal analysis, or confidence scoring (Phase 6).
  - Activation of the live production geofence or boundary enforcement.
  - Introduction of new Spot statuses or modification of the 11-state Spot lifecycle.
  - Direct modification of historical migrations 1 through 7.

---

## 3. Files & Migrations Implemented
- `supabase/migrations/20261115000008_security_and_invariant_remediation.sql`: Forward-only database migration applying schema privilege revocations, default privilege alterations, function execution restrictions, pinned search paths, transition bypass closures, citizen challenge security, and coordinate discretization views.
- `supabase/migrations/20261115000009_resolution_provenance_and_evidence_hardening.sql`: Forward-only database migration enforcing resolution approval provenance, evidence stage/MIME verification, submission immutability, and protection against direct SQL mutation bypasses.
- `supabase/migrations/20261115000010_resolution_call_stack_and_service_role_hardening.sql`: Forward-only database migration enforcing internal PL/pgSQL call-stack inspection (`GET DIAGNOSTICS v_stack = PG_CONTEXT;`) to permanently eliminate GUC forgery, forbidding direct pre-approved inserts across all roles, barring `service_role` from civic resolution review and Spot resolution, and strictly requiring human super-admin accountability.
- `supabase/migrations/20261115000011_exact_call_stack_and_schema_qualification.sql`: Forward-only database migration hardening `guard_resolution_submission` and `guard_spot_resolution` with exact schema qualification and signature regex checks (`PL/pgSQL function (public\.)?review_resolution_request\(uuid,uuid,text,text\) line [0-9]+`), completely eliminating caller-controlled temporary function (`pg_temp`) substring bypasses.
- `supabase/tests/phase_04d_remediation_test.sql`: 13-scenario adversarial database test suite validating privilege denial, actor authorization, challenge constraints, resolution invariants, coordinate privacy, search path pinning, exact call stack qualification, and service-role boundary regressions.
- `supabase/tests/run_local_tests.sh`: Updated test harness incorporating Migrations 8 through 11, the Phase 4D SQL suite, deterministic concurrency verification with live `pg_stat_activity` Lock wait observation, and an isolated negative-control test.
- `supabase/tests/security_audit_test.sql`: Adjusted Scenario 12 assertions to reflect the 25–50m grid discretized coordinates.
- `supabase/tests/workflow_engine_test.sql`: Updated Test 13 and Test 25–28 to align with strict trigger-enforced resolution invariants and legitimate re-resolution workflows.
- `supabase/tests/adversarial_security_test.sql`: Updated Test 6 to verify that unverified direct resolution attempts and service_role actor attempts fail, and legitimate human super-admin after-photo resolution succeeds.
- `docs/build-reports/PHASE_4D_REPORT.md`: This comprehensive remediation and verification report.

---

## 4. Public Schema & Function Privilege Hardening
In standard PostgreSQL and default Supabase setups, schema `public` permits object creation by default roles, and functions created in `public` grant execute privileges to pseudo-role `PUBLIC`. This represents a privilege escalation vector where malicious authenticated users or attackers exploiting SQL injection could create shadowed objects or execute backend procedures directly.

Migration 8 remediates this completely through three layers of defense:
1. **Schema Creation Lockdown:** The migration executes `REVOKE CREATE ON SCHEMA public FROM PUBLIC, anon, authenticated;`, ensuring that untrusted database users cannot create tables, functions, operators, or shadowed views.
2. **Function Execution Revocation:** The migration executes `REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC, anon;`, explicitly stripping execution rights on every existing function. Grants are selectively re-applied only to authorized roles (`authenticated` and `service_role`).
3. **Default Privilege Alteration:** The migration alters default privileges via `ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON ROUTINES FROM PUBLIC, anon;`, guaranteeing that any future migration or function created in `public` automatically withholds execution permissions from unauthenticated callers.

---

## 5. Spot Lifecycle & Resolution Invariant Hardening
The PRD and TRD establish an unbreakable invariant: civic issues can only reach the `RESOLVED` state through verified human super-admin approval of an authority resolution submission supported by photographic after-repair evidence.

In earlier migrations, `transition_spot_status` permitted an administrative jump directly from `HANDED_OFF` to `RESOLVED`, and direct SQL updates on `spots` could potentially bypass the two-phase review process if not blocked by triggers. In Migration 9, a transaction-scoped GUC token (`nagrik.authorized_review_flow`) was initially introduced to restrict review status updates. However, adversarial auditing revealed that:
1. Any database caller with SQL capability could forge the token by executing `SELECT set_config('nagrik.authorized_review_flow', 'true', true);`, allowing direct SQL updates of `review_status = 'approved'` on `resolution_submissions`.
2. Migration 9 permitted `service_role` to insert pre-approved resolution submissions with an active super-admin's UUID, enabling an automated or service-role caller to bypass the human review workflow.

Migration 10 remediates these vulnerabilities comprehensively and permanently:
1. **Elimination of Transition Bypasses in `transition_spot_status`:** The transition logic enforces that `RESOLVED` can NEVER be passed as `p_new_status` to `transition_spot_status`. The only permitted transitions from `HANDED_OFF` are to `REOPENED` (when external resolution failed) or back to `ASSIGNED` / `IN_PROGRESS` (when handoff is rescinded or returned to internal workflows). Attempts to transition from `HANDED_OFF` or `IN_PROGRESS` directly to `RESOLVED` throw a fatal `Illegal status transition` exception and roll back.
2. **Absolute Prohibition of Pre-Approved Submissions:** In `guard_resolution_submission`, all inserts must have `review_status = 'pending'`. Any attempt by any role (including `service_role` and super-admins) to insert a submission with `review_status != 'pending'` is rejected immediately: `Resolution submissions must be inserted in pending status; direct creation of approved submissions is strictly prohibited`.
3. **Internal PL/pgSQL Call-Stack Inspection & Exact Schema Qualification (`PG_CONTEXT`):** Rather than relying on forgeable session settings or GUCs, `guard_resolution_submission` and `guard_spot_resolution` query the PostgreSQL C runtime interpreter call stack via `GET DIAGNOSTICS v_stack = PG_CONTEXT;`. Migration 10 initially introduced substring matching (`%review_resolution_request%`), but adversarial auditing revealed that an attacker could satisfy this check by defining a function in `pg_temp` containing `review_resolution_request` in its name. Migration 11 hardened this check to strictly enforce exact signature and schema qualification via regular expression matching: `v_stack ~ 'PL/pgSQL function (public\.)?review_resolution_request\(uuid,uuid,text,text\) line [0-9]+'` while explicitly asserting `v_stack !~ 'pg_temp'`. If an update to `review_status` or a transition of a Spot to `RESOLVED` is attempted via direct SQL, an attacker-controlled temporary schema function, or any function other than `public.review_resolution_request(uuid,uuid,text,text)`, the operation is immediately aborted: `Direct modification of review_status forbidden: submissions can only be reviewed via public.review_resolution_request(uuid,uuid,text,text)`. Because `PG_CONTEXT` is derived from internal PL/pgSQL function call frames, it cannot be forged by SQL queries, caller arguments, GUC variables, or caller-controlled schemas.
4. **Service-Role Elimination from Resolution Approvals:** In civic governance, the `service_role` is reserved for Telegram webhook ingestion and automated background tasks, never for approving physical repairs. Both `review_resolution_request()` and `guard_resolution_submission()` explicitly reject `service_role`: `Forbidden: service_role cannot review resolution submissions; human super administrator approval is required`. Approval requires an authenticated session where `auth.uid()` resolves to an active super-admin.
5. **Hardened Trigger Invariant in `guard_spot_resolution`:** The trigger executes before any `UPDATE` on `public.spots`. Whenever `new.status = 'RESOLVED'`, it enforces:
   - The prior status must strictly be `old.status = 'RESOLUTION_SUBMITTED'`.
   - The execution call stack must originate from `public.review_resolution_request(uuid,uuid,text,text)`.
   - The caller must be an authenticated human super-admin (not `service_role`).
   - There must exist an approved resolution submission in `public.resolution_submissions` (`review_status = 'approved'`) with verified reviewer attribution (`reviewed_by` referencing an active `super_admin` in `public.profiles`) and timestamp (`reviewed_at IS NOT NULL`).
   - The submission's `after_photo_evidence_id` must reference a valid record in `public.evidence` linked to that exact spot, with `evidence_stage = 'authority_after'`, `mime_type LIKE 'image/%'`, and `storage_path_private IS NOT NULL`.
6. **Submission Immutability:** Once a resolution submission has been reviewed (`old.review_status != 'pending'`), any subsequent update to that record is permanently rejected: `Reviewed resolution submissions are immutable`.

---

## 6. Citizen Challenge Hardening & Concurrency Protection
The `create_citizen_challenge` RPC enables citizens whose reported issues were marked resolved to contest the repair (e.g., "Still not fixed"). Prior to Phase 4D, the function lacked row-level concurrency locking, did not verify whether the caller was authorized to act for the citizen contact, allowed challenges against un-resolved spots, and relied solely on sequential queries for rate limiting.

Migration 8 remediates this function with rigorous controls:
1. **Actor Identity Check & Anti-Impersonation:** The function checks `auth.role()`. If the caller is not `service_role` (the Telegram bot webhook runner), the caller must be authenticated and confirmed as a super-admin (`public.is_super_admin()`). Arbitrary non-superadmin authenticated users attempting to invoke the function receive `Forbidden: Citizen challenges must be submitted through verified service-role or administrative review`.
2. **Eligibility Restriction:** The function acquires an exclusive row lock on the spot (`SELECT * FROM public.spots WHERE id = p_spot_id FOR UPDATE;`) and verifies that `v_spot.status = 'RESOLVED'`. Challenges attempted on spots in any status other than `RESOLVED` are rejected with `Illegal challenge: Citizen challenges can only be filed against RESOLVED spots`.
3. **Contact Verification & Row Locking:** The citizen contact record is locked (`SELECT * FROM public.citizen_contacts WHERE id = p_citizen_contact_id FOR UPDATE;`), preventing race conditions across concurrent sessions.
4. **24-Hour Rate Limiting & Partial Unique Index:** The function verifies that no pending or under-review challenge exists from the same citizen for the same spot within 24 hours. To guarantee integrity even in the event of concurrent database transactions, a partial unique index was added: `CREATE UNIQUE INDEX idx_citizen_challenges_active_unique ON public.citizen_challenges (spot_id, citizen_contact_id) WHERE status IN ('new', 'under_review');`. Any simultaneous collision that escapes procedural locking is deterministically rejected by PostgreSQL unique constraint enforcement.

---

## 7. Public Coordinate Discretization Privacy
TRD Section 13.3 mandates that public data projections must obscure exact physical reporting locations to prevent surveillance, targeting, or privacy degradation of citizen dwellings. A simple 4-decimal-place rounding (~11m precision) exposed near-exact coordinates.

Migration 8 dropped and recreated `public.public_spots` and `public.public_demo_spots` with a formal 25–50m grid discretization formula:
`round(round(canonical_latitude / 0.0003) * 0.0003, 4) AS public_latitude`
`round(round(canonical_longitude / 0.0003) * 0.0003, 4) AS public_longitude`

At the latitude of Kharghar (approximately 19.04° N), a step of 0.0003 degrees corresponds to approximately 33.3 meters in latitude and 31.5 meters in longitude. Snapping coordinates to this grid satisfies the TRD requirement for 25–50m spatial fuzzing while ensuring that issues clustering around the same physical asset map to identical grid points on public visual layers.

---

## 8. Pinned Search Path Hardening
To prevent object shadowing and search path injection attacks in `SECURITY DEFINER` procedures, Migrations 8 and 9 update all public workflow functions (`create_citizen_challenge`, `transition_spot_status`, `submit_resolution_request`, `review_resolution_request`, `create_spot_for_report`, `link_report_to_spot`, `find_duplicate_candidates`, `record_authority_handoff`, `guard_resolution_submission`, `guard_spot_resolution`) with:
`SET search_path = pg_catalog, public, auth, pg_temp;`

By placing `pg_catalog` first, core PostgreSQL built-ins cannot be shadowed. Including `pg_temp` last ensures temporary tables created in user sessions cannot hijack table lookups within security definer execution.

---

## 9. Multi-Tenant and Role Isolation
All Phase 3 and Phase 4 tenant isolation boundaries remain strictly enforced:
1. **Authority Isolation:** Authorities operate exclusively within issues assigned to their specific organisation (`assigned_organisation_id`). RLS policies and RPC checks prevent cross-tenant reads and mutations.
2. **Super-Admin Governance:** Super-admins hold exclusive authority over spot creation, report linking, external handoffs, resolution review, and spot reopening.
3. **Demo Workspace Containment:** Synthetic CIDCO demonstration records remain permanently watermarked (`is_demo = true`), read-only, and blocked from mutating or contaminating live workflows.

---

## 10. Verification Protocol & Invariant Audit
The end-to-end civic issue workflow operates as a strictly verified sequence:
A citizen discovers an issue and submits a report via Telegram. The backend records the report with initial review status `submitted`, private metadata, and GPS coordinates. During administrative triage, the super-admin reviews unlinked reports and searches for existing spots using deterministic Haversine distance bands. If a matching spot exists within 10 meters, the report is linked to the existing physical spot without modifying the spot's anchor. If the report represents a distinct physical issue, the super-admin creates a new spot in `VERIFIED` or `ASSIGNED` (department assigned) status. The assigned authority acknowledges the issue, transitioning it from `ASSIGNED` to `IN_PROGRESS` (or acknowledging via `AUTHORITY_ACKNOWLEDGED`). When physical repairs are completed, the authority cannot mark the issue resolved; instead, the authority submits a resolution request with mandatory after-repair photographic evidence, transitioning the spot to `RESOLUTION_SUBMITTED`. The super-admin inspects the before and after evidence. If satisfied, the super-admin approves the resolution request via `review_resolution_request()`, which sets `resolved_at` and transitions the spot to `RESOLVED`. If the repair was ineffective, a citizen who reported the issue can file a challenge within the 24-hour window, alerting governance to review and reopen the spot if necessary.

---

## 11. Test Execution & Scenario Results
All test suites were executed in an isolated local PostgreSQL 17 cluster via `./supabase/tests/run_local_tests.sh`.

```
=======================================================
NAGRIK TEST SUITE EXECUTION SUMMARY
=======================================================
Security Audit Scenarios (12 Scenarios):               12 / 12 PASSED (100%)
Adversarial Security & Storage (15 Scenarios):          15 / 15 PASSED (100%)
Workflow Engine & Invariants (30 Scenarios):           30 / 30 PASSED (100%)
Phase 4C RPC Identity Hardening (7 Scenarios):          7 / 7  PASSED (100%)
Phase 4C Simultaneous Concurrency Test:                PASSED (100%)
Phase 4D Database Security Remediation (13 Scenarios): 13 / 13 PASSED (100%)
Phase 4D Deterministic Lock Concurrency Test:          PASSED (100%)
Phase 4D Negative-Control Concurrency Test:             PASSED (100%)
Phase 4C Input Validation & Access Control (13 Tests): 13 / 13 PASSED (100%)
=======================================================
TOTAL VERIFIED AUTOMATED SCENARIOS:                    93 / 93 PASSED (100%)
=======================================================
```

### Breakdown of Phase 4D Remediation Test Scenarios:
- **Scenario 1:** Public schema creation privilege revocation verified for `anon`, `authenticated`, and `PUBLIC` roles.
- **Scenario 2:** Anonymous and public execution denial verified across all mutation RPC functions.
- **Scenario 3:** Non-superadmin authenticated caller blocked from invoking `create_citizen_challenge`.
- **Scenario 4A:** Citizen challenge rejected against `IN_PROGRESS` spot.
- **Scenario 4B:** Citizen challenge rejected against `HANDED_OFF` spot.
- **Scenario 4C:** Citizen challenge succeeded against `RESOLVED` spot.
- **Scenario 5A:** Duplicate citizen challenge from same contact on same spot rejected by 24h rate limit logic.
- **Scenario 5B:** Duplicate active challenge rejected by partial unique index `idx_citizen_challenges_active_unique`.
- **Scenario 5C:** Independent challenge from second citizen on same resolved spot succeeded.
- **Scenario 6:** Direct `HANDED_OFF -> RESOLVED` transition bypass in `transition_spot_status` rejected.
- **Scenario 7:** Direct `IN_PROGRESS -> RESOLVED` transition bypass in `transition_spot_status` rejected.
- **Scenario 8A:** Trigger blocks direct SQL transition to `RESOLVED` from `IN_PROGRESS`.
- **Scenario 8B:** Trigger blocks direct SQL transition to `RESOLVED` from `HANDED_OFF`.
- **Scenario 8C:** Trigger blocks direct SQL transition to `RESOLVED` without approved resolution submission.
- **Scenario 9:** Legitimate authority submission with after-photo followed by super-admin approval successfully resolves spot.
- **Scenario 10:** Public projection accurately applies 25–50m grid discretization formula (`0.0003` degree step).
- **Scenario 11:** Pinned search path (`pg_catalog, public, auth, pg_temp`) verified across all public workflow functions.
- **Scenario 12A:** Direct insert of approved submission rejected by `guard_resolution_submission` (pending-only inserts enforced for all roles).
- **Scenario 12B:** `service_role` execution of `review_resolution_request` rejected (strictly requires human super-admin accountability).
- **Scenario 12C:** Direct SQL mutation of `review_status` with forged GUC rejected by internal PL/pgSQL call stack guard (`PG_CONTEXT`).
- **Scenario 12D:** Direct spot transition to `RESOLVED` rejected by `guard_spot_resolution` call stack check.
- **Scenario 12E:** Legitimate `review_resolution_request()` execution by authenticated super-admin successfully transitions spot to `RESOLVED` with valid attribution.
- **Scenario 12F:** Tampering with reviewed resolution submission rejected by immutability guard.
- **Scenario 13A:** Attacker-controlled temporary function in `pg_temp` with substring name attempting `review_status` update rejected by exact call stack guard.
- **Scenario 13B:** Attacker-controlled temporary function in `pg_temp` with identical signature attempting Spot resolution rejected by schema-qualified call stack guard.
- **Scenario 13C:** `service_role` insert of pre-approved resolution submission cleanly rejected.
- **Scenario 13D:** `service_role` direct update of `review_status` cleanly rejected.
- **Scenario 13E:** `service_role` execution of `review_resolution_request` cleanly rejected.
- **Scenario 13F:** `service_role` direct Spot transition to `RESOLVED` cleanly rejected.
- **Scenario 13G:** Manufacturing reviewer identity by supplying active super-admin UUID cleanly rejected.
- **Scenario 13H:** Authenticated active super-admin successfully approves resolution and transitions Spot to `RESOLVED`.

---

## 12. Deterministic Parallel Concurrency & Negative-Control Verification
To definitively verify that procedural row locking (`FOR UPDATE`) serializes competing transactions rather than relying on unhandled unique constraint crashes, `run_local_tests.sh` executes a 7-step deterministic concurrency test alongside an isolated negative control:

### 12.1 Deterministic Positive Test Sequence
1. **Transaction Initialization & Lock Acquisition:** Session 1 opens a transaction (`BEGIN;`) and invokes `create_citizen_challenge` for Spot 81 and Contact 3. The procedure executes `SELECT * FROM public.spots WHERE id = p_spot_id FOR UPDATE;` and `SELECT * FROM public.citizen_contacts WHERE id = p_citizen_contact_id FOR UPDATE;`, acquiring exclusive row-level locks on both records.
2. **Transaction Held Open:** Session 1 deliberately remains open without committing (`COMMIT;` is withheld).
3. **Competing Session Execution:** Session 2 attempts to invoke `create_citizen_challenge` for the exact same Spot and Contact identity.
4. **Active Lock Observation via `pg_stat_activity`:** The test harness polls PostgreSQL's system view `pg_stat_activity`. It explicitly detects Session 2 blocked with `wait_event_type = 'Lock'` and `wait_event = 'transactionid'`, proving that the database kernel suspended Session 2 on Session 1's active row lock.
5. **Session 1 Commit:** The test harness issues `COMMIT;` to Session 1, releasing the row locks.
6. **Session 2 Serialization & Application Exception:** Session 2 awakens and resumes execution. Because Session 1's challenge was committed, Session 2 evaluates the 24-hour rate limit check, detects the active challenge, and cleanly raises the application exception: `Duplicate challenge: An active challenge from this citizen is already pending review`.
7. **Constraint Crash Verification:** The test harness inspects Session 2's output and explicitly verifies that zero unique constraint errors (`idx_citizen_challenges_active_unique` or PostgreSQL error 23505) were logged.

### 12.2 Isolated Negative-Control Test (Row Locks Disabled)
To prove that the test harness genuinely detects missing row locks:
1. The test harness defines `public.create_citizen_challenge_no_locks`, omitting `FOR UPDATE` on both queries.
2. Session 1 invokes the procedure within an uncommitted transaction.
3. Session 2 executes concurrently. Because no row locks are held, Session 2 evaluates `v_spam_exists = false` simultaneously before Session 1 commits.
4. Session 1 commits. Session 2 attempts insertion and immediately crashes with an unhandled database unique constraint violation: `ERROR: duplicate key value violates unique constraint "idx_citizen_challenges_active_unique"`.
5. The test harness asserts the presence of the unique constraint violation in Session 2's error log, proving that the harness reliably differentiates between clean row-lock serialization and unhandled database constraint crashes.

---

## 13. Build, Lint & Type Validation
- **TypeScript Compilation (`npx tsc --noEmit`):** Clean exit with code 0. Zero compiler errors.
- **ESLint Validation (`npm run lint`):** Clean exit with code 0. Zero warnings, zero errors.
- **Production Build (`npm run build`):** Clean exit with code 0. All 9 application routes successfully compiled and statically optimized in under 1 second.

---

## 14. Git Hygiene & Working Tree
All files modified in Phase 4D are contained within the project repository:
- `supabase/migrations/20261115000008_security_and_invariant_remediation.sql`
- `supabase/migrations/20261115000009_resolution_provenance_and_evidence_hardening.sql`
- `supabase/migrations/20261115000010_resolution_call_stack_and_service_role_hardening.sql`
- `supabase/migrations/20261115000011_exact_call_stack_and_schema_qualification.sql`
- `supabase/tests/phase_04d_remediation_test.sql`
- `supabase/tests/run_local_tests.sh`
- `supabase/tests/security_audit_test.sql`
- `supabase/tests/workflow_engine_test.sql`
- `supabase/tests/adversarial_security_test.sql`
- `docs/build-reports/PHASE_4D_REPORT.md`

Historical migrations 1 through 7 remain completely untouched. The git working tree is clean and ready for commit.

---

## 15. Known Defects, Limitations & Deferred Items
- **Telegram Bot Webhook:** The Telegram webhook endpoint and conversational state engine remain strictly deferred to Phase 5.
- **Citizen Report Creation (`create_report_submission`):** Public citizen report creation RPC remains disabled until Phase 5 intake is connected.
- **Google Gemini Integration:** AI categorization and media analysis remain strictly deferred to Phase 6.

---

## 16. Final Verdict & Certification

| Area | Requirement | Result | Verdict |
|---|---|---|---|
| Schema Privileges | Revoke CREATE on public from PUBLIC, anon, authenticated | Verified; no untrusted object creation | **VERIFIED** |
| Function Grants | Revoke EXECUTE from PUBLIC and anon; alter defaults | Verified; all protected RPCs secured | **VERIFIED** |
| Pinned Search Path | Explicit `pg_catalog, public, auth, pg_temp` | Verified across all workflow functions | **VERIFIED** |
| Resolution Invariants | Block direct transitions to RESOLVED; enforce after-photo | Verified via RPC logic and triggers | **VERIFIED** |
| Approval Provenance | Enforce human super-admin review workflow and block direct SQL mutations | Verified via runtime `PG_CONTEXT` call stack inspection | **VERIFIED** |
| Exact Call Stack Qualification | Require exact schema and signature; reject `pg_temp` and substring attacks | Verified in Migration 11 and Scenario 13A/13B | **VERIFIED** |
| Service-Role Hardening | Exclude `service_role` from civic resolution review and Spot resolution | Verified in Migrations 10/11 and Scenario 13C–13G | **VERIFIED** |
| Evidence Verification | Validate spot ownership, stage authority_after, image MIME type | Verified in submit and guard triggers | **VERIFIED** |
| Citizen Challenges | Anti-impersonation, RESOLVED-only, concurrency locks | Verified with partial unique index & row locks | **VERIFIED** |
| Deterministic Concurrency | Prove row-lock waiting via `pg_stat_activity` Lock observation | Verified in positive test; isolated in negative control | **VERIFIED** |
| Coordinate Privacy | 25–50m grid discretization formula in public views | Verified; 0.0003 degree grid active | **VERIFIED** |
| Automated Testing | 100% pass on all 93 test scenarios | 93 / 93 scenarios passed in PostgreSQL 17 | **VERIFIED** |
| Code & Build Hygiene | `tsc`, `lint`, and `next build` clean | 0 TS errors, 0 ESLint errors, clean build | **VERIFIED** |
| Single-Phase Rule | Zero Phase 5 code introduced | Strict boundaries preserved | **VERIFIED** |

**OVERALL PHASE 4D VERDICT: VERIFIED (PASS)**
Phase 4D database security, invariant remediation, exact call-stack qualification, service-role isolation, and deterministic concurrency verification are complete and fully verified. The database schema, permissions, and lifecycle triggers now strictly enforce all locked invariants, making the system fully prepared for Phase 5 Telegram bot and citizen reporting intake. Antigravity will now stop and await explicit user instruction before proceeding.
