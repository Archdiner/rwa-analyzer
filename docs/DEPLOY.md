# Deploy & launch checklist

How to take this from a repo to a URL real testers can hit, safely. Target stack
is **Vercel + Supabase** (what the app is wired for).

## 1. Provision Supabase

1. Create a Supabase project.
2. In the SQL editor, run the full contents of [`supabase/schema.sql`](../supabase/schema.sql).
   This creates the asset store, the search index, **the daily usage-counter table
   and its `bump_usage` function** (the cost circuit-breaker), and enables RLS on
   every table. Re-run it after pulling changes that touch the schema.
3. Grab the project URL and the **service-role** key (Settings → API).

## 2. Set environment variables in Vercel

Required for a safe public deploy:

| Variable | Why it matters |
|----------|----------------|
| `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | The asset store. Without it the app runs on-demand with no cache. |
| `CRON_SECRET` | **Required.** The refresh cron fails closed (`503`) until this is set. Generate a random 32+ char value. Vercel Cron sends it automatically. |
| `OPENAI_API_KEY` | Qualitative extraction. Absent → those fields stay `unverifiable`. |
| `ETHEREUM_RPC_URL` / `BASE_RPC_URL` / `AVALANCHE_RPC_URL` | On-chain reads. Absent → that chain is skipped. Use a paid provider (Alchemy/Chainstack) — public RPCs will rate-limit you. |

Cost controls (have sane defaults, but **set them low for a beta**):

| Variable | Default | Notes |
|----------|---------|-------|
| `OPENAI_DAILY_CAP` | 500 | Global cap on OpenAI calls per UTC day. Once hit, extraction is skipped and fields degrade to `unverifiable`. |
| `WEB_SEARCH_DAILY_CAP` | 500 | Same, for issuer-doc discovery (Serper). |

Optional: `WEB_SEARCH_API_KEY` (Serper — cold-lookup doc discovery), `RWA_XYZ_API_KEY`
(Enterprise-only), `SEC_USER_AGENT` (EDGAR courtesy header).

## 3. Seed the flagship assets

From a machine with the same env configured:

```bash
npm run seed   # ingest + store the seven flagship assets
```

This warms the store so the landing page and `/api/universe` read through cache
instead of re-ingesting on every visit.

## 4. Verify before you share the link

- `npm run lint && npm test && npm run build` all pass (CI runs these on every push).
- `GET /api/verify?asset=BENJI` returns `tier: "verified_backed"`, `confidence: "verified"`.
- `GET /api/verify?asset=OUSG` returns an honest `unverifiable` with caveats (expected).
- `GET /api/cron/refresh` **without** the secret returns `503` (fail-closed check).
- The landing page renders and the Decision Explorer responds to jurisdiction/amount.

## 5. Data integrity — do this before real users

The seed contract addresses (`lib/seed/assets.ts`), the EDGAR registry
(`lib/ingestion/adapters/edgar-registry.ts`), and any attestation entries must be
verified against primary sources. A wrong address points the whole pipeline at the
wrong token under a real fund's name — the worst-case failure. This is a
human-review gate, not a code change.

## Known limits at launch (be upfront with testers)

- **Coverage is one verified-green asset (BENJI).** Everything else is honest
  `unverifiable`/amber. That is the point of the tool, but say it plainly.
- **Rate limiting is per-instance** (best-effort). The hard spend ceiling is the
  global daily budget. For a strict global request limit, add Upstash Redis.
- **Yields for the money-market flagships are seeded literals**, refreshed by hand;
  only the two DeFi pools (sDAI, syrupUSDC) carry live APY. They're labeled `auto`.
