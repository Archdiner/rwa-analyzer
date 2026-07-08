# Spec: Freshness Axis + Attestation Tier

Status: implemented · Scope: additive to the frozen contracts · Jul 2026

Two changes that compose. **Freshness** makes evidence age a first-class,
machine-readable axis instead of a binary cliff buried in prose. **Attestation
tier** unlocks coverage (OUSG-class assets) through auditor attestations without
diluting the SEC-primary-filing moat - the two-axis verdict already has the
vocabulary to say "backed, but you trust the CPA, not the regulator."

Both obey the existing invariants: additive contract changes only; green rests
only on arithmetic/string-equality guards; `parse_confidence` stays a floor,
never a gate; the agent verdict has no boolean safe flag; new signals
only ever **demote**, never promote.

---

## Part A - Freshness as a third axis

### Problem

`lib/computation/backing.ts` handles staleness with `stale(asOf, windowMs)` and
two hard-coded windows (`FRESH_WINDOW_MS` = 3d, `FILING_FRESH_WINDOW_MS` = 45d),
downgrading the flag and **appending a sentence to `reason`**. Three defects:

1. **Cliff, not gradient.** Day 44 = green, day 46 = amber. Backing risk rises
   continuously between monthly filings; the verdict is flat until it snaps.
2. **Buried in prose.** `tier` and `confidence` are structured; freshness is a
   string an agent must re-parse. It should be a structured field on the verdict.
3. **Conflates absolute vs per-cadence age.** A 20-day-old N-MFP is normal; a
   20-day-old Chainlink PoR feed is broken. Two ad-hoc windows encode this
   weakly.

### Contract additions (`lib/contracts.ts`, additive)

```ts
const DAY = 24 * 60 * 60 * 1000;

/** Expected refresh cadence per source type - how often the source itself
 *  updates. Drives freshness relative to cadence, not an absolute clock. */
export const EXPECTED_CADENCE_MS: Record<EvidenceSourceType, number> = {
  oracle_por:          1 * DAY,
  onchain_holdings:    1 * DAY,
  custodian_feed:      1 * DAY,
  issuer_selfreport:   7 * DAY,
  admin_report:        35 * DAY,   // ~monthly
  auditor_attestation: 35 * DAY,   // ~monthly; quarterly overridden per-item
  regulator_filing:    35 * DAY,   // N-MFP monthly; N-CSR ~183d overridden per-item
};

export type Freshness = "live" | "aging" | "stale";
```

Optional per-item override for forms whose cadence differs from the source-type
default (N-CSR semiannual, quarterly attestations):

```ts
export interface EvidenceItem {
  // ...existing fields...
  /** Overrides EXPECTED_CADENCE_MS[source_type] when a specific form/feed has a
   *  known cadence (e.g. N-CSR ~183d). Optional; additive. */
  cadence_ms?: number;
}
```

### Computation (`lib/computation/backing.ts`)

Add a pure helper and replace `stale()` at its two call sites.

```ts
function freshnessOf(ev: EvidenceItem): {
  level: Freshness; ratio: number; next_expected: string;
} {
  const cadence = ev.cadence_ms ?? EXPECTED_CADENCE_MS[ev.source_type];
  const age = Date.now() - new Date(ev.as_of).getTime();
  const ratio = age / cadence;
  const level: Freshness = ratio <= 1 ? "live" : ratio <= 2 ? "aging" : "stale";
  const next_expected = new Date(new Date(ev.as_of).getTime() + cadence).toISOString();
  return { level, ratio, next_expected };
}
```

Gradient downgrade (replaces the binary `stale()` downgrade inside `guardGreen`
and the two inline staleness blocks). **Demote-only, never promote:**

| ratio        | level | effect on flag                  |
|--------------|-------|---------------------------------|
| `<= 1`       | live  | none                            |
| `1 < r <= 2` | aging | note only, no downgrade         |
| `2 < r <= 3` | stale | `downgradeFlag` once            |
| `r > 3`      | stale | drop to `unknown`               |

```ts
function applyFreshness(flag: Flag, reason: string, ev: EvidenceItem): {
  flag: Flag; reason: string; freshness: Freshness;
} {
  const { level, ratio } = freshnessOf(ev);
  if (level === "live") return { flag, reason, freshness: level };
  const aged = shortDate(ev.as_of);
  if (level === "aging")
    return { flag, reason: `${reason} Evidence is aging (as of ${aged}).`, freshness: level };
  const f = ratio > 3 ? "unknown" : downgradeFlag(flag);
  return { flag: f, reason: `${reason} Reserve data is stale (as of ${aged}).`, freshness: level };
}
```

- `guardGreen` keeps the `parse_confidence` floor block, then calls
  `applyFreshness` instead of its own `stale()` branch.
- `assessTranche` and the `assessFullyTokenized` self-report tail call
  `applyFreshness` too, so every path returns a `freshness`.
- `DimensionAssessment` gains an additive `freshness?: Freshness` field carried
  through `build()`.

### Verdict surface (`lib/agent/verdict.ts`)

`AgentVerdict.backing` gains two top-level fields (additive):

```ts
backing: {
  tier, confidence,
  freshness: Freshness,          // ← third axis, read alongside tier + confidence
  as_of,                         // already the assessment stamp
  next_expected_update: string,  // strongest evidence's as_of + cadence
  reason, meaning, trust_boundary, caveats,
}
```

- `AgentEvidence` gains `freshness` + `next_expected` per item.
- `buildCaveats`: when `freshness !== "live"`, push a caveat
  (`"Backing evidence is aging/stale (as of …); re-verify after {next_expected_update}."`).
  This means a stale verdict can never satisfy the "no caveats" exemption.
- `disclaimer` unchanged.

### Display (`components/…` card)

A freshness pill next to the tier chip: `live` (neutral/green tint), `aging`
(amber tint), `stale` (red tint). Show `next_expected_update` as "updates ~{date}".

### Tests (`lib/computation/__tests__/`, `lib/agent/__tests__/`)

- Gradient boundaries: `ratio` 0.9 → live/no-change; 1.5 → aging/note-only;
  2.5 → stale/one-downgrade; 3.5 → unknown.
- **Demote-only:** freshness never turns an amber into a green or an unknown
  into anything higher (mirror the reconciliation demote-only invariant).
- Per-source cadence: a 20-day-old `oracle_por` (cadence 1d → ratio 20) is
  stale→unknown; a 20-day-old `regulator_filing` (cadence 35d → ratio 0.57) is
  live.
- `cadence_ms` override honored (N-CSR at 100 days is still live).
- Verdict: `freshness` + `next_expected_update` present on every backing verdict;
  a stale green carries a non-empty caveat.

---

## Part B - Attestation tier (Lane C)

### Goal

Convert the "unknown wall" (OUSG, BUIDL-via-Securitize attestations, private
credit) from *empty* to *cited*, **without** letting attestation-backed greens
look like SEC-primary-filing greens. The contract already encodes the
distinction; this wires the adapter and hardens the anti-dilution boundary.

Key facts from the existing contract:
- `auditor_attestation` has `NOMINAL_INDEPENDENCE` **4**, above
  `GREEN_INDEPENDENCE_FLOOR` (3) → green-capable.
- Its `extraction` is `llm_extracted` → `confidence` is `auto`, never `verified`.
- Therefore an attestation-backed green is necessarily
  **`tier: verified_backed` + `confidence: auto`** - a real cell, visibly lesser
  than a regulator filing's `verified_backed` + `verified`.
- Green still requires the supply×NAV reconciliation (arithmetic) - so it is not
  "trust the CPA blindly," it is "the CPA's number **reconciles on-chain**." The
  green still rests on an un-arguable guard.

### New adapter (`lib/ingestion/adapters/attestation.ts`)

```ts
export async function attestationAdapter(asset: ParsedAssetId): Promise<AdapterResult>
```

1. Look up the asset in a human-gated `attestation-registry.ts`
   (`asset_id → { doc_url, administrator_name, cadence_ms }`). No entry → `EMPTY`.
2. Fetch the attestation doc (PDF via `unpdf`, already a dependency).
3. LLM-extract `{ reserves_value, as_of, coverage_pct, text_span }` - reuse the
   `extractor.ts` + `citations.ts` path.
4. **Validate the `text_span` as a verbatim substring** of the fetched doc
   (existing citation guard). Fail → the item drops to `unverifiable` → the
   resolver reads it as no independent evidence (honest unknown, not a green).
5. Emit one `EvidenceItem`:
   ```ts
   {
     source_type: "auditor_attestation",
     independence: 4,
     extraction: "llm_extracted",
     confidence: "auto",
     parse_confidence: <model 0–1>,   // FLOOR only - < 0.85 blocks green
     citation: { url, text_span },
     cadence_ms: <registry cadence>,  // ties into Part A
     coverage_pct, reserves_value, as_of,
     source: `Attestation - ${administrator_name}`,
   }
   ```

Wire it into `ingestQuant`'s `Promise.all` beside `edgarAdapter`. **No change to
`backing.ts` resolver logic** - an attestation item flows through
`assessFullyTokenized` exactly like any other independent evidence. `guardGreen`
already applies `PARSE_CONFIDENCE_FLOOR` because `extraction === "llm_extracted"`.

### Anti-dilution boundary (the discipline)

The verdict must never let an attestation green read as a regulator green.

- `meaningFor()` already composes from the strongest item's
  `EVIDENCE_SOURCE_LABELS` + `EVIDENCE_TRUST_BOUNDARY` (`lib/display.ts`). Add /
  verify an `auditor_attestation` entry in `EVIDENCE_TRUST_BOUNDARY` that names
  the firm-trust boundary explicitly, e.g.
  *"verification stops at the attesting firm - you trust {administrator} did the
  reconciliation, not the SEC."*
- Card/UI: a **"primary source"** badge appears only on independence-5 greens
  (regulator filing / on-chain read). An attestation green shows a
  **"attested"** badge, visually subordinate. Never the same treatment.

### New invariants (tested)

- **No attestation-only verdict emits `confidence: "verified"`.** Only
  `regulator_filing` (structured) or `onchain_read` items can reach
  `confidence: verified`. An `auditor_attestation`-only backing is at most
  `verified_backed` + `auto`.
- **Citation is required.** A tampered `text_span` (non-substring) drops the
  item to `unverifiable`; the asset renders `unknown`, never a green.
- **Parse floor blocks, never gates.** `parse_confidence` 0.80 (< 0.85) on an
  otherwise-reconciling attestation → amber, not green. `parse_confidence` 0.99
  alone (without the supply×NAV match) → never green.
- **`meaning` names the firm boundary** for attestation greens; asserts the
  string does not contain "SEC" / "regulator."

### Fixture

`lib/ingestion/__tests__/fixtures/ousg-ankura-attestation.pdf` (or a text
extract) + a golden test: OUSG → `verified_backed` / `auto`, citation present,
`meaning` names Ankura, freshness driven by the registry cadence.

---

## Sequencing

1. **Part A first** - it is self-contained, touches only computation + verdict +
   display, and makes attestation greens legible (their monthly/quarterly cadence
   is the whole point of surfacing freshness). Ship + test.
2. **Part B second** - depends on nothing in A structurally, but reads far better
   once freshness exists (an attestation green *should* visibly age).
3. Both land behind the frozen contracts; no existing field is repurposed.

## Acceptance criteria

- Every backing verdict exposes `freshness` + `next_expected_update` top-level.
- Freshness only demotes; a stale green carries a non-empty caveat.
- OUSG resolves to a cited `verified_backed` / `auto` when its attestation is
  registered; to `unknown` when the citation fails.
- No attestation path can emit `confidence: verified` or a "primary source"
  badge.
- BENJI (regulator filing) remains `verified_backed` / `verified` with the
  "primary source" badge, visibly distinct from OUSG's attested green.
