# RWA Reliability Analyzer

Machine-readable backing verification for tokenized real-world assets. Given an asset identifier, the system checks whether stated backing reconciles against independent sources and returns a structured verdict where it cannot.

**Interfaces:** MCP server, CLI, HTTP API, and a Next.js web UI. All clients share one server-side contract (`lib/agent/verdict.ts`, `GET /api/verify`).

This tool rates assets on public facts. It does not hold funds, act as a rating agency, or provide financial advice.

> **Status: public beta.** The verdict engine is deterministic and covered by 300 tests. Coverage is intentionally narrow and honest: of the seven seeded flagship assets, exactly one (**BENJI**) currently reaches a `verified_backed` / `verified` green via its SEC EDGAR filing; the rest resolve to `partially_verified`, `does_not_reconcile`, or an honest `unverifiable`. That is the design — the tool says "unknown" rather than manufacture a green. Coverage grows by adding *verified sources* (regulator filings, proven reserve wallets, registered attestations), not by inflating the asset count. Treat green/`verified` verdicts as machine-checked and every other verdict as a well-labeled starting point, not a recommendation.

## What it does

The core pipeline is: asset in, structured verdict out. The response is intentionally **not** a boolean. There is no `safe: true`.

Backing uses three axes read together:

| Axis | Values | Meaning |
|------|--------|---------|
| `tier` | `verified_backed`, `partially_verified`, `does_not_reconcile`, `unverifiable` | Whether the backing claim reconciled against an independent source |
| `confidence` | `verified`, `auto`, `unverifiable` | How the figure was obtained (on-chain read vs parsed document, etc.) |
| `freshness` | `live`, `aging`, `stale` | Evidence age relative to each source's expected refresh cadence |

Each verdict also includes `meaning`, `trust_boundary`, `next_expected_update`, and `caveats` (required unless `tier === verified_backed`, `confidence === verified`, and `freshness === live`).

`verified_backed` means reconciliation against a named independent source. It is not a safety guarantee. `unverifiable` means evidence is missing or unreadable, not that the asset is unsafe.

## Interfaces

### MCP

Stdio server with `check_asset_backing` and `list_verified_assets`. It ships as the `@archdiner/rwa-verify` npm package, so no clone is required.

Claude Code (one command):

```bash
claude mcp add rwa-backing-verifier \
  -e RWA_API_BASE=https://rwa-analyzer.vercel.app \
  -- npx -y -p @archdiner/rwa-verify@latest rwa-verify-mcp
```

Other MCP clients:

```json
{
  "mcpServers": {
    "rwa-backing-verifier": {
      "command": "npx",
      "args": ["-y", "-p", "@archdiner/rwa-verify@latest", "rwa-verify-mcp"],
      "env": { "RWA_API_BASE": "https://rwa-analyzer.vercel.app" }
    }
  }
}
```

Per-client config paths (Cursor, Claude Desktop, VS Code, Windsurf) are in [docs/INTEGRATIONS.md](docs/INTEGRATIONS.md).

### CLI

```bash
npx -y -p @archdiner/rwa-verify rwa-verify OUSG   # no clone
npm run verify -- ousg                            # from a clone
npm run verify -- 1:0x...
```

Defaults to the deployed API. Set `RWA_API_BASE` for a local server. Exit codes do not encode the tier; read the printed verdict.

### HTTP

```
GET /api/verify?asset=OUSG
GET /api/universe?jurisdiction=&amount=
GET /api/search?q=
GET /api/asset/:id
```

## Decision explorer (web UI)

The landing page is one client of the same engine. Given jurisdiction and amount, `lib/decision.ts`:

1. **Reachability** filters assets by legal access (US retail, accredited, qualified purchaser, non-US, EU).
2. **Safety-first ranking** sorts by backing tier, then yield within a tier.
3. **Trust boundary** surfaces where on-chain verification ends and institutional trust begins.

## Architecture

Three modules sit behind two frozen contracts in `lib/contracts.ts`:

```
 SOURCES              INGESTION              Contract A          COMPUTATION           Contract B         APP
 on-chain reads   ->  adapters + OpenAI  ->  NormalizedAsset  ->  deterministic   ->  Assessment    ->  lookup +
 Chainlink PoR         reconciliation         Record               rules (no LLM)       Object            risk card
 EDGAR / DeFiLlama                          {fields, evidence}
 attestations                               tokenization_mode}
 issuer docs
```

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for module layout, API routes, and invariants.

### Invariants (enforced in tests)

1. **Confidence is per field, never per asset.** A verified on-chain supply can coexist with an auto-extracted wrapper type.
2. **Verdict confidence is capped by input confidence.** Computation cannot emit a confident verdict from unconfident inputs.
3. **LLM citations must be verbatim substrings** of the source document, or the field drops to `unverifiable`.
4. **Reconciliation only demotes** confidence on conflict; it never promotes.
5. **Green backing requires model-independent guards:** supply x NAV arithmetic and verbatim citation matching. `parse_confidence` is a floor only, never a gate.
6. **Freshness only demotes.** Measured per source cadence (`live` / `aging` / `stale`); stale evidence downgrades the backing flag.

The LLM runs only in ingestion (prose to structured fields). Scoring is deterministic.

### Backing evidence (two axes per item)

Each `backing_evidence[]` entry has:

- **Independence** (who produced it): sets the ceiling color. Regulator filings and independently proven on-chain reserves can reach green; issuer self-reports cannot.
- **Extraction** (how it was read): sets the confidence label. On-chain reads are `verified`; parsed PDF figures are `auto`.

**Anti-laundering:** on-chain reconstruction of a held token inherits that token's backing independence as its ceiling (recursive, cycle-safe).

**Slice funds:** `tokenization_mode` distinguishes fully tokenized assets (reconcile reserves against supply x NAV) from tranches of registered funds (green via regulator filing + NAV integrity).

**Attestations (Lane C):** auditor/administrator PDFs via `lib/ingestion/adapters/attestation.ts`. Human-gated registry; capped at `verified_backed` + `auto` (never `verified`). Extends coverage for assets without SEC primary filings when an attestation URL is registered.

### Coverage tiers

| Tier | Description |
|------|-------------|
| Verified | Seeded flagship assets with human-checked qualitative fields |
| Auto | On-demand resolution via on-chain reads and LLM extraction |
| Unverifiable | On-chain data only; qualitative sources missing |

## Assessment dimensions

| Dimension | Inputs | `unknown` when |
|-----------|--------|----------------|
| Backing & verification | supply, nav, backing_evidence, tokenization_mode | nav/supply missing, or reserve evidence not retrieved |
| Redemption & liquidity | redemption_speed, redemption_cap | speed unknown |
| Access & eligibility | jurisdiction, min_investment, kyc | nothing known (red = eligibility restriction, not danger) |
| Issuer & structure | wrapper_type, custodian, domicile | wrapper unknown |

## Stack

Next.js (App Router), viem, Supabase (Postgres), OpenAI (structured extraction), Vercel Cron.

## Setup

```bash
cp .env.example .env.local
npm install
npm run dev    # http://localhost:3000
```

Apply `supabase/schema.sql`, then seed:

```bash
npm run seed
```

### Environment

| Variable | Purpose | If absent |
|----------|---------|-----------|
| `ETHEREUM_RPC_URL` / `BASE_RPC_URL` / `AVALANCHE_RPC_URL` | On-chain reads | That chain is skipped |
| `OPENAI_API_KEY` | Qualitative extraction | Qualitative fields become unverifiable |
| `RWA_XYZ_API_KEY` | rwa.xyz v4 (Enterprise/paid; no free API) | Reference fields skipped |
| `WEB_SEARCH_API_KEY` | Issuer-doc discovery (Serper format) | Discovery uses known URLs only |
| `SEC_USER_AGENT` | EDGAR courtesy header | Default UA is used |
| `NEXT_PUBLIC_SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` | Asset store | No caching |
| `CRON_SECRET` | Daily refresh cron guard | Cron is open (set in production) |

rwa.xyz has no free programmatic API. The tool works without it; qualitative data comes from the seed registry and LLM extraction of issuer disclosures.

## Commands

```bash
npm run dev      # dev server
npm run build    # production build
npm run lint     # eslint
npm run test     # jest (300 tests across rule boundaries and invariants)
npm run seed     # ingest + store flagship assets
npm run verify   # CLI backing check
npm run mcp      # MCP stdio server
```

## Case studies (flagship assets)

Verified-green backing on tokenized RWAs is difficult. Flagship money funds ship no Chainlink Proof-of-Reserve feed. Real green paths are regulator filings (EDGAR, registered funds) or on-chain reconstruction when the reserve wallet is published and attributable.

**BENJI** (EDGAR, filing dated 2026-06-30): Franklin's on-chain token is a share of FOBXX, a registered '40-Act government money-market fund. Its N-MFP3 filing reports $753.2M net assets, shadow NAV at $1.0000, and 100% U.S. Treasuries/agency debt. The on-chain Ethereum slice is $47.8M (6.35% of the fund), so a naive supply x NAV check would produce a false red. `tokenization_mode: tranche_of_registered_fund` applies regulated-structure + NAV integrity instead.

**OUSG** (on-chain verified 2026-07-07): Ondo-published Ethereum addresses hold 0 BUIDL; reserves sit in custodian accounts not attributed on-chain. On-chain reconstruction covers 0% of backing. Real proof is Ankura Trust's off-chain attestation. When registered in `attestation-registry.ts`, the attestation adapter can produce `verified_backed` / `auto`; otherwise the tool returns `unknown`.

## Out of scope (v1)

Smart-contract depth, secondary liquidity, duration modeling, human verification queue, portfolio tools, alerting, historical trends, accounts, public API.

## Specs

`docs/specs/freshness-and-attestation.md` describes the freshness axis and attestation tier (both implemented on this branch). See `docs/ARCHITECTURE.md` for the full module map.

## Data integrity note

Seed contract addresses (`lib/seed/assets.ts`) and the Chainlink PoR registry (`lib/ingestion/adapters/chainlink-registry.ts`) must be verified against primary sources before production use.
