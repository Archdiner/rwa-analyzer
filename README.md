# RWA Reliability Analyzer

Paste any tokenized real-world asset (within reason) and get a transparent, per-dimension reliability read where **every claim shows its source and its confidence**. Auto-extracted data never wears the same badge as verified data, and the tool says plainly what it doesn't know.

This rates **assets** (research on public facts). It is not a rating agency and **not financial advice**.

## How it works

Three modules behind two frozen contracts. Any module can be rewritten in isolation as long as the two shapes hold.

```
 SOURCES            MODULE 1 (Ingestion)      Contract A       MODULE 2 (Computation)     Contract B      MODULE 3 (App)
 on-chain           source adapters       Normalized Asset      deterministic rules      Assessment        lookup +
 Chainlink PoR  →   + OpenAI extractor →      Record        →   (no LLM, no grade)   →      Object      →  risk card
 DeFiLlama          + reconciliation      {field:{value,                             {dim:{flag,reason,
 rwa.xyz (opt)                              source,method,                             inputs,confidence,
 issuer docs                                confidence,as_of,                          sources}}
                                            citation}}
```

Two invariants enforced in code:

1. **Confidence is per field, never per asset.** A `verified` on-chain supply can sit next to an `auto` (LLM-extracted) wrapper type. They are never collapsed.
2. **A verdict's confidence is capped by its inputs' confidence.** If the wrapper type was auto-extracted, the structure verdict is stamped "Based on auto-extracted data." Computation can never emit a confident verdict from unconfident inputs.

The LLM lives only in ingestion (prose → structured fields). Scoring is deterministic rules, so every output is explainable and improvable one rule at a time.

### The edge: `reserves_method`

The Chainlink adapter records *how* reserves are proven — `auditor_attested`, `self_reported`, `unknown` (feed we haven't classified), or `none`. Most tools treat any Proof-of-Reserve feed as truth; a self-reported reserve is downgraded to amber even when the numbers reconcile.

### Citation validation (integrity spine)

Every LLM-extracted field must carry a `text_span`. That span is validated as a **verbatim substring** of the fetched document; if it fails, the field drops to `unverifiable`. A required-but-unchecked citation is worthless — so we check it.

### Coverage tiers

- **Verified** — seeded flagship assets, qualitative fields human-checked.
- **Auto** — resolved on demand: on-chain + LLM extraction. Labeled "verify yourself"; sources on every field.
- **Unverifiable** — on-chain resolves but no qualitative sources found. On-chain data only, with honest `unknown`s.

## Dimensions

| Dimension | Reads | `unknown` when |
|---|---|---|
| Backing & verification | supply, nav, reserves, reserves_method | nav or supply missing (never a false green off NAV=1.00) |
| Redemption & liquidity | redemption_speed, redemption_cap | speed unknown |
| Access & eligibility | jurisdiction, min_investment, kyc | nothing known (red here = eligibility restriction, not danger) |
| Issuer & structure | wrapper_type, custodian, domicile | wrapper unknown |

## Stack

Next.js (App Router) · viem · Supabase (Postgres) · OpenAI (structured extraction) · Vercel Cron. Deploys on Vercel; near-free at portfolio scale (the only variable cost is LLM calls on the cold-lookup path, which is deferred and rate-limited).

## Setup

```bash
cp .env.example .env.local   # fill in what you have (everything except Supabase degrades gracefully)
npm install
npm run dev                  # http://localhost:3000
```

Apply the schema in `supabase/schema.sql` to your Supabase project, then seed:

```bash
npm run seed                 # ingests + stores the flagship assets
```

### Environment

| Var | Purpose | Absent behavior |
|---|---|---|
| `ETHEREUM_RPC_URL` / `BASE_RPC_URL` / `AVALANCHE_RPC_URL` | on-chain reads | that chain is skipped |
| `OPENAI_API_KEY` | qualitative extraction | qualitative fields → unverifiable |
| `RWA_XYZ_API_KEY` | rwa.xyz v4 (**Enterprise/paid** — no free API) | reference fields skipped |
| `WEB_SEARCH_API_KEY` | issuer-doc discovery on cold lookups (Serper format) | discovery uses known URLs only |
| `NEXT_PUBLIC_SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` | the asset store | no caching (on-demand each load) |
| `CRON_SECRET` | guards the daily refresh cron | cron open (set it in prod) |

> Note: rwa.xyz has no free programmatic API; the $0 plan is dashboard-only. The tool is designed to work without it — qualitative data comes from the seed + LLM extraction of issuer disclosures.

## Commands

```bash
npm run dev      # dev server
npm run build    # production build
npm run lint     # eslint
npm run test     # jest (rule boundaries + the three code-enforced invariants)
npm run seed     # ingest + store flagship assets
```

## Out of scope (v1)

Smart-contract/oracle depth, secondary-liquidity depth, duration modeling, human-verification queue, comparison/portfolio/watchlists, alerting, historical trends, accounts, public API. See the spec for the v2+ roadmap.

## A note on addresses

Seed contract addresses and qualitative facts (`lib/seed/assets.ts`) and the Chainlink PoR registry (`lib/ingestion/adapters/chainlink-registry.ts`) must be verified against primary sources before production. A wrong address or a wrong "fully backed" is the worst-case failure this design exists to avoid.
