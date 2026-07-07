# RWA Reliability Analyzer

Tell it where you are and roughly how much you have. It filters tokenized-asset yield down to what you can **actually reach**, ranks it **safety-first**, and shows — for each — exactly where the trust bottoms out. A list makes yield look free; this prices the risk next to it. Or paste any asset by address for the full per-dimension read, where **every claim shows its source and its confidence** and auto-extracted data never wears the same badge as verified data.

This rates **assets** on public facts and **never holds your money** — you deposit with the provider directly. It is not a rating agency and **not financial advice**.

### The decision surface (more than a list)

The landing is the tool. A profile (jurisdiction + amount) drives a pure, tested engine (`lib/decision.ts`) that does three things a static list can't:

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
