-- =============================================================================
-- NAGRIK: app state that used to live in data/*.json on the server's disk.
-- Needed for serverless hosting (Vercel), where the disk is temporary.
-- All tables have RLS enabled with NO policies: only the server (service role)
-- can read or write them. Browsers using the anon key see nothing.
-- Safe to run more than once.
-- =============================================================================

-- Citizen accounts created through the Telegram bot -----------------------------
create table if not exists public.citizen_accounts (
    telegram_user_hash text primary key,
    name               text        not null check (char_length(name) between 2 and 60),
    normalized_name    text        not null,
    password_hash      text        not null,
    salt               text        not null,
    hash_algo          text        null check (hash_algo is null or hash_algo in ('scrypt')),
    telegram_user_id   bigint      null,
    created_at         timestamptz not null default now(),
    last_login_at      timestamptz not null default now()
);
-- One name per person: blocks a second Telegram account from claiming a name.
create unique index if not exists citizen_accounts_normalized_name_key
    on public.citizen_accounts (normalized_name);
alter table public.citizen_accounts enable row level security;
revoke all on public.citizen_accounts from anon, authenticated;

-- The NGO profile shown on the site (single row) ----------------------------------
create table if not exists public.ngo_profile (
    id             smallint    primary key default 1 check (id = 1),
    name           text        not null check (char_length(name) between 2 and 80),
    logo_url       text        not null default '',
    verified       boolean     not null default true,
    contact_email  text        null,
    previous_names text[]      not null default '{}',
    updated_at     timestamptz not null default now()
);
alter table public.ngo_profile enable row level security;
revoke all on public.ngo_profile from anon, authenticated;

-- Small key/value store (e.g. cached Telegram file ids) --------------------------
create table if not exists public.app_kv (
    key        text        primary key,
    value      jsonb       not null,
    updated_at timestamptz not null default now()
);
alter table public.app_kv enable row level security;
revoke all on public.app_kv from anon, authenticated;

-- Shared rate limits (sign-in attempts, AI calls) ---------------------------------
create table if not exists public.rate_limit_hits (
    key      text        primary key,
    count    integer     not null,
    reset_at timestamptz not null
);
create index if not exists rate_limit_hits_reset_at_idx on public.rate_limit_hits (reset_at);
alter table public.rate_limit_hits enable row level security;
revoke all on public.rate_limit_hits from anon, authenticated;

-- Atomically counts one hit for p_key inside a fixed window.
create or replace function public.rate_limit_hit(p_key text, p_window_seconds integer)
returns table (hit_count integer, reset_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
begin
    -- Occasionally clear out expired rows.
    if random() < 0.02 then
        delete from public.rate_limit_hits r where r.reset_at < now() - interval '1 day';
    end if;

    return query
    insert into public.rate_limit_hits as r (key, count, reset_at)
    values (p_key, 1, now() + make_interval(secs => p_window_seconds))
    on conflict (key) do update set
        count    = case when r.reset_at <= now() then 1 else r.count + 1 end,
        reset_at = case when r.reset_at <= now()
                        then now() + make_interval(secs => p_window_seconds)
                        else r.reset_at end
    returning r.count, r.reset_at;
end;
$$;

revoke all on function public.rate_limit_hit(text, integer) from public, anon, authenticated;
grant execute on function public.rate_limit_hit(text, integer) to service_role;
