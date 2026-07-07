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
