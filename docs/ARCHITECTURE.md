# Architecture

This document describes how the RWA Reliability Analyzer is structured for reviewers and contributors.

## Overview

The system verifies whether tokenized real-world assets have backing claims that reconcile against independent sources. Work flows through three modules connected by two frozen TypeScript contracts.

```
                    ┌─────────────────────────────────────────────────────────┐
                    │                     lib/contracts.ts                     │
                    │  Contract A: NormalizedAssetRecord                        │
                    │  Contract B: Assessment                                   │
                    └─────────────────────────────────────────────────────────┘
                                          ▲                    ▲
                                          │                    │
┌──────────────┐    ┌─────────────────────┴──┐    ┌─────────┴──────────────┐
│   Sources    │───▶│  lib/ingestion/          │───▶│  lib/computation/      │
│  on-chain    │    │  adapters, citations,    │    │  backing, access,      │
│  EDGAR, etc. │    │  reconcile, OpenAI       │    │  structure, redemption │
└──────────────┘    └──────────────────────────┘    └──────────┬─────────────┘
                                                                 │
                    ┌────────────────────────────────────────────┴────────────┐
                    │  lib/service.ts (orchestration)                           │
                    │  lib/decision.ts (reachability + ranking)               │
                    │  lib/agent/verdict.ts (agent contract)                  │
                    └────────────────────────────┬────────────────────────────┘
                                                 │
         ┌───────────────┬───────────────────────┼───────────────────────┐
         ▼               ▼                       ▼                       ▼
   app/ (Next.js)   bin/rwa-verify.ts      mcp/server.ts          app/api/*
   components/      CLI client             MCP client             HTTP API
```

## Directory layout

```
rwa-analyzer/
├── app/                    # Next.js App Router
│   ├── api/                # HTTP endpoints
│   │   ├── verify/         # Agent verdict (primary contract)
│   │   ├── universe/       # Decision-ready asset summaries
│   │   ├── asset/[id]/     # Full record + assessment
│   │   ├── search/         # Ticker/address lookup
│   │   └── cron/refresh/   # Daily quant refresh
│   ├── a/[assetId]/        # Asset detail page
│   └── page.tsx            # Decision explorer landing
├── bin/rwa-verify.ts       # CLI client
├── mcp/server.ts           # MCP stdio server
├── components/             # React UI (RiskCard, DecisionExplorer, etc.)
├── lib/
│   ├── contracts.ts        # Frozen Contract A + B (do not reshape casually)
│   ├── ingestion/          # Module 1: source adapters → NormalizedAssetRecord
│   │   ├── adapters/       # onchain, edgar, attestation, defillama, issuer-docs, ...
│   │   ├── citations.ts    # Verbatim substring validation
│   │   ├── holdings.ts     # On-chain reconstruction logic
│   │   └── reconcile.ts    # Cross-source demotion only
│   ├── computation/        # Module 2: deterministic rules → Assessment
│   │   ├── backing.ts      # Evidence hierarchy + reconciliation
│   │   ├── freshness.ts    # Per-source cadence (live/aging/stale)
│   │   ├── access.ts
│   │   ├── structure.ts
│   │   └── redemption.ts
│   ├── agent/verdict.ts    # AgentVerdict shape (no boolean safe flag)
│   ├── decision.ts           # Jurisdiction/amount filtering + safety-first rank
│   ├── service.ts            # get-or-ingest orchestration
│   ├── seed/assets.ts        # Human-checked flagship registry
│   └── display.ts            # Shared UI labels
├── scripts/                  # seed.ts, probes
├── supabase/schema.sql       # Postgres asset store
└── docs/specs/               # Design notes (freshness + attestation implemented)
```

## Contract A: NormalizedAssetRecord

Produced by ingestion. Consumed by computation.

- `identifiers`: symbol, name, chain, contract address
- `fields`: map of `FieldObject` (value, source, method, confidence, as_of, citation)
- `backing_evidence[]`: array of `EvidenceItem` with independence + extraction axes
- `tokenization_mode`: `fully_tokenized` | `tranche_of_registered_fund` | ...
- `qualitative_pending`: true while issuer-doc extraction is in flight

Every field carries its own confidence. There is no asset-level confidence collapse at this layer.

## Contract B: Assessment

Produced by computation. Consumed by the app and agent clients.

- `dimensions`: backing, access, redemption, structure
- Each dimension: `flag` (green/amber/red/unknown), `reason`, `confidence`, `sources`, `inputs`, optional `freshness` on backing
- `overall_confidence`: minimum across dimensions (coverage tier for UI)
- `computed_at`: ISO timestamp

Computation is pure, deterministic, and contains no LLM calls.

## Agent contract

`toAgentVerdict()` maps Contract A + B into `AgentVerdict`:

- `backing.tier` + `backing.confidence` + `backing.freshness` (three axes, never collapsed)
- `next_expected_update` on backing and per evidence item
- `meaning`, `trust_boundary`, `caveats` (caveats required unless tier=verified_backed, confidence=verified, freshness=live)
- `evidence[]` with per-source trust boundaries
- No `safe` or `is_safe` boolean

Served by `GET /api/verify`. Wrapped identically by the CLI and MCP server.

## Ingestion adapters

| Adapter | Source | Role |
|---------|--------|------|
| `onchain.ts` | RPC | Supply, NAV where on-chain |
| `onchain-holdings.ts` | RPC + registry | Reserve wallet reconstruction |
| `edgar.ts` | SEC EDGAR | N-MFP filings for registered MMFs |
| `attestation.ts` | Issuer attestation PDFs | Lane C coverage (human-gated registry) |
| `defillama.ts` | DeFiLlama REST | Live pool APY (auto, sanity-banded) |
| `issuer-docs.ts` | PDF/HTML + OpenAI | Qualitative field extraction |
| `chainlink-registry.ts` | Chainlink PoR | Oracle reserve feeds (none on flagships today) |

Reconciliation (`reconcile.ts`) only demotes confidence when sources conflict.

## Computation rules

| Module | Reads | Output |
|--------|-------|--------|
| `backing.ts` | backing_evidence, supply, nav, tokenization_mode | Green via arithmetic or regulator/NAV integrity; freshness demotion |
| `freshness.ts` | evidence `as_of`, cadence | `live` / `aging` / `stale` per source type |
| `access.ts` | jurisdiction, min_investment, kyc | Eligibility flags (red = restriction, not danger) |
| `redemption.ts` | redemption_speed, redemption_cap | Liquidity read |
| `structure.ts` | wrapper_type, custodian, domicile | Legal structure read |

`finalize()` in `util.ts` caps verdict confidence at the minimum of its input field confidences.

## Storage and refresh

- Supabase Postgres caches ingested records and assessments
- `npm run seed` ingests flagship assets from `lib/seed/assets.ts`
- Cold lookups trigger on-demand ingestion (rate-limited LLM path)
- `GET /api/cron/refresh` (guarded by `CRON_SECRET`) refreshes quantitative fields daily

## Testing

128 Jest tests across `**/__tests__/`:

- Contract invariants (citation validation, confidence capping, anti-laundering)
- Backing resolver edge cases (slice funds, reconciliation)
- Freshness gradient and demote-only behavior
- Attestation adapter and registry guards
- Decision engine (reachability matrix, safety-first ranking)
- Agent verdict shape (three axes, no boolean collapse, required caveats)
- Seed wiring (`seedIngestOptions` forwards verdict-affecting fields)
- Adapter unit tests (EDGAR parsing, APY sanitization, holdings ceiling)

Run: `npm run test`

## Specs

`docs/specs/freshness-and-attestation.md` documents the freshness axis and attestation tier. Both are implemented on the current branch.
