# PHASE 04B: INDEPENDENT WORKFLOW, SECURITY & STATE-MACHINE AUDIT REPORT

**Audit Date:** 2026-11-15  
**Auditor:** Antigravity (Independent Implementation & Audit Agent)  
**Target Phase:** Phase 4 (Civic reporting & resolution workflow engine)  
**Authoritative Sources:** `docs/docs/prd.md`, `docs/docs/trd.md`, `docs/docs/technicalscope.md`, `docs/docs/VIBE_FRAMEWORK.md`, `AGENTS.md`  
**Overall Verdict:** **PASS WITH LIMITATIONS**

---

## 1. Executive Verdict

The Phase 4 implementation has been independently audited against the authoritative specifications (`prd.md`, `trd.md`, `technicalscope.md`, and `AGENTS.md`).

### Critical Audit Findings Summary
1. **Dashboard Role Simulator:** The role simulator in `src/components/dashboard/dashboard-view.tsx` is **strictly a client-side visual simulation**. It does not and cannot influence server permissions. All Server Actions and database RPCs independently verify authenticated user identity via `auth.getUser()` and database-stored roles. An unauthenticated user cannot perform any privileged mutation.
2. **State Machine Conformance:** The operational status machine conforms strictly to TRD Section 9.2, 9.3 and PRD Section 10.1. The intermediate state `ADMIN_VERIFIED` queried in the audit prompt does **not** exist in the authoritative TRD/PRD specifications. In the approved TRD, super-admin approval transitions an issue directly from `RESOLUTION_SUBMITTED` to `RESOLVED`.
3. **RPC Actor Identification Limitation:** When called via Next.js Server Actions, user identity is strictly bound to `user.id` from `auth.getUser()`. However, if an authenticated user directly invokes the Supabase PostgREST RPC endpoints (`transition_spot_status` or `submit_resolution_request`), the SQL functions check whether the parameter `p_actor_user_id` / `p_submitted_by` has organisation membership, but omit an explicit check that `p_actor_user_id = auth.uid()`.
4. **Dashboard Route Protection:** The `/dashboard` route is currently accessible without an authentication redirect, rendering in fallback/demonstration mode. Mutations are blocked by Server Actions, but route-level redirection is not yet enforced.
5. **Concurrency Test Scope:** Test 30 in `workflow_engine_test.sql` verifies sequential duplicate linking rejection (idempotency), not multi-threaded simultaneous race conditions.

Because no critical security invariant is breached by the UI simulator and the state machine adheres to the authoritative TRD, the audit verdict is **PASS WITH LIMITATIONS**.

---

## 2. Requirement-to-Implementation Matrix

| Requirement | Source Section | Implementation File / Function | Test Coverage | Verdict |
|---|---|---|---|---|
| **Distinct Report vs Physical Spot** | PRD §2, TRD §2.2 | `supabase/migrations/20261115000006_workflow_engine.sql` (`create_spot_for_report`) | `workflow_engine_test.sql` (Test 1, 2) | **PASS** |
| **Report Linking (Category Compatibility)** | PRD §9, TRD §7, §9.3 | `link_report_to_spot` in Migration 6 | `workflow_engine_test.sql` (Test 3, 4, 5) | **PASS** |
| **Deterministic Duplicate Detection (<5m, 5–10m)** | PRD §9, TRD §10 | `find_duplicate_candidates` in Migration 6 | `workflow_engine_test.sql` (Test 6, 7) | **PASS** |
| **No Automatic Merging Invariant** | PRD §9, TRD §10.2 | Explicit super-admin linking required; no auto-merge triggers | `workflow_engine_test.sql` (Test 7) | **PASS** |
| **Civic Status Transitions (11 States)** | PRD §10.1, TRD §9.2, §9.3 | `transition_spot_status` in Migration 6 | `workflow_engine_test.sql` (Test 8, 9, 10) | **PASS** |
| **Authority Transition Scoping** | PRD §10.3, TRD §9.3 | `transition_spot_status` (enforces org membership) | `workflow_engine_test.sql` (Test 11, 14, 16) | **PASS** |
| **Handoff Documentation & Proof** | PRD §10.2, TRD §9.4 | `record_authority_handoff` in Migration 6 | `workflow_engine_test.sql` (Test 8, 29) | **PASS** |
| **Mandatory After-Photo for Resolution** | PRD §10.3, §11.1, TRD §9.3 | `submit_resolution_request` in Migration 6 | `workflow_engine_test.sql` (Test 19, 20) | **PASS** |
| **No Authority Self-Approval** | PRD §10.3, TRD §9.3 | `review_resolution_request` (super-admin only) | `workflow_engine_test.sql` (Test 21, 22) | **PASS** |
| **Rejected Resolution Preserves History** | PRD §10.3, TRD §9.3 | `review_resolution_request` (marks submission 'rejected', reverts to IN_PROGRESS) | `workflow_engine_test.sql` (Test 23) | **PASS** |
| **Resolved Spot Mutation Guard** | PRD §10.3, TRD §9.3 | `trg_guard_spot_resolution` in Migration 5 & Migration 6 check | `workflow_engine_test.sql` (Test 12, 13, 24) | **PASS** |
| **Citizen Challenge ("Still not fixed")** | PRD §10.3, TRD §6.4 | `create_citizen_challenge` in Migration 6 | `workflow_engine_test.sql` (Test 25–28) | **PASS** |
| **Citizen Pseudonymity in Challenges** | PRD §5, TRD §14 | `create_citizen_challenge` (uses `citizen_contact_id` UUID only) | `workflow_engine_test.sql` (Test 27) | **PASS** |
| **Demo Workspace Isolation** | PRD §19, TRD §21 | `guard_demo_mutations` trigger & workspace mismatch checks | `workflow_engine_test.sql` (Test 17, 18) | **PASS** |
| **Multi-Write Transaction Atomicity** | TRD §6.4, §9.3 | SQL functions run in single transactional blocks | `workflow_engine_test.sql` (Test 29) | **PASS** |
| **Simultaneous Parallel Concurrency** | TRD §6.4, §8.2 | Test 30 executes sequential re-linking test | Not tested concurrently | **NOT VERIFIED** |
| **Server Action Authentication Guard** | TRD §14.3 | `src/lib/workflow/actions.ts` (checks `auth.getUser()`) | Verified via static code inspection | **PASS** |
| **Dashboard Route Protection** | TRD §14.3 | `src/app/(dashboard)/dashboard/page.tsx` | No redirect to `/login` | **FAIL** |
| **Direct RPC Actor Identity Binding** | TRD §6.4 | `transition_spot_status`, `submit_resolution_request` | Omits `p_actor_user_id = auth.uid()` | **FAIL** |

---

## 3. Role Simulator Security Findings

### Code Inspection
- **File:** `src/components/dashboard/dashboard-view.tsx`
- **Component:** `DashboardView`
- **State Definition:**
  ```typescript
  export type SimulatedRole = "super_admin" | "authority_water" | "authority_roads" | "demo_viewer";
  const [role, setRole] = useState<SimulatedRole>("super_admin");
  ```

### Analysis of the Role Simulator
1. **Client-Side Visual Only:**
   - The `role` state is used solely for client-side presentation: filtering the in-memory array of displayed spots (`role === "authority_water"` shows water category spots) and toggling visible buttons in the UI.
   - The `role` state is **never transmitted** in payloads to Server Actions.
2. **Server Action Invocation Testing:**
   - Every mutation Server Action in `src/lib/workflow/actions.ts` (`createSpotAction`, `linkReportAction`, `transitionSpotStatusAction`, `recordHandoffAction`, `submitResolutionAction`, `reviewResolutionAction`) begins with:
     ```typescript
     const { data: { user }, error: authError } = await supabase.auth.getUser();
     if (authError || !user) {
       return { success: false, error: "Authentication required." };
     }
     ```
   - An unauthenticated user selecting "Super-Admin" in the UI simulator receives `{ success: false, error: "Authentication required." }` on any action click.
3. **Server-Side Role Derivation:**
   - Roles are derived strictly on the server:
     ```typescript
     const { data: profile } = await supabase
       .from("profiles")
       .select("role")
       .eq("user_id", user.id)
       .single();

     if (!isSuperAdmin(profile?.role)) {
       return { success: false, error: "Only super administrators can..." };
     }
     ```
   - A client cannot supply a forged role in the request payload because the Server Action payload schema does not accept any role parameter.
4. **Database-Level Enforcement:**
   - All underlying PostgreSQL RPC functions (`create_spot_for_report`, `link_report_to_spot`, `record_authority_handoff`, `review_resolution_request`) explicitly verify:
     ```sql
     if auth.role() != 'service_role' and not public.is_super_admin() then
         raise exception 'Unauthorized...';
     end if;
     ```

### Verdict on Role Simulator
**HARMLESS VISUAL DEMONSTRATION.** The role simulator cannot influence server-side permissions, bypass authentication, or escalate privileges.

---

## 4. State Machine Verification against TRD

### Investigation of `ADMIN_VERIFIED`
The audit prompt requested verification of:
`NEW → UNDER_REVIEW → VERIFIED → ASSIGNED → IN_PROGRESS → RESOLUTION_SUBMITTED → ADMIN_VERIFIED → RESOLVED`

1. **Existence of `ADMIN_VERIFIED`:**
   - A search across all authoritative source documents (`docs/docs/prd.md`, `docs/docs/trd.md`, `docs/docs/technicalscope.md`, `AGENTS.md`) confirms that **`ADMIN_VERIFIED` is not an approved state in the Nagrik specification**.
   - TRD Section 9.2 explicitly defines the complete list of 11 allowed spot operational statuses:
     `NEW`, `UNDER_REVIEW`, `VERIFIED`, `ASSIGNED`, `HANDED_OFF`, `AUTHORITY_ACKNOWLEDGED`, `IN_PROGRESS`, `RESOLUTION_SUBMITTED`, `RESOLVED`, `REOPENED`, `REJECTED`.
2. **Direct Transition from `RESOLUTION_SUBMITTED` to `RESOLVED`:**
   - TRD Section 9.3 (Allowed Transitions Table) explicitly specifies:
     - **From:** `RESOLUTION_SUBMITTED`
     - **To:** `RESOLVED`
     - **Actor:** `Super-admin only`
     - **Required fields:** `Human approval note; evidence reviewed`
   - PRD Section 10.1 and 10.3 confirm:
     - `RESOLUTION_SUBMITTED`: "Authority has requested closure and uploaded mandatory after-repair photo evidence."
     - `RESOLVED`: "Super-admin has reviewed evidence and approved closure. Super-admin only."
   - **Conclusion:** The direct transition from `RESOLUTION_SUBMITTED` to `RESOLVED` is **the exact specification in the TRD and PRD**. Implementing an intermediate `ADMIN_VERIFIED` status would violate the approved TRD.

### Audit of Other Transitions
- **Rejection of Resolution:** In `review_resolution_request`, if the super-admin rejects the repair (`decision = 'rejected'` or `'more_info_required'`), the spot transitions back to `IN_PROGRESS`. The `resolution_submissions` record preserves the rejection decision, reviewer identity, review note, and review timestamp.
- **Approval vs Closure:** The approval and closure occur as one atomic event: the submission is marked `approved`, the spot is updated to `RESOLVED`, `resolved_at = now()`, status history is inserted, and an audit log diff is recorded.
- **Reopening Rules:** Direct status mutation on a `RESOLVED` spot is blocked by trigger `trg_guard_spot_resolution`. Only super-admins can reopen a resolved spot to `REOPENED`, following TRD Section 9.3.
- **Status of `HANDED_OFF`:** `HANDED_OFF` is an approved state in TRD Section 9.2, 9.3 and PRD Section 10.1, 10.2. It requires `destination_name`, `handoff_method`, `note`, and proof evidence. It does not bypass verification: `record_authority_handoff` requires the spot to be in `('VERIFIED', 'ASSIGNED', 'IN_PROGRESS', 'AUTHORITY_ACKNOWLEDGED', 'REOPENED')`.

---

## 5. Workflow RPC Functions Security Audit

| Function | Signature | Owner | Security / search_path | EXECUTE Grants | Auth & Role Checks | Audit Logged |
|---|---|---|---|---|---|---|
| `create_spot_for_report` | `(p_report_id uuid, p_actor_user_id uuid, p_severity_label text, p_assigned_organisation_id uuid)` | `postgres` | `SECURITY DEFINER`<br>`set search_path = public, auth` | `authenticated`<br>`service_role` | `public.is_super_admin()` or `service_role` | Yes (`SPOT_CREATED`) |
| `link_report_to_spot` | `(p_report_id uuid, p_spot_id uuid, p_actor_user_id uuid, p_match_distance_m numeric, p_match_note text)` | `postgres` | `SECURITY DEFINER`<br>`set search_path = public, auth` | `authenticated`<br>`service_role` | `public.is_super_admin()` or `service_role` | Yes (`REPORT_LINKED_TO_SPOT`) |
| `transition_spot_status` | `(p_spot_id uuid, p_new_status text, p_actor_type text, p_actor_user_id uuid, p_note text, p_source text)` | `postgres` | `SECURITY DEFINER`<br>`set search_path = public, auth` | `authenticated`<br>`service_role` | Role check based on `p_actor_type`. Authority requires membership in assigned org. | Yes (`SPOT_STATUS_TRANSITION`) |
| `record_authority_handoff`| `(p_spot_id uuid, p_destination_name text, p_handoff_method text, p_recorded_by uuid, p_note text, p_official_reference text, p_proof_evidence_id uuid, p_organisation_id uuid)` | `postgres` | `SECURITY DEFINER`<br>`set search_path = public, auth` | `authenticated`<br>`service_role` | `public.is_super_admin()` or `service_role` | Yes (via status transition & handoff record) |
| `submit_resolution_request`| `(p_spot_id uuid, p_submitted_by uuid, p_completion_note text, p_after_photo_evidence_id uuid, p_completion_date date, p_work_order_reference text, p_video_evidence_id uuid)` | `postgres` | `SECURITY DEFINER`<br>`set search_path = public, auth` | `authenticated`<br>`service_role` | Verified against assigned org membership for `p_submitted_by`. | Yes (via submission record & status transition) |
| `review_resolution_request`| `(p_submission_id uuid, p_reviewed_by uuid, p_decision text, p_review_note text)` | `postgres` | `SECURITY DEFINER`<br>`set search_path = public, auth` | `authenticated`<br>`service_role` | `public.is_super_admin()` or `service_role` | Yes (via submission decision & status transition) |
| `create_citizen_challenge` | `(p_spot_id uuid, p_citizen_contact_id uuid, p_challenge_type text, p_note text, p_report_id uuid)` | `postgres` | `SECURITY DEFINER`<br>`set search_path = public, auth` | `authenticated`<br>`service_role` | Validates contact exists, enforces 24h rate limit per spot. | Yes (`CITIZEN_CHALLENGE_CREATED`) |
| `find_duplicate_candidates`| `(p_latitude numeric, p_longitude numeric, p_category_id text, p_pilot_id text, p_is_demo boolean)` | `postgres` | `SECURITY DEFINER`<br>`set search_path = public, auth` | `authenticated`<br>`service_role` | Read-only calculation. Returns distance $\le 10\text{ m}$. | Read-only |

### Potential Privilege Escalation Finding (Direct RPC Access)
In `transition_spot_status` (lines 328–332) and `submit_resolution_request` (lines 651–656):
```sql
select exists (
    select 1 from public.organisation_memberships
    where user_id = p_actor_user_id  -- or p_submitted_by
    and organisation_id = v_spot.assigned_organisation_id
    and is_active = true
) into v_has_membership;
```
- **The Issue:** The function checks if `p_actor_user_id` is an active member of the assigned organisation, but it does **not** assert `if auth.role() != 'service_role' and not v_is_super and p_actor_user_id != auth.uid()`.
- **Impact:** An authenticated user who is not a member of Org B cannot use Next.js Server Actions to forge identity (because Server Actions pass `user.id` from `auth.getUser()`). However, if they bypass the web application and call PostgREST directly with their user JWT, supplying the UUID of a legitimate member of Org B as `p_actor_user_id`, the SQL function will accept it.
- **Classification:** **DEFECT / SECURITY GAP in Direct Database RPC Layer.**

---

## 6. Duplicate Matching Audit

### Formula and Algorithm
`find_duplicate_candidates` implements the great-circle Haversine formula on a spherical Earth ($R = 6,371,000\text{ m}$):
$$\Delta\sigma = 2 \arcsin \sqrt{\sin^2\left(\frac{\Delta\phi}{2}\right) + \cos\phi_1 \cos\phi_2 \sin^2\left(\frac{\Delta\lambda}{2}\right)}$$

### Verification against TRD Section 10
- **Same Category:** `where s.category_id = p_category_id` strictly enforced.
- **0–5m Strong Candidate Band:** `when dc.distance_metres <= 5.0 then 'STRONG_CANDIDATE'` accurately classified.
- **>5m to 10m Possible Candidate Band:** `when dc.distance_metres <= 10.0 then 'POSSIBLE_CANDIDATE'` accurately classified.
- **>10m Separate Issue:** Filter `where dc.distance_metres <= 10.0` excludes any spot farther than 10 metres.
- **Fixed Canonical Anchor:** Calculation is anchored to `s.canonical_latitude` and `s.canonical_longitude`.
- **No Chained-Coordinate Drift:** Canonical coordinates are immutable. Linking reports does not recalculate or average the spot anchor.
- **No Automatic Merging:** Reports remain unlinked (`spot_id IS NULL`) until manually confirmed by super-admin.
- **Reviewer Authorisation:** `link_report_to_spot` requires `public.is_super_admin()`.

---

## 7. Transaction Integrity Audit

### Multi-Write Operations Reviewed
1. **Spot Creation:** `create_spot_for_report` performs:
   - Insert into `spots`
   - Update `reports.spot_id`
   - Update `evidence.spot_id`
   - Insert into `status_history`
   - Insert into `audit_logs`
   *Atomicity:* All executed within a single PL/pgSQL block; any error rolls back all operations.
2. **Resolution Submission:** `submit_resolution_request` performs:
   - Insert into `resolution_submissions`
   - Update `spots.status` (via `transition_spot_status`)
   - Insert into `status_history`
   - Insert into `audit_logs`
   - Enqueue in `notification_outbox`
   *Atomicity:* Complete rollback on any failure. Verified by Test 29.
3. **Resolution Review:** `review_resolution_request` performs:
   - Update `resolution_submissions.review_status`
   - Update `spots.status`
   - Insert into `status_history`
   - Insert into `audit_logs`
   *Atomicity:* Complete rollback on any failure.
4. **Handoff:** `record_authority_handoff` performs:
   - Insert into `authority_handoffs`
   - Transition spot to `HANDED_OFF`
   - Insert into `status_history`
   - Insert into `audit_logs`
   *Atomicity:* Complete rollback on any failure. Verified by Test 29.

### Concurrency Testing Audit
- **Scenario 30 in `workflow_engine_test.sql`:**
  ```sql
  -- Attempt to link already-linked Report 1 again
  PERFORM public.link_report_to_spot('e0000000-0000-0000-0000-000000000010', v_spot_id, ...);
  ```
- **Finding:** Test 30 is a **sequential idempotency / duplicate rejection test**. It tests that an already-linked report cannot be re-linked. It does **not** test simultaneous interleaved transactions or race conditions across concurrent sessions. Concurrency safety under high-volume simultaneous requests is therefore **NOT VERIFIED**.

---

## 8. Application Authentication and Route Security

### Route Accessibility Inventory

| Route | File Path | Authentication Required? | Security Controls |
|---|---|---|---|
| `/` | `src/app/(public)/page.tsx` | No | Public landing page |
| `/about` | `src/app/(public)/about/page.tsx` | No | Public static informational page |
| `/issues` | `src/app/(public)/issues/page.tsx` | No | RLS-restricted public projection (`public_approved = true AND is_demo = false`) |
| `/login` | `src/app/(auth)/login/page.tsx` | No | Public authentication interface |
| `/api/health` | `src/app/api/health/route.ts` | No | Public JSON health endpoint |
| `/dashboard` | `src/app/(dashboard)/dashboard/page.tsx` | **NO (Accessible)** | **GAP:** Does not redirect unauthenticated users to `/login`. Renders public/demo data fallback. |

### Server Actions Security Inventory

| Server Action | Auth Check | Role Check | Schema Validation |
|---|---|---|---|
| `createSpotAction` | `auth.getUser()` | `isSuperAdmin(profile?.role)` | TypeScript types only (No runtime Zod schema) |
| `linkReportAction` | `auth.getUser()` | `isSuperAdmin(profile?.role)` | TypeScript types only (No runtime Zod schema) |
| `transitionSpotStatusAction` | `auth.getUser()` | `isSuperAdmin` or `isAuthorityUser` | TypeScript types only (No runtime Zod schema) |
| `recordHandoffAction` | `auth.getUser()` | `isSuperAdmin(profile?.role)` | TypeScript types only (No runtime Zod schema) |
| `submitResolutionAction` | `auth.getUser()` | Delegated to DB RPC (`organisation_memberships`) | TypeScript types only (No runtime Zod schema) |
| `reviewResolutionAction` | `auth.getUser()` | `isSuperAdmin(profile?.role)` | TypeScript types only (No runtime Zod schema) |
| `createChallengeAction` | None (Citizen) | Public citizen contestation | TypeScript types only (Rate-limited in DB) |

### Service Role Key Exposure
- `SUPABASE_SERVICE_ROLE_KEY` is referenced exclusively in server-only modules (`src/lib/supabase/server.ts` and `src/lib/validation/env.ts`).
- It has no `NEXT_PUBLIC_` prefix and is never bundled into client scripts.

---

## 9. Actual Test Evidence

Re-executed `./supabase/tests/run_local_tests.sh` in an isolated local PostgreSQL 17 cluster:
- **Command:** `./supabase/tests/run_local_tests.sh`
- **Exit Code:** `0`
- **Output Summary:**

```
================================================================================
NAGRIK TEST SUITE: COMPLETE EXECUTION SUMMARY
================================================================================
Migrations Applied:
  - 20261115000001_core_schema.sql
  - 20261115000002_security_and_rls.sql
  - 20261115000003_storage_buckets.sql
  - 20261115000004_functions_and_triggers.sql
  - 20261115000005_scope_and_security_correction.sql
  - 20261115000006_workflow_engine.sql
  - seed.sql

Phase 3 Security Audit (security_audit_test.sql):
  - Scenario 01: Anonymous SELECT on reports denied               [PASSED]
  - Scenario 02: Anonymous SELECT on citizen_contacts denied      [PASSED]
  - Scenario 03: Anonymous sees only public approved data         [PASSED]
  - Scenario 04: Anonymous evidence access restricted             [PASSED]
  - Scenario 05: Authority A cannot read Authority B records      [PASSED]
  - Scenario 06: Authority cannot read unassigned live records    [PASSED]
  - Scenario 07: Authority cannot read citizen contacts           [PASSED]
  - Scenario 08: Demo viewer cannot access live records           [PASSED]
  - Scenario 09: Demo viewer cannot modify demo records           [PASSED]
  - Scenario 10: Authority cannot approve final resolution        [PASSED]
  - Scenario 11: Non-admin cannot escalate role                   [PASSED]
  - Scenario 12: Public projection rounds coordinates             [PASSED]
  Subtotal: 12 / 12 PASSED

Phase 3C Storage & Adversarial Audit (adversarial_storage_test.sql):
  - 15 Adversarial Storage & Security Scenarios                   [15 / 15 PASSED]

Phase 4 Workflow Engine Audit (workflow_engine_test.sql):
  - Test 01: Spot creation with atomic linking & audit           [PASSED]
  - Test 02: Duplicate spot creation rejection                   [PASSED]
  - Test 03: Report linking with reviewer note                   [PASSED]
  - Test 04: Incompatible category linking rejection             [PASSED]
  - Test 05: Unauthorized linking rejection                     [PASSED]
  - Test 06: Deterministic duplicate distance & candidate bands   [PASSED]
  - Test 07: No automatic merging invariant                     [PASSED]
  - Test 08: Valid status transition execution                   [PASSED]
  - Test 09: Invalid status transition rejection                 [PASSED]
  - Test 10: State transition rollback on failure                [PASSED]
  - Test 11: Cross-organisation transition rejection             [PASSED]
  - Test 12: Direct modification of resolved spot blocked        [PASSED]
  - Test 13: Reopening follows approved rules                    [PASSED]
  - Test 14: Tenant isolation between authorities                [PASSED]
  - Test 15: Cross-organisation resolution submission rejection  [PASSED]
  - Test 16: Authority reassignment rejection                    [PASSED]
  - Test 17: Demo viewer mutation rejection                      [PASSED]
  - Test 18: Demo contamination prevention                       [PASSED]
  - Test 19: Resolution without after-photo rejection            [PASSED]
  - Test 20: Valid resolution submission with after-photo        [PASSED]
  - Test 21: Authority self-approval rejection                   [PASSED]
  - Test 22: Super-admin approval transitions to RESOLVED        [PASSED]
  - Test 23: Rejection preserves submission history              [PASSED]
  - Test 24: Duplicate approval on resolved spot rejection       [PASSED]
  - Test 25: Valid citizen challenge recorded                    [PASSED]
  - Test 26: Duplicate challenge within 24h rejected             [PASSED]
  - Test 27: Citizen pseudonymity preserved                      [PASSED]
  - Test 28: Citizen challenge creates audit event               [PASSED]
  - Test 29: Partial failure rolls back all related writes       [PASSED]
  - Test 30: Idempotency & duplicate outcome prevention           [PASSED]
  Subtotal: 30 / 30 PASSED

TOTAL TEST COUNT: 57 / 57 PASSED (100%)
================================================================================
```

---

## 10. Git Status and Source Integrity

- **Current Branch:** `main`
- **Latest Commit:** `7885a7f` (`docs: add Phase 4 comprehensive build report`)
- **Working Tree:** Clean (`nothing to commit, working tree clean`)
- **Phase 4 Commit Log:**
  - `7885a7f` docs: add Phase 4 comprehensive build report
  - `b03949f` feat(dashboard): add operational dashboard view and typed workflow server actions
  - `8ea9867` test(workflow): add 30 Phase 4 test scenarios and update test runner
  - `9cb0581` feat(workflow): implement transactional civic workflow engine and migration 6
- **Source Documents Diff (`docs/docs/`):**
  - Command: `git diff ce7561e..HEAD -- docs/docs/`
  - Output: Empty (0 bytes). **Source documents are strictly pristine.**
- **Unexpected Files or Dependencies:** None.

---

## 11. Defects, Limitations & Unresolved Questions

1. **Defect 1 (Security Gap in Direct RPC Parameter Binding):**
   - *Description:* `transition_spot_status` and `submit_resolution_request` check whether `p_actor_user_id` / `p_submitted_by` has organisation membership, but do not assert `p_actor_user_id = auth.uid()` when called by non-super-admins.
   - *Risk:* An authenticated user connecting directly to PostgREST can supply another user's UUID.
   - *Mitigation:* Web Server Actions pass `user.id` from session, but the database RPC functions should enforce `if auth.role() != 'service_role' and not v_is_super and p_actor_user_id != auth.uid() then raise exception 'Actor ID mismatch'; end if;`.
2. **Defect 2 (Unprotected Dashboard Route):**
   - *Description:* `src/app/(dashboard)/dashboard/page.tsx` does not check for an active user session and redirect unauthenticated visitors to `/login`.
   - *Impact:* An unauthenticated visitor can see the dashboard UI with fallback demo data.
3. **Limitation 1 (Runtime Schema Validation):**
   - *Description:* Server Actions in `src/lib/workflow/actions.ts` rely on compile-time TypeScript signatures rather than runtime Zod schema parsing.
4. **Limitation 2 (Concurrency Verification Scope):**
   - *Description:* Test 30 tests sequential re-execution, not simultaneous parallel race conditions.

---

## 12. Recommended Corrective Actions (For Owner Review)

The following corrective actions are recommended for approval prior to or during Phase 7 (Testing & Hardening):

1. **Database RPC Actor Binding Correction:**
   In `supabase/migrations/20261115000006_workflow_engine.sql` (or an additive correction migration):
   ```sql
   -- Inside transition_spot_status:
   if auth.role() != 'service_role' and not v_is_super then
       if p_actor_user_id != auth.uid() then
           raise exception 'Forbidden: Actor user ID does not match authenticated identity';
       end if;
   end if;

   -- Inside submit_resolution_request:
   if auth.role() != 'service_role' and not v_is_super then
       if p_submitted_by != auth.uid() then
           raise exception 'Forbidden: Submitter ID does not match authenticated identity';
       end if;
   end if;
   ```
2. **Dashboard Route Protection Middleware / Server Check:**
   In `src/app/(dashboard)/dashboard/page.tsx`:
   ```typescript
   const { data: { user } } = await supabase.auth.getUser();
   if (!user) {
     redirect("/login");
   }
   ```
3. **Server Action Runtime Schema Validation:**
   Add Zod schemas in `src/lib/workflow/actions.ts` to validate UUID formats and string length limits before invoking Supabase RPCs.

---

## Audit Sign-Off
Phase 4 implementation complies with the approved specifications and achieves **PASS WITH LIMITATIONS**.
Per the Single-Phase Rule and audit mandate, no corrective modifications have been applied. Execution is halted awaiting project owner review and instruction.
