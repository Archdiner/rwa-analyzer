# RWA Reliability Analyzer

An honest, machine-readable **backing-verification primitive** for tokenized real-world assets: give it an asset, it tells you whether the backing claim actually reconciles against an independent source — and, just as importantly, where it can't. Callable by an **agent (MCP)**, a **CLI**, or **HTTP**. The website is one client of it.

The one thing it refuses to do is fake a green. Most tools hand back a checkmark; this hands back a structured, two-axis verdict whose caveat is impossible to drop (see **[Call it as a tool](#call-it-as-a-tool)**). That's the exact shape an autonomous agent needs before it parks stablecoins in an instrument it can't eyeball.

This rates **assets** on public facts and **never holds your money** — you deposit with the provider directly. It is not a rating agency and **not financial advice**.

## Call it as a tool

The core is a function — asset in, honest verdict out — exposed three ways over one server-side contract (`lib/agent/verdict.ts`, `GET /api/verify`). The verdict is deliberately **un-collapsible to a boolean**: there is no `safe: true`. Backing is two orthogonal axes you must read together — `tier` (`verified_backed | partially_verified | does_not_reconcile | unverifiable`) and `confidence` (`verified | auto | unverifiable`) — plus a `meaning` sentence, a `trust_boundary`, and `caveats` that are required non-empty unless the verdict is fully verified. `verified_backed` means the backing reconciled against a named independent source; it is **not** a safety guarantee, and `unverifiable` is **not** a judgment of danger — absence of a red flag is not a green light.

**MCP (the primary artifact).** A stdio server exposing `check_asset_backing` and `list_verified_assets`. Register it with any MCP client:

```json
{
  "mcpServers": {
    "rwa-backing-verifier": {
      "command": "npx",
      "args": ["tsx", "mcp/server.ts"],
      "cwd": "/absolute/path/to/rwa-analyzer",
      "env": { "RWA_API_BASE": "https://rwa-analyzer.vercel.app" }
    }
  }
}
```

**CLI.** `npm run verify -- ousg` (or any ticker / `{chainId}:{address}`). Points at the deployed API by default; set `RWA_API_BASE` for a local server. The tier is printed, never encoded in the exit code — you read the verdict, you don't branch on `0/1`.

**HTTP.** `GET /api/verify?asset=OUSG` returns the same `AgentVerdict` JSON.

Scope is tight on purpose: this answers "is this asset's backing real?" — it is not an agent trust/reputation protocol.

### The decision surface (one client, for humans)

The landing is a human client of the same engine. A profile (jurisdiction + amount) drives a pure, tested engine (`lib/decision.ts`) that does three things a static list can't:

1. **Reachability** — closes what you can't legally touch (US-retail vs qualified-purchaser vs non-US), with the plain reason, instead of making you decode legal pages.
2. **Safety-first ranking** — safest backing first, yield only breaking ties within a tier. A green 4.15% ranks above an unknown 6.5%, because yield is the compensation for risk.
3. **The trust boundary on every row** — the one line naming where on-chain verification stops and institutional trust begins.

Public read at `GET /api/universe` (optionally `?jurisdiction=&amount=`).

## How it works

Three modules behind two frozen contracts. Any module can be rewritten in isolation as long as the two shapes hold.

```
 SOURCES              MODULE 1 (Ingestion)      Contract A       MODULE 2 (Computation)     Contract B      MODULE 3 (App)
 on-chain (supply)    source adapters       Normalized Asset      deterministic rules      Assessment        lookup +
 on-chain holdings →  + OpenAI extractor →      Record        →   (no LLM, no grade)   →      Object      →  risk card
 Chainlink PoR        + reconciliation      {fields, backing_                          {dim:{flag,reason,
 EDGAR / DeFiLlama                            evidence[],                               inputs,confidence,
 issuer docs                                  tokenization_mode}                        sources}}
```

Two invariants enforced in code:

1. **Confidence is per field, never per asset.** A `verified` on-chain supply can sit next to an `auto` (LLM-extracted) wrapper type. They are never collapsed.
2. **A verdict's confidence is capped by its inputs' confidence.** If the wrapper type was auto-extracted, the structure verdict is stamped "Based on auto-extracted data." Computation can never emit a confident verdict from unconfident inputs.

The LLM lives only in ingestion (prose → structured fields). Scoring is deterministic rules, so every output is explainable and improvable one rule at a time.

### The edge: the evidence hierarchy (two axes)

Backing reads a `backing_evidence[]` array (Contract A), not a single reserves number. Each item carries two independent axes:

- **Independence** (who wrote the evidence) sets the **ceiling color**. A regulator filing (EDGAR) or an on-chain read of an independently-proven reserve can reach green; an issuer self-report — however cleanly parsed — cannot.
- **Extraction** (how we read the number) sets the **confidence label**. An on-chain read is `verified`; a parsed PDF figure is `auto` ("check the citation").

Two correctness rules make this honest:

- **Anti-laundering.** On-chain reconstruction that holds another token inherits *that token's* backing independence as its ceiling (recursive, cycle-safe). Reading that a fund holds an amber token proves composition, not backing — so it stays amber, never green.
- **Slice-funds.** `tokenization_mode` distinguishes a fully-tokenized fund (reserves reconcile against supply × NAV) from a tranche of a larger registered fund (green comes from a regulator filing + NAV integrity; total-pool reconciliation is category-inapplicable).

**Principle:** green rests only on guards the model cannot argue with — the supply × NAV reconciliation (arithmetic) and the verbatim-substring citation (string equality). `parse_confidence` is a **floor** (a low score can block a green) but **never a gate** (a high score can never earn one).

### Citation validation (integrity spine)

Every LLM-extracted field must carry a `text_span`. That span is validated as a **verbatim substring** of the fetched document; if it fails, the field drops to `unverifiable`. A required-but-unchecked citation is worthless — so we check it.

### Coverage tiers

- **Verified** — seeded flagship assets, qualitative fields human-checked.
- **Auto** — resolved on demand: on-chain + LLM extraction. Labeled "verify yourself"; sources on every field.
- **Unverifiable** — on-chain resolves but no qualitative sources found. On-chain data only, with honest `unknown`s.

## Dimensions

| Dimension | Reads | `unknown` when |
|---|---|---|
| Backing & verification | supply, nav, backing_evidence[], tokenization_mode | nav/supply missing (never a false green off NAV=1.00), or reserve evidence not yet retrieved |
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
| `SEC_USER_AGENT` | courtesy UA for EDGAR (free, no key) | a sensible default is used |
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

## The honest headline

Verified-**green** backing on tokenized RWAs is genuinely hard to produce, and this tool produces it where it can and refuses to fake it everywhere else. The flagship money funds ship **no** Chainlink Proof-of-Reserve feed, so the only paths to a real green are a **regulator filing** (EDGAR, for registered funds) or **on-chain reconstruction** (reading reserves directly) — and reconstruction only works when the reserve wallet is **published and attributable**.

The two flagship cards, side by side, are the whole thesis in one screen:

**BENJI — genuine green, through regulation** (live EDGAR read, filing dated 2026-06-30). Franklin's on-chain token is a share of FOBXX, a registered '40-Act Government money-market fund (SEC series S000067043). Its monthly **N-MFP3** filing reports whole-fund net assets of **$753.2M**, a market-based (shadow) NAV pegged at **$1.0000** across every June observation, holdings **100% U.S. Treasuries / agency debt / Treasury repo**, and a 53-day WAM — regulator-grade, independent, machine-readable. The on-chain Ethereum slice is only **$47.8M (6.35% of the fund)**, so a naive `supply × NAV` check would fire a **~1,475% false red**. `tokenization_mode: tranche_of_registered_fund` skips that category-inapplicable reconciliation and confers green via **regulated structure + NAV integrity** instead. This is the one flagship that goes genuinely green — and it does so through regulation, not a reconstructed balance.

**OUSG — honest unknown, because on-chain doesn't mean verifiable here** (verified on-chain 2026-07-07). The "read OUSG's BUIDL on-chain" story does **not** hold: every Ondo-published Ethereum address holds **0 BUIDL**; the reserves sit in segregated accounts at third-party custodians (Clear Street / Coinbase Custody) for the Ondo I LP SPV — addresses Ondo does not attribute publicly. On-chain reconstruction resolves **0%** of OUSG's backing to an attributable wallet, and its real proof is Ankura Trust's **off-chain** attestation. The tool renders `unknown` (until that attestation is parsed) rather than inventing a green.

That pair is the point: here is what real verification looks like, and here is how rarely this asset class can actually offer it. The narrowness is the product.

## A note on addresses

Seed contract addresses and qualitative facts (`lib/seed/assets.ts`) and the Chainlink PoR registry (`lib/ingestion/adapters/chainlink-registry.ts`) must be verified against primary sources before production. A wrong address or a wrong "fully backed" is the worst-case failure this design exists to avoid.
