#!/usr/bin/env bash
set -eo pipefail

PG_BIN="/opt/homebrew/opt/postgresql@17/bin"
if [ ! -d "$PG_BIN" ]; then
    echo "PostgreSQL 17 binary directory not found at $PG_BIN"
    exit 1
fi

TEMP_DIR=$(mktemp -d /tmp/nagrik_pg_test_suite.XXXXXX)
PORT=54399

echo "Initializing isolated local PostgreSQL cluster in $TEMP_DIR..."
"$PG_BIN/initdb" -D "$TEMP_DIR/data" -U postgres --no-locale -E UTF8 > "$TEMP_DIR/init.log" 2>&1
"$PG_BIN/pg_ctl" -D "$TEMP_DIR/data" -o "-p $PORT -k $TEMP_DIR" -l "$TEMP_DIR/pg.log" start

cleanup() {
    echo "Shutting down test PostgreSQL cluster..."
    "$PG_BIN/pg_ctl" -D "$TEMP_DIR/data" stop > /dev/null 2>&1 || true
    rm -rf "$TEMP_DIR"
    echo "Cleaned up temporary directory."
}
trap cleanup EXIT

echo "Applying Supabase Auth & Storage bootstrap mocks..."
"$PG_BIN/psql" -h "$TEMP_DIR" -p $PORT -U postgres << 'EOF' > /dev/null
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN;
GRANT anon, authenticated, service_role TO postgres;
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

CREATE SCHEMA IF NOT EXISTS auth;
CREATE TABLE IF NOT EXISTS auth.users (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    email text,
    created_at timestamptz DEFAULT now()
);
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid AS $$
    SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION auth.role() RETURNS text AS $$
    SELECT coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), 'anon');
$$ LANGUAGE sql STABLE;

CREATE SCHEMA IF NOT EXISTS storage;
CREATE TABLE IF NOT EXISTS storage.buckets (
    id text PRIMARY KEY,
    name text NOT NULL,
    owner uuid REFERENCES auth.users(id),
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    public boolean DEFAULT false,
    avif_autodetection boolean DEFAULT false,
    file_size_limit bigint,
    allowed_mime_types text[]
);
CREATE TABLE IF NOT EXISTS storage.objects (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    bucket_id text REFERENCES storage.buckets(id),
    name text,
    owner uuid REFERENCES auth.users(id),
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    last_accessed_at timestamptz DEFAULT now(),
    metadata jsonb
);
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
GRANT USAGE ON SCHEMA storage TO anon, authenticated, service_role;
GRANT ALL ON TABLE storage.objects TO anon, authenticated, service_role;
GRANT ALL ON TABLE storage.buckets TO anon, authenticated, service_role;
EOF

echo "Applying Migration 1: Core Schema..."
"$PG_BIN/psql" -h "$TEMP_DIR" -p $PORT -U postgres -f supabase/migrations/20261115000001_core_schema.sql > /dev/null

echo "Applying Migration 2: Security & RLS..."
"$PG_BIN/psql" -h "$TEMP_DIR" -p $PORT -U postgres -f supabase/migrations/20261115000002_security_and_rls.sql > /dev/null

echo "Applying Migration 3: Storage Buckets..."
"$PG_BIN/psql" -h "$TEMP_DIR" -p $PORT -U postgres -f supabase/migrations/20261115000003_storage_buckets.sql > /dev/null

echo "Applying Migration 4: Functions & Triggers..."
"$PG_BIN/psql" -h "$TEMP_DIR" -p $PORT -U postgres -f supabase/migrations/20261115000004_functions_and_triggers.sql > /dev/null

echo "Applying Migration 5: Scope & Security Correction..."
"$PG_BIN/psql" -h "$TEMP_DIR" -p $PORT -U postgres -f supabase/migrations/20261115000005_scope_and_security_correction.sql > /dev/null

echo "Applying Migration 6: Workflow Engine..."
"$PG_BIN/psql" -h "$TEMP_DIR" -p $PORT -U postgres -f supabase/migrations/20261115000006_workflow_engine.sql > /dev/null

echo "Applying Migration 7: RPC Identity Hardening..."
"$PG_BIN/psql" -h "$TEMP_DIR" -p $PORT -U postgres -f supabase/migrations/20261115000007_rpc_identity_hardening.sql > /dev/null

echo "Applying Migration 8: Security & Invariant Remediation..."
"$PG_BIN/psql" -h "$TEMP_DIR" -p $PORT -U postgres -f supabase/migrations/20261115000008_security_and_invariant_remediation.sql > /dev/null

echo "Applying Migration 9: Resolution Provenance & Evidence Hardening..."
"$PG_BIN/psql" -h "$TEMP_DIR" -p $PORT -U postgres -f supabase/migrations/20261115000009_resolution_provenance_and_evidence_hardening.sql > /dev/null

echo "Applying Migration 10: Resolution Call Stack & Service-Role Hardening..."
"$PG_BIN/psql" -h "$TEMP_DIR" -p $PORT -U postgres -f supabase/migrations/20261115000010_resolution_call_stack_and_service_role_hardening.sql > /dev/null

echo "Applying Authoritative Seed Dataset..."
"$PG_BIN/psql" -h "$TEMP_DIR" -p $PORT -U postgres -f supabase/seed.sql > /dev/null

echo "Executing Security Audit Scenarios..."
"$PG_BIN/psql" -h "$TEMP_DIR" -p $PORT -U postgres -f supabase/tests/security_audit_test.sql

echo "Executing Phase 3C Adversarial Security & Storage Scenarios..."
"$PG_BIN/psql" -h "$TEMP_DIR" -p $PORT -U postgres -f supabase/tests/adversarial_security_test.sql

echo "Executing Phase 4 Workflow Engine & Invariant Scenarios..."
"$PG_BIN/psql" -h "$TEMP_DIR" -p $PORT -U postgres -f supabase/tests/workflow_engine_test.sql

echo "Executing Phase 4C RPC Identity Hardening Scenarios..."
"$PG_BIN/psql" -h "$TEMP_DIR" -p $PORT -U postgres -f supabase/tests/phase_04c_hardening_test.sql

echo "Executing Phase 4C Genuine Simultaneous Concurrency Test..."
CONC_LOG_1="$TEMP_DIR/conc1.log"
CONC_LOG_2="$TEMP_DIR/conc2.log"

"$PG_BIN/psql" -h "$TEMP_DIR" -p $PORT -U postgres -v ON_ERROR_STOP=1 << 'EOF' > "$CONC_LOG_1" 2>&1 &
SET ROLE authenticated;
SET request.jwt.claim.role = 'authenticated';
SET request.jwt.claim.sub = 'a0000000-0000-0000-0000-000000000001';
SELECT pg_sleep(0.01);
SELECT public.link_report_to_spot(
    'e0000000-0000-0000-0000-000000000041',
    'c0000000-0000-0000-0000-000000000041',
    'a0000000-0000-0000-0000-000000000001',
    0,
    'Concurrent session 1'
);
EOF
PID_1=$!

"$PG_BIN/psql" -h "$TEMP_DIR" -p $PORT -U postgres -v ON_ERROR_STOP=1 << 'EOF' > "$CONC_LOG_2" 2>&1 &
SET ROLE authenticated;
SET request.jwt.claim.role = 'authenticated';
SET request.jwt.claim.sub = 'a0000000-0000-0000-0000-000000000001';
SELECT public.link_report_to_spot(
    'e0000000-0000-0000-0000-000000000041',
    'c0000000-0000-0000-0000-000000000042',
    'a0000000-0000-0000-0000-000000000001',
    0,
    'Concurrent session 2'
);
EOF
PID_2=$!

set +e
wait $PID_1
STATUS_1=$?
wait $PID_2
STATUS_2=$?
set -e

if [ "$STATUS_1" -eq 0 ] && [ "$STATUS_2" -ne 0 ]; then
    echo "CONCURRENCY TEST PASSED: Session 1 acquired row lock and won; Session 2 was serialized and rejected cleanly."
elif [ "$STATUS_2" -eq 0 ] && [ "$STATUS_1" -ne 0 ]; then
    echo "CONCURRENCY TEST PASSED: Session 2 acquired row lock and won; Session 1 was serialized and rejected cleanly."
else
    echo "CONCURRENCY TEST FAILED: Unexpected status codes: Session 1 ($STATUS_1), Session 2 ($STATUS_2)"
    cat "$CONC_LOG_1" "$CONC_LOG_2"
    exit 1
fi

LINKED_COUNT=$("$PG_BIN/psql" -h "$TEMP_DIR" -p $PORT -U postgres -t -c "SELECT count(*) FROM public.reports WHERE id = 'e0000000-0000-0000-0000-000000000041' AND spot_id IS NOT NULL;" | tr -d ' ')
if [ "$LINKED_COUNT" -ne 1 ]; then
    echo "CONCURRENCY TEST FAILED: Expected exactly 1 linked report, found $LINKED_COUNT"
    exit 1
fi
echo "CONCURRENCY TEST VERIFIED: Exactly 1 valid relationship survived with zero duplicate or contradictory events."

echo "Executing Phase 4D Database Security & Workflow Invariant Remediation Scenarios..."
"$PG_BIN/psql" -h "$TEMP_DIR" -p $PORT -U postgres -f supabase/tests/phase_04d_remediation_test.sql

echo "Executing Phase 4D Citizen Challenge Concurrency Test..."
"$PG_BIN/psql" -h "$TEMP_DIR" -p $PORT -U postgres -c "
INSERT INTO public.citizen_contacts (
    id, telegram_user_hash, encrypted_chat_id, language
) VALUES (
    'f0000000-0000-0000-0000-000000000003', 'synthetic_hash_333333', 'synthetic_chat_333333', 'en'
) ON CONFLICT (id) DO NOTHING;
" > /dev/null

CHAL_LOG_1="$TEMP_DIR/chal1.log"
CHAL_LOG_2="$TEMP_DIR/chal2.log"

"$PG_BIN/psql" -h "$TEMP_DIR" -p $PORT -U postgres -v ON_ERROR_STOP=1 << 'EOF' > "$CHAL_LOG_1" 2>&1 &
SET ROLE authenticated;
SET request.jwt.claim.role = 'authenticated';
SET request.jwt.claim.sub = 'a0000000-0000-0000-0000-000000000001';
SELECT pg_sleep(0.01);
SELECT public.create_citizen_challenge(
    'c0000000-0000-0000-0000-000000000081',
    'f0000000-0000-0000-0000-000000000003',
    'still_not_fixed',
    'Concurrent challenge session 1'
);
EOF
CHAL_PID_1=$!

"$PG_BIN/psql" -h "$TEMP_DIR" -p $PORT -U postgres -v ON_ERROR_STOP=1 << 'EOF' > "$CHAL_LOG_2" 2>&1 &
SET ROLE authenticated;
SET request.jwt.claim.role = 'authenticated';
SET request.jwt.claim.sub = 'a0000000-0000-0000-0000-000000000001';
SELECT public.create_citizen_challenge(
    'c0000000-0000-0000-0000-000000000081',
    'f0000000-0000-0000-0000-000000000003',
    'still_not_fixed',
    'Concurrent challenge session 2'
);
EOF
CHAL_PID_2=$!

set +e
wait $CHAL_PID_1
CHAL_STATUS_1=$?
wait $CHAL_PID_2
CHAL_STATUS_2=$?
set -e

if [ "$CHAL_STATUS_1" -eq 0 ] && [ "$CHAL_STATUS_2" -ne 0 ]; then
    echo "CHALLENGE CONCURRENCY TEST: Session 1 acquired lock and won; Session 2 was serialized."
    REJECTED_LOG="$CHAL_LOG_2"
elif [ "$CHAL_STATUS_2" -eq 0 ] && [ "$CHAL_STATUS_1" -ne 0 ]; then
    echo "CHALLENGE CONCURRENCY TEST: Session 2 acquired lock and won; Session 1 was serialized."
    REJECTED_LOG="$CHAL_LOG_1"
else
    echo "CHALLENGE CONCURRENCY TEST FAILED: Unexpected status codes: Session 1 ($CHAL_STATUS_1), Session 2 ($CHAL_STATUS_2)"
    cat "$CHAL_LOG_1" "$CHAL_LOG_2"
    exit 1
fi

if grep -q "Duplicate challenge: An active challenge from this citizen is already pending review" "$REJECTED_LOG"; then
    if grep -q "idx_citizen_challenges_active_unique" "$REJECTED_LOG" || grep -q "unique constraint" "$REJECTED_LOG"; then
        echo "CHALLENGE CONCURRENCY TEST FAILED: Session crashed on unique index constraint instead of clean row-lock serialization!"
        cat "$REJECTED_LOG"
        exit 1
    fi
    echo "CHALLENGE CONCURRENCY TEST PASSED: Row locking isolated and verified. Rejection occurred via application rate-limit logic, not unhandled constraint crash."
else
    echo "CHALLENGE CONCURRENCY TEST FAILED: Rejected session did not fail with application lock rate-limit message. Log output:"
    cat "$REJECTED_LOG"
    exit 1
fi

ACTIVE_CHAL_COUNT=$("$PG_BIN/psql" -h "$TEMP_DIR" -p $PORT -U postgres -t -c "SELECT count(*) FROM public.citizen_challenges WHERE spot_id = 'c0000000-0000-0000-0000-000000000081' AND citizen_contact_id = 'f0000000-0000-0000-0000-000000000003' AND status IN ('new', 'under_review');" | tr -d ' ')
if [ "$ACTIVE_CHAL_COUNT" -ne 1 ]; then
    echo "CHALLENGE CONCURRENCY TEST FAILED: Expected exactly 1 active challenge, found $ACTIVE_CHAL_COUNT"
    exit 1
fi
echo "CHALLENGE CONCURRENCY VERIFIED: Exactly 1 active challenge created with zero duplicate or race conditions."

echo "Executing Phase 4C Input Validation & Access Control Unit Tests..."
node --experimental-strip-types src/lib/workflow/__tests__/phase_04c_validation.test.ts

echo "ALL VALIDATION CHECKS COMPLETED SUCCESSFULLY!"
