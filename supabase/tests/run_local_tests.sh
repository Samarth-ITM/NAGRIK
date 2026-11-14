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

echo "Applying Authoritative Seed Dataset..."
"$PG_BIN/psql" -h "$TEMP_DIR" -p $PORT -U postgres -f supabase/seed.sql > /dev/null

echo "Executing Security Audit Scenarios..."
"$PG_BIN/psql" -h "$TEMP_DIR" -p $PORT -U postgres -f supabase/tests/security_audit_test.sql

echo "Executing Phase 3C Adversarial Security & Storage Scenarios..."
"$PG_BIN/psql" -h "$TEMP_DIR" -p $PORT -U postgres -f supabase/tests/adversarial_security_test.sql

echo "Executing Phase 4 Workflow Engine & Invariant Scenarios..."
"$PG_BIN/psql" -h "$TEMP_DIR" -p $PORT -U postgres -f supabase/tests/workflow_engine_test.sql

echo "ALL VALIDATION CHECKS COMPLETED SUCCESSFULLY!"
