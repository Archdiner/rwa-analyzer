# Methodology

How this tool decides what it decides — and, just as importantly, what it refuses to decide.

## The one question

Every verdict answers one question: **where does proof stop?** For a tokenized asset's backing claim, how much can be *independently* verified, and where does verification end and institutional trust begin? The tool verifies what's provable, names the boundary, and says `unknown` plainly where proof doesn't exist. It never fakes a green.

## The verdict: three axes, never a boolean

A verdict is deliberately **un-collapsible to `safe: true`**. You read three orthogonal axes together:

- **`tier`** — did the backing claim reconcile? `verified_backed` | `partially_verified` | `does_not_reconcile` | `unverifiable`. This is the independence/color axis.
- **`confidence`** — how was the figure obtained? `verified` (on-chain read / regulator filing) | `auto` (LLM-parsed / aggregator) | `unverifiable` (citation failed). This is the extraction axis.
- **`freshness`** — how current is the evidence, relative to how often its source updates? `live` | `aging` | `stale` | `null` (nothing to age). A green is a *historical* claim; this says how historical.

`verified_backed` is **not** a safety guarantee. `unverifiable` is **not** a judgment of danger — absence of a red flag is not a green light. `caveats` is required non-empty unless a verdict is fully verified *and* live.

## Two flagships, the whole philosophy

**BENJI — a genuine green, through regulation.**
Franklin's on-chain token is a share of FOBXX, a registered '40-Act government money-market fund. Its monthly SEC **N-MFP** filing reports the fund's net assets and a market NAV pegged at $1.0000 — regulator-grade, independent, machine-readable. Because the on-chain token is a *slice* of a larger fund, the tool skips the (category-inapplicable) total-pool reconciliation and confers green from **regulated structure + NAV integrity**. Result: `verified_backed / verified / live`. This is the one flagship that goes genuinely green — and it does so through a filing the issuer cannot edit.

**OUSG — an honest unknown, because on-chain doesn't mean verifiable.**
OUSG's reserves sit in segregated custodial accounts with no publicly attributable on-chain wallet, and its attestation is published as a rendered dashboard, not a machine-readable document. On-chain reconstruction resolves 0% of its backing to an attributable wallet; the attestation extractor finds nothing to cite. The tool renders `unverifiable` — not because OUSG is unsafe, but because the evidence to confirm or deny backing isn't machine-readable. It refuses to invent a green.

That pair is the point: here is what real verification looks like, and here is how rarely this asset class can offer it.

## The rules that make a green trustworthy

1. **Green rests only on guards the model cannot argue with.** A green backing verdict may rest only on *arithmetic* (a supply × NAV reconciliation) and *string equality* (a verbatim-substring citation match). One is subtraction; the other is `indexOf`. Neither can be talked around by the model that produced the data.
2. **`parse_confidence` is a floor, never a gate.** A low self-reported parse score can *block* a green; a high one can never *earn* one. The model does not get to grade its own homework into a green.
3. **Citations are verbatim or worthless.** Every LLM-extracted figure carries a `text_span` that is validated as a real substring of the fetched document. If it isn't, the field drops to `unverifiable`.
4. **Composition is not backing (anti-laundering).** Reading that a fund holds another token proves *what it holds*, not that the holding is backed — so a wallet holding an unproven token stays amber, never launders up to green.
5. **The LLM lives only in ingestion.** It turns prose into structured fields. Scoring is deterministic rules, so every verdict is explainable and improvable one rule at a time.

## The evidence hierarchy

Backing reads an array of evidence items, each carrying two independent properties:

- **Independence** (who produced it) sets the *ceiling color*. A regulator filing (5) or an on-chain read of a proven reserve can reach green; an auditor attestation (4) can too, but a custodian feed (3) or issuer self-report (1) cannot.
- **Extraction** (how the number was read) sets the *confidence label*. An on-chain read or a structured filing is `verified`; a parsed PDF is `auto` — "check the citation."

The strongest realized green path today is **EDGAR** (SEC N-MFP), which produces `verified`. The **attestation lane** extends coverage to assets with no SEC filing, but is deliberately a *lesser tier*: independence 4 and LLM-extracted, so it can reach `verified_backed` only at `auto`, never `verified`, and it names the attesting firm — not the SEC — as the trust boundary. Coverage should never blur these two.

## How to read a verdict

- **Human:** read `meaning` and `caveats` first, then `tier` + `confidence` + `freshness` together. The `trust_boundary` tells you exactly where on-chain verification stops.
- **Agent:** gate on `tier` + `confidence`; treat `caveats` as non-ignorable; use `next_expected_update` to know when to re-check. Never reduce the verdict to a boolean.

## What a verdict does not mean

It is a verifiability read of asset **backing** only. It is not investment advice, not a safety or solvency guarantee, and not a read on any app or wrapper used to access the asset. We rate assets, not decisions.
