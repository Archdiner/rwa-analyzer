# RWA Backing Verifier

**Given a tokenized real-world asset, it tells you whether the backing claim actually reconciles against an independent source — SEC EDGAR filings, on-chain reserves, auditor attestations — and returns a structured, un-collapsible verdict that names exactly where proof stops.** Callable by an **agent (MCP)**, a **CLI**, or **HTTP** (`GET /api/verify`). The website is one client of it.

*In plain terms: before you deposit into tokenized yield, see what's independently provable — and where you start trusting the issuer instead.* This is a verifiability read of **backing**, not a safety score. It never holds your money and it **refuses to fake a green**.

This is an open-source public good — a primitive, not a product. There are **adopters, not customers** (agents, wallet builders, risk desks, researchers): no billing, no accounts, no monetization. Repo: **[`Archdiner/rwa-analyzer`](https://github.com/Archdiner/rwa-analyzer)**.

---

## The verdict: three axes, never a boolean

Most tools hand back a checkmark. This hands back a verdict that is **deliberately un-collapsible to `safe: true`** — there is no boolean. You read three orthogonal axes together:

- **`tier`** — did the backing claim reconcile? `verified_backed | partially_verified | does_not_reconcile | unverifiable`. *(the independence / color axis)*
- **`confidence`** — how was the figure obtained? `verified` (on-chain read or regulator filing) `| auto` (LLM-parsed) `| unverifiable` (citation failed). *(the extraction axis)*
- **`freshness`** — how current is the evidence, relative to how often its source updates? `live | aging | stale | null`. *(a green is a historical claim; this says how historical)*

Plus a `meaning` sentence, a `trust_boundary` naming where on-chain verification stops, and `caveats` that are **required non-empty** unless a verdict is fully `verified_backed` **and** `verified` **and** `live`. `verified_backed` is **not** a safety guarantee; `unverifiable` is **not** a judgment of danger — absence of a red flag is not a green light.

Full reasoning: **[`docs/METHODOLOGY.md`](docs/METHODOLOGY.md)**.

## The thesis: BENJI vs OUSG

Two flagships, side by side, are the whole point — one genuine green, one honest unknown.

**BENJI — a genuine green, through regulation.** Franklin's on-chain token is a share of FOBXX, a registered '40-Act government money-market fund (SEC series S000067043). Its monthly **N-MFP** filing reports the fund's net assets and a market NAV pegged at $1.0000 — regulator-grade, independent, machine-readable. The on-chain slice is only ~6% of the fund, so a naive `supply × NAV` check would fire a ~1,475% false red; `tokenization_mode: tranche_of_registered_fund` skips that category-inapplicable reconciliation and confers green from **regulated structure + NAV integrity** instead. Result: `verified_backed / verified / live`, via a filing the issuer cannot edit.

**OUSG — an honest unknown, because on-chain doesn't mean verifiable.** OUSG's reserves sit in segregated custodial accounts with no publicly attributable on-chain wallet; every Ondo-published Ethereum address holds **0 BUIDL**. On-chain reconstruction resolves **0%** of its backing to an attributable wallet, and its real proof is an off-chain auditor attestation. The tool renders `unverifiable` — not because OUSG is unsafe, but because the evidence to confirm or deny its backing isn't machine-readable. It refuses to invent a green.

That pair is the point: here is what real verification looks like, and here is how rarely this asset class can offer it. **Of the seven flagship assets, exactly one (BENJI) goes genuinely green; the other six are honest unknowns.** The narrowness is the product.

## Quickstart — call it as a tool

Every surface speaks one contract — the `AgentVerdict` — so the CLI, the MCP tool, and the HTTP API can never disagree. Full guide, response schema, and an agent-guard example: **[`docs/INTEGRATIONS.md`](docs/INTEGRATIONS.md)**.

**HTTP.**

```bash
curl "https://rwa-analyzer.vercel.app/api/verify?asset=BENJI"
# → { "success": true, "data": <AgentVerdict> }  — same three axes, wrapped
```

**MCP (agents).** A stdio server exposing `check_asset_backing` and `list_verified_assets`. Register it with any MCP client (Claude, Cursor, etc.):

```jsonc
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

**CLI.**

```bash
npm run verify -- benji          # any ticker or {chainId}:{address}
```

The tier is printed, never encoded in the exit code — a caller reads the verdict, it doesn't branch on `0/1`. The golden rule on every surface: **do not reduce the verdict to a boolean.** Read `tier` + `confidence` + `freshness` together and carry the `caveats`.

Scope is tight on purpose: this answers "is this asset's backing real?" — it is not an agent trust/reputation protocol.

## How it works

Three modules behind two frozen contracts (`lib/contracts.ts`). Any module can be rewritten in isolation as long as the two shapes hold.

```
 SOURCES              MODULE 1 (Ingestion)      Contract A       MODULE 2 (Computation)     Contract B      MODULE 3 (App)
 on-chain (supply)    source adapters       Normalized Asset      deterministic rules      Assessment        lookup +
 on-chain holdings →  + OpenAI extractor →      Record        →   (no LLM, no grade)   →      Object      →  risk card
 Chainlink PoR        + reconciliation      {fields, backing_                          {dim:{flag,reason,
 EDGAR / attestation                          evidence[],                               inputs,confidence,
 issuer docs                                  tokenization_mode}                        sources}}
```

Two invariants enforced in code:

1. **Confidence is per field, never per asset.** A `verified` on-chain supply can sit next to an `auto` (LLM-extracted) wrapper type. They are never collapsed.
2. **A verdict's confidence is capped by its inputs' confidence.** Computation can never emit a confident verdict from unconfident inputs.

The LLM lives **only** in ingestion (prose → structured fields). Scoring is deterministic rules, so every output is explainable and improvable one rule at a time.

### The edge: the evidence hierarchy

Backing reads a `backing_evidence[]` array, not a single reserves number. Each item carries two independent properties:

- **Independence** (who produced the evidence) sets the **ceiling color**. A regulator filing (EDGAR) or an on-chain read of an independently-proven reserve can reach green; an auditor attestation can too, but only at a lesser tier; an issuer self-report — however cleanly parsed — cannot.
- **Extraction** (how the number was read) sets the **confidence label**. An on-chain read is `verified`; a parsed PDF figure is `auto` ("check the citation").

Two correctness rules keep it honest:

- **Anti-laundering.** On-chain reconstruction that holds another token inherits *that token's* backing independence as its ceiling (recursive, cycle-safe). Reading that a fund holds an amber token proves composition, not backing — so it stays amber, never green.
- **Green rests only on guards the model cannot argue with** — the `supply × NAV` reconciliation (arithmetic) and the verbatim-substring citation (string equality). `parse_confidence` is a **floor** (a low score can block a green) but **never a gate** (a high score can never earn one). EDGAR is the only `verified`-green path in the flagship set; the auditor-attestation lane extends coverage but is capped at `auto`, and names the attesting firm — not the SEC — as the trust boundary.

### Freshness (the third axis)

A green is a claim about a moment in time. Freshness measures each source against how often it actually updates (`live` / `aging` / `stale`) and only ever **demotes** a flag, never promotes it — a stale filing downgrades one notch and always carries a caveat. `next_expected_update` tells an agent when to re-check.

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
npm run test     # jest (rule boundaries + the code-enforced invariants)
npm run verify   # CLI: npm run verify -- <ticker | chainId:address>
npm run mcp      # stdio MCP server
npm run seed     # ingest + store flagship assets
```

## Out of scope (v1)

Smart-contract/oracle depth, secondary-liquidity depth, duration modeling, human-verification queue, comparison/portfolio/watchlists, alerting, historical trends, accounts. The [roadmap](docs/ROADMAP.md) expands from backing to yield-source provenance — the same three-axis engine, applied by yield-source *category* (lending, staking, restaking, …), never a per-token leaderboard, with `unknown` always a valid answer.

## A note on addresses

Seed contract addresses and qualitative facts (`lib/seed/assets.ts`) and the Chainlink PoR registry (`lib/ingestion/adapters/chainlink-registry.ts`) must be verified against primary sources before production. A wrong address or a wrong "fully backed" is the worst-case failure this design exists to avoid.

## Not financial advice

This rates **assets** on public facts and never holds your money — you deposit with the provider directly. It is a verifiability read of asset **backing** only: not a rating agency, not a safety or solvency guarantee, and not a read on any app or wrapper used to access the asset. **We rate assets, not decisions.**
