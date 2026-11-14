# AGENTS.md — Permanent Nagrik Implementation Rules

## 1. Core Purpose
Nagrik is a civic intelligence and grievance coordination platform (Pilot: Sector 4, Kharghar). Telegram is the primary citizen reporting interface; the web application provides public transparency, super-admin governance, and organisation-scoped authority dashboards.

## 2. Authority & Scope Boundaries
- **Source of Truth:** Authoritative specifications reside in `docs/docs/` (`prd.md`, `trd.md`, `technicalscope.md`). They are strictly READ-ONLY.
- **Authority Boundaries:** The User and ChatGPT jointly control architecture, features, workflows, and scope. The Implementation Engineer executes, tests, builds, and reports without making independent product decisions.
- **No Unauthorised Scope Changes:** If an architectural or specification conflict arises, stop immediately and produce a `DECISION_REQUIRED` report. Wait for approval.

## 3. Approved Technology Stack & Architecture
- **Stack:** Single cohesive Next.js (App Router) project with React, TypeScript, Tailwind CSS, Vercel hosting, Supabase (Postgres, Auth, Storage, RLS), Telegram Bot API Webhook, and optional server-side Google Gemini.
- **No Microservices:** Strictly no Redis, Kafka, Celery, Kubernetes, or separate backends.
- **Modular Feature Architecture:** Code organized by feature (`src/features/`, `src/components/`, `src/lib/`, `src/types/`).
- **Separation of Entities:** A citizen **Report** (ticket `NAG-KHR-YYYY-XXXXXX`) and a physical **Spot** (`SPT-KHR-XXXXXX`) are distinct. Multiple reports may link to one spot; linking never deletes a report.
- **Deterministic Matching:** Haversine distance to immutable canonical spot anchor (0–5m strong candidate, >5–10m possible candidate, >10m separate spot). Never auto-merge; super-admin decides. AI is NEVER used for duplicate detection.

## 4. Security, Secrets & Privacy
- **Credentials:** Never commit secrets. Maintain placeholder names only in `.env.example`. Never create or overwrite `.env` with real credentials.
- **Secret Isolation:** Supabase service-role keys, Telegram bot tokens, and Gemini keys are server-side only. Never expose to client bundles.
- **Citizen Privacy:** No citizen accounts on the website. Store pseudonymous HMAC user hashes and AES-256-GCM encrypted Telegram chat IDs. Never expose raw citizen descriptions or private media publicly.
- **Resolution Evidence:** Authorities cannot mark issues `RESOLVED`. They submit resolution requests (`RESOLUTION_SUBMITTED`) with mandatory after-repair photos. Final approval rests exclusively with the super-admin.
- **Handoff Integrity:** `HANDED_OFF` requires actual destination, date, method, and proof. Never fabricate government references.

## 5. Organisation-Level Isolation & Demo Environment
- **Data Isolation:** Authorities access only issues explicitly assigned to their organisation enforced by server checks and database RLS.
- **CIDCO Demonstration Workspace:** Strictly synthetic (`is_demo = true`), read-only, and permanently watermarked (`DEMONSTRATION ENVIRONMENT — SAMPLE DATA — NOT CONNECTED TO CIDCO`). Demo data must never leak into live counts, public maps, or exports.

## 6. Phased Execution Protocol & Mandatory Stopping Rule
- **Execution Order:**
  - PHASE 1: Foundation and repository architecture
  - PHASE 2: Public website and illustrative experience
  - PHASE 3: Database, authentication, roles and dashboards
  - PHASE 4: Civic reporting, physical issue matching, evidence and resolution workflow
  - PHASE 5: Telegram bot and citizen reporting integration
  - PHASE 6: Optional Gemini integration
  - PHASE 7: Full testing, security and system validation
  - PHASE 8: Deployment and production verification
- **Strict Single-Phase Rule:** Implement ONLY the explicitly requested phase. Never start future phases early or roll automatically into the next phase.
- **Phase Reports:** At the end of every phase, create `docs/build-reports/PHASE_XX_REPORT.md` using the 16-point structure and approved verdicts (`VERIFIED`, `PARTIALLY VERIFIED`, `FAILED`, `BLOCKED`, `NOT TESTED`). Stop and wait for instruction.
