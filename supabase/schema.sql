-- ---------------------------------------------------------------------------
-- RWA Reliability Analyzer — schema
-- ---------------------------------------------------------------------------
-- Three tables. No auth/accounts in v1. The app reads/writes with the service
-- role only, so RLS is left disabled (nothing here is user-owned data).
-- ---------------------------------------------------------------------------

-- Contract A — one normalized record per asset.
create table if not exists assets (
    asset_id            text primary key,          -- "{chainId}:{address}"
    identifiers         jsonb not null,
    record              jsonb not null,            -- full NormalizedAssetRecord
    qualitative_pending boolean not null default true,
    ingested_at         timestamptz not null default now()
);

-- Contract B — one assessment per asset (recomputed when the record changes).
create table if not exists assessments (
    asset_id           text primary key references assets(asset_id) on delete cascade,
    assessment         jsonb not null,             -- full Assessment
    overall_confidence text not null,              -- verified | auto | unverifiable
    computed_at        timestamptz not null default now()
);

-- Search index — seeded/indexed assets resolvable by ticker/name.
-- Long-tail assets are address-only in v1 and are not required to appear here.
create table if not exists asset_index (
    asset_id    text primary key references assets(asset_id) on delete cascade,
    symbol      text not null,
    name        text not null,
    issuer_name text
);

create index if not exists asset_index_symbol_idx on asset_index (lower(symbol));
create index if not exists asset_index_name_idx    on asset_index (lower(name));
create index if not exists assets_pending_idx      on assets (qualitative_pending);
create index if not exists assets_ingested_idx     on assets (ingested_at);

-- ---------------------------------------------------------------------------
-- Feature-request pipeline (Phase 1)
-- ---------------------------------------------------------------------------
-- The intake queue. Every submission is stored (anonymous, IP-rate-limited at
-- the endpoint - never dropped on cost). A budget-gated worker drains
-- status='received' FIFO. Still service-role/app-authz only, no RLS.
create table if not exists feature_requests (
    id            uuid primary key default gen_random_uuid(),
    submitter_ip  text,
    raw_text      text not null,
    status        text not null default 'received',  -- received | triaged | rejected | promoted
    triage        jsonb,
    cluster_id    text,
    cluster_label text,
    created_at    timestamptz not null default now()
);

-- FIFO queue read: oldest 'received' first.
create index if not exists feature_requests_queue_idx on feature_requests (status, created_at);

-- Per-day spend counter so the triage worker stays within R-COST ($/day). The
-- date PK gives an implicit daily reset (a new day has no row = full budget).
create table if not exists processing_budget (
    spend_date date primary key,
    spent_usd  numeric not null default 0
);

-- Atomic debit: insert-or-add in a single statement so concurrent worker
-- invocations can't lose an update and overspend the cap. search_path pinned
-- empty + schema-qualified per Supabase function-security guidance.
create or replace function public.debit_budget(p_date date, p_amount numeric)
returns numeric
language sql
set search_path = ''
as $$
    insert into public.processing_budget (spend_date, spent_usd)
    values (p_date, p_amount)
    on conflict (spend_date)
    do update set spent_usd = public.processing_budget.spent_usd + excluded.spent_usd
    returning spent_usd;
$$;

-- Match the existing tables' posture: RLS on, no policies (the app uses the
-- service role, which bypasses RLS; anon/public is denied).
alter table public.feature_requests enable row level security;
alter table public.processing_budget enable row level security;
