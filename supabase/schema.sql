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
-- Cost circuit-breaker — global daily counters for paid external calls.
-- Read/written server-side via the atomic `bump_usage` RPC (see lib/budget.ts).
-- ---------------------------------------------------------------------------
create table if not exists usage_counters (
    day   date    not null,
    kind  text    not null,       -- 'openai' | 'web_search'
    count integer not null default 0,
    primary key (day, kind)
);

-- Atomic increment: bumps (day, kind) by one and returns the new count. A single
-- INSERT ... ON CONFLICT is race-safe across concurrent serverless instances, so
-- the daily cap holds even under a burst of parallel cold lookups.
create or replace function bump_usage(p_day date, p_kind text)
returns integer
language plpgsql
as $$
declare
    new_count integer;
begin
    insert into usage_counters (day, kind, count)
    values (p_day, p_kind, 1)
    on conflict (day, kind)
    do update set count = usage_counters.count + 1
    returning count into new_count;
    return new_count;
end;
$$;

-- ---------------------------------------------------------------------------
-- Defense-in-depth: enable RLS on every table. The app connects with the
-- service role, which BYPASSES RLS, so this is a no-op for the server. With no
-- policies defined, the anon/authenticated roles are denied all access — so an
-- accidentally-exposed anon key or the public project URL cannot read the store.
-- ---------------------------------------------------------------------------
alter table assets          enable row level security;
alter table assessments     enable row level security;
alter table asset_index     enable row level security;
alter table usage_counters  enable row level security;
