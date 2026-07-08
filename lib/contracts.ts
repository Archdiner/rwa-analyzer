// ---------------------------------------------------------------------------
// FROZEN CONTRACTS
// ---------------------------------------------------------------------------
// These are the two stable shapes the whole system depends on:
//
//   Contract A - NormalizedAssetRecord   (Ingestion  -> Computation)
//   Contract B - Assessment              (Computation -> App)
//
// As long as these hold, any module can be rewritten in isolation. Two rules
// hold everything together and are enforced downstream, not here:
//   1. Confidence is per FIELD, never per asset.
//   2. A verdict's confidence is capped by the min confidence of its inputs.
//
// Do not casually reshape these. Add fields additively; never repurpose one.
// ---------------------------------------------------------------------------

// ── Provenance primitives ──────────────────────────────────────────────────

/** How a field's value was obtained. */
export type Method =
    | "onchain_read"
    | "aggregator"
    | "reference_api"
    | "llm_extracted"
    | "manual";

/**
 * Trust level of a single field.
 *   verified     - independently checkable (on-chain read, attested feed, ref API)
 *   auto         - machine-derived, plausible but unconfirmed (LLM, aggregator)
 *   unverifiable - required but missing, or a citation that failed validation
 */
export type Confidence = "verified" | "auto" | "unverifiable";

/** A verified fact required whenever `method === "llm_extracted"`. */
export interface Citation {
    /** Source document URL. */
    url: string;
    /** Exact text span the value was extracted from. Validated as a verbatim
     *  substring of the fetched document before the field is trusted. */
    text_span: string;
}

/** Primitive field values carried through the record. */
export type FieldValue = string | number | boolean;

/** The universal field-object shape. Every ingested field is one of these. */
export interface FieldObject<T extends FieldValue = FieldValue> {
    value: T;
    source: string; // e.g. "onchain", "chainlink_por", "rwa.xyz", "llm:prospectus"
    method: Method;
    confidence: Confidence;
    /** ISO-8601 timestamp of when the value was true at source. */
    as_of: string;
    /** Required when method === "llm_extracted"; null otherwise. */
    citation: Citation | null;
}

// ── Domain enums (extraction + reference vocab) ──────────────────────────────

/**
 * How an oracle/feed reserve is proven. `unknown` (feed not classified) is
 * intentionally distinct from `self_reported` (known to be issuer-reported) and
 * `none` (no reserve feed at all). Used to classify `oracle_por` evidence into
 * an independence rank.
 */
export type ReservesMethod = "auditor_attested" | "self_reported" | "unknown" | "none";

// ── Backing evidence (v1.1 - the Evidence-Source Hierarchy) ──────────────────
//
// Backing is a TWO-AXIS judgement, and the two axes must never be conflated:
//
//   INDEPENDENCE (who wrote the evidence) sets the CEILING COLOR a backing
//     verdict may reach. A regulator filing or an on-chain read of an
//     independently-proven reserve can reach green; an issuer self-report,
//     however cleanly parsed, cannot.
//   EXTRACTION (how we got the number) sets the CONFIDENCE LABEL. An on-chain
//     read is `verified`; a parsed PDF figure is `auto` ("check the citation").
//
// The old single reserves_value/reserves_method pair is replaced by an ARRAY of
// evidence items: real reserves are assembled from several partial sources
// (some on-chain, some filed, some attested), and each carries its own axes.
//
// ───────────────────────────────────────────────────────────────────────────
// PRINCIPLE - GREEN RESTS ONLY ON GUARDS THE MODEL CANNOT ARGUE WITH.
//
// A green backing verdict may rest ONLY on checks that are arithmetic or string
// equality: the verbatim-substring citation match, and the supply×NAV
// reconciliation. Neither can be talked around by the model that produced the
// data - one is `indexOf`, the other is subtraction.
//
// `parse_confidence` is the model grading its own homework. It is a FLOOR
// (a low score CAN block a green) but NEVER a GATE (a high score can NEVER, by
// itself, earn one). Do not promote parse_confidence to a gate: six months from
// now it will be tempting, and it would let a confidently-wrong parse mint a
// false green. The whole product exists to refuse exactly that.
// ───────────────────────────────────────────────────────────────────────────

/** Where a piece of backing evidence comes from. Drives the independence axis. */
export type EvidenceSourceType =
    | "regulator_filing" // SEC EDGAR N-MFP/N-CSR etc. - regulator-grade, independent
    | "onchain_holdings" // reserves read directly on-chain (reconstruction)
    | "auditor_attestation" // independent auditor sign-off
    | "admin_report" // fund administrator report (stronger than issuer-self)
    | "custodian_feed" // custodian-published balance
    | "oracle_por" // Chainlink/other PoR feed (independence set by classification)
    | "issuer_selfreport"; // issuer's own transparency page/PDF - self-reported

/**
 * Nominal independence (0–5) per source type. `onchain_holdings` and
 * `oracle_por` are CONDITIONAL: the adapter stamps the real independence on each
 * item (on-chain reconstruction of an unproven token cannot exceed that token's
 * own backing independence - the anti-laundering ceiling; an oracle feed's rank
 * depends on whether it is auditor-attested vs self-reported).
 */
export const NOMINAL_INDEPENDENCE: Record<EvidenceSourceType, number> = {
    regulator_filing: 5,
    onchain_holdings: 5,
    auditor_attestation: 4,
    oracle_por: 4,
    admin_report: 3,
    custodian_feed: 3,
    issuer_selfreport: 1,
};

/** Independence at or above this is "independent enough" to support green. */
export const GREEN_INDEPENDENCE_FLOOR = 3;

/** Below this LLM self-reported parse confidence, a parsed figure cannot
 *  support a green (a FLOOR - see the principle above; never used as a gate). */
export const PARSE_CONFIDENCE_FLOOR = 0.85;

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * How often each evidence source is EXPECTED to refresh. Freshness is measured
 * relative to this cadence, not an absolute clock: a 20-day-old N-MFP is normal
 * (monthly), a 20-day-old oracle feed is broken (daily). A per-item `cadence_ms`
 * overrides this when a specific form differs (e.g. N-CSR ~183d).
 */
export const EXPECTED_CADENCE_MS: Record<EvidenceSourceType, number> = {
    oracle_por: 1 * DAY_MS,
    onchain_holdings: 1 * DAY_MS,
    custodian_feed: 1 * DAY_MS,
    issuer_selfreport: 7 * DAY_MS,
    admin_report: 35 * DAY_MS, // ~monthly
    auditor_attestation: 35 * DAY_MS, // ~monthly; quarterly overridden per-item
    regulator_filing: 35 * DAY_MS, // N-MFP monthly; N-CSR ~183d overridden per-item
};

/**
 * Evidence age relative to its expected cadence - the THIRD axis of a backing
 * verdict, read alongside `tier` and `confidence`. A green is a historical
 * claim; freshness makes its age machine-readable instead of prose. It only
 * ever DEMOTES a flag, never promotes one.
 */
export type Freshness = "live" | "aging" | "stale";

/** How a single evidence item's number was obtained (its confidence label). */
export type EvidenceExtraction = "onchain_read" | "structured" | "llm_extracted";

/** One piece of backing evidence. Reserves are the sum across items. */
export interface EvidenceItem {
    source_type: EvidenceSourceType;
    /** Actual independence 0–5 for THIS item (may be ceilinged below nominal). */
    independence: number;
    /** USD value of reserves this item accounts for. */
    reserves_value: number;
    /** Share of the asset's backing this item covers, 0–100. */
    coverage_pct: number;
    /** ISO-8601 timestamp the evidence was true at source. */
    as_of: string;
    extraction: EvidenceExtraction;
    confidence: Confidence;
    /** LLM self-reported 0–1, or null for non-LLM. A floor, never a gate. */
    parse_confidence: number | null;
    /** Required when extraction === "llm_extracted"; null otherwise. */
    citation: Citation | null;
    /** Provenance label for the source expander. */
    source: string;
    /** Optional caveat surfaced to the user (e.g. underlying not proven). */
    note?: string;
    /** Overrides EXPECTED_CADENCE_MS[source_type] when a specific form/feed has a
     *  known cadence (e.g. N-CSR ~183d). Optional; additive. */
    cadence_ms?: number;
}

/**
 * Whether the on-chain token IS the fund, or a slice of a bigger fund. Decides
 * how reserves reconcile:
 *   fully_tokenized             - reserves reconcile against supply × NAV.
 *   tranche_of_registered_fund  - on-chain supply is a slice of a larger
 *                                 regulated fund; total-pool reconciliation is
 *                                 category-inapplicable. A regulator filing
 *                                 confers green via regulated structure + NAV
 *                                 integrity, not supply×NAV matching.
 */
export type TokenizationMode = "fully_tokenized" | "tranche_of_registered_fund" | "unknown";

export type WrapperType =
    | "registered_fund_40act"
    | "registered_fund_other"
    | "private_fund"
    | "spv"
    | "mirror_token"
    | "unbacked"
    | "unknown";

export type RedemptionSpeed =
    | "instant"
    | "instant_capped"
    | "daily"
    | "t_plus_n"
    | "none"
    | "unknown";

export type Jurisdiction =
    | "permissionless"
    | "non_us_only"
    | "us_retail"
    | "us_accredited"
    | "us_qualified_purchaser"
    | "eu_only"
    | "unknown";

export type YieldSource =
    | "tbill"
    | "mmf"
    | "private_credit"
    | "active_strategy"
    | "commodity"
    | "equity"
    | "unknown";

// ── Yield-source + market-risk dimensions (v1.2 - additive) ──────────────────
//
// Two NEW deterministic dimensions generalize the engine from "is the backing
// real?" to "where does this yield come from, and where does proof stop?".
// Both are ADDITIVE to the frozen contracts and keep the same honesty: a green
// rests only on an on-chain read (arithmetic the model cannot argue with), and
// `unknown` is a first-class outcome - a signal that cannot be read is never
// assumed benign. See docs/plans/…-yield-source-lending-adapter-plan.md.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * What activity generates an asset's yield. `emissions` = reward tokens minted
 * (inflationary), `lending_interest` = borrow interest paid by borrowers
 * (organic), `mixed` = both are material, `unknown` = not classifiable.
 */
export type YieldSourceKind =
    | "lending_interest"
    | "staking"
    | "amm_fees"
    | "perp_funding"
    | "rwa_coupon"
    | "emissions"
    | "mixed"
    | "unknown";

/**
 * Per-signal risk grade for the `market_risk` dimension. `unknown` is NOT
 * benign: it means the signal could not be derived and is surfaced as such,
 * never silently treated as `ok`.
 */
export type RiskSignalLevel = "ok" | "caution" | "critical" | "unknown";

/**
 * One raw read feeding a v1.2 dimension. Like `FieldObject`, but its `value` is
 * NULLABLE: null means the accessor was unavailable on the running contract
 * version (or a cross-ref failed), so the signal reads `unknown` downstream -
 * never as 0. On-chain reads are `verified`; an aggregator cross-ref is `auto`.
 */
export interface DimensionRead<T extends FieldValue = number> {
    value: T | null;
    /** Provenance label, e.g. "aave:v3:pool", "aave:oracle", "defillama". */
    source: string;
    method: Method;
    confidence: Confidence;
    /** ISO-8601 timestamp the read was true at source (block/reserve time). */
    as_of: string;
}

/**
 * Additive Contract-A payload for the `yield_source` dimension. Decomposes an
 * asset's yield into organic (borrow interest, on-chain-derived, `verified`) vs.
 * inflationary (reward emissions, `auto` cross-ref). `reward_apy.value === null`
 * means emissions could not be read - honestly `unknown`, never assumed 0.
 */
export interface YieldSourceData {
    /** Organic supply APY (%) derived from the reserve's on-chain rate. */
    organic_apy: DimensionRead<number>;
    /** Reward/emissions APY (%). null value → emissions unknown, not 0. */
    reward_apy: DimensionRead<number>;
    /** Dominant kind, derived from the organic/reward split by the adapter. */
    kind: YieldSourceKind;
    /** Symbol of the underlying whose value the yield ultimately rests on. */
    underlying_symbol: string;
    /** Ceiling color the verdict may reach given the underlying's OWN
     *  verification status (anti-laundering: you cannot be safer than the thing
     *  you lent). Omitted = no known constraint applied. */
    underlying_ceiling?: Flag;
}

/**
 * Additive Contract-A payload for the `market_risk` dimension: the reserve's
 * on-chain risk state. Every field is a `DimensionRead` so a value that cannot
 * be read (e.g. a `deficit`/bad-debt accessor absent on the running version)
 * carries `value: null` and grades `unknown`, never a false `ok`.
 */
export interface MarketRiskData {
    /** Borrow utilization, 0–1 (totalBorrowed / totalSupplied). */
    utilization: DimensionRead<number>;
    /** Liquidity available to withdraw/borrow, in underlying units. */
    available_liquidity: DimensionRead<number>;
    total_supplied: DimensionRead<number>;
    total_borrowed: DimensionRead<number>;
    /** Supply/borrow caps in underlying units. 0 = disabled (Aave convention). */
    supply_cap: DimensionRead<number>;
    borrow_cap: DimensionRead<number>;
    /** Loan-to-value, 0–1 (reserve-level config, not per-borrower). */
    ltv: DimensionRead<number>;
    /** Liquidation threshold, 0–1. Buffer = threshold − ltv. */
    liquidation_threshold: DimensionRead<number>;
    /** Reserve factor (protocol cut), 0–1. */
    reserve_factor: DimensionRead<number>;
    is_active: DimensionRead<boolean>;
    is_frozen: DimensionRead<boolean>;
    is_paused: DimensionRead<boolean>;
    /** Collateral USD price from the protocol oracle. 0/null → cannot value. */
    oracle_price: DimensionRead<number>;
    /** The oracle contract/address that prices collateral - the trust boundary. */
    oracle_source: DimensionRead<string>;
    /** Bad debt / reserve deficit in USD. null value → not derivable → unknown. */
    deficit: DimensionRead<number>;
    /** Symbol of the reserve's underlying asset. */
    underlying_symbol: string;
    /** Ceiling color the verdict may reach given the underlying's OWN
     *  verification status (anti-laundering). Omitted = no known constraint. */
    underlying_ceiling?: Flag;
}

// ── Field registry ───────────────────────────────────────────────────────────

/** The complete set of field keys a record may carry. */
export type FieldName =
    | "supply"
    | "nav"
    | "auditor"
    | "custodian"
    | "issuer_domicile"
    | "wrapper_type"
    | "redemption_speed"
    | "redemption_cap"
    | "jurisdiction"
    | "min_investment_usd"
    | "kyc_required"
    | "yield_apy"
    | "yield_source"
    | "aum"
    | "holders";

/** Partial map of fields - adapters return a subset; reconcile merges them. */
export type FieldMap = Partial<Record<FieldName, FieldObject>>;

// ── Contract A - Normalized Asset Record ─────────────────────────────────────

export interface AssetIdentifiers {
    name: string;
    symbol: string;
    chain_id: number;
    contract_address: string;
    issuer_name?: string;
}

/** Recorded when two sources disagree on a field. Never silently resolved. */
export interface FieldConflict {
    field: FieldName;
    values: FieldValue[];
    sources: string[];
}

/** Contract A. Ingestion produces this; Computation consumes it. */
export interface NormalizedAssetRecord {
    /** Canonical key: "{chainId}:{contractAddress}" (lowercased address). */
    asset_id: string;
    identifiers: AssetIdentifiers;
    fields: FieldMap;
    /** Backing evidence (v1.1). Reserves are assembled from these items; the
     *  backing resolver reads them, never a single reserves field. */
    backing_evidence: EvidenceItem[];
    /** Whether the on-chain token is the whole fund or a slice (drives how
     *  reserves reconcile). Defaults to "unknown" until curated/derived. */
    tokenization_mode: TokenizationMode;
    conflicts: FieldConflict[];
    ingested_at: string;
    /** Marks whether the slow qualitative pass has run yet (two-phase ingest). */
    qualitative_pending?: boolean;
    /** On-chain yield decomposition (v1.2, additive). Present only for assets a
     *  yield-source adapter resolved (e.g. Aave v3 reserves); absent → the
     *  `yield_source` dimension reads `unknown`. */
    yield_source_data?: YieldSourceData;
    /** On-chain market-risk state (v1.2, additive). Present only for lending
     *  reserves; absent → the `market_risk` dimension reads `unknown`. */
    market_risk_data?: MarketRiskData;
}

// ── Contract B - Assessment ──────────────────────────────────────────────────

/** A dimension verdict. `unknown` is a first-class outcome, not an error. */
export type Flag = "green" | "amber" | "red" | "unknown";

export type DimensionKey = "backing" | "redemption" | "access" | "structure";

export interface DimensionAssessment {
    flag: Flag;
    /** Plain-language, templated explanation. */
    reason: string;
    /** Field names that fed this verdict (for the source expander). */
    inputs: FieldName[];
    /** Capped at the min confidence of the inputs used. */
    confidence: Confidence;
    /** Source labels backing this verdict. */
    sources: string[];
    /** Evidence age relative to cadence (backing only). Absent = not age-sensitive. */
    freshness?: Freshness;
}

/** Contract B. Computation produces this; the App consumes it. */
export interface Assessment {
    asset_id: string;
    /** Lowest confidence among dimensions used. A tier label, NOT a risk grade. */
    overall_confidence: Confidence;
    dimensions: Record<DimensionKey, DimensionAssessment>;
    computed_at: string;
}

// ── Invariant helpers (intrinsic to rule 2) ──────────────────────────────────

/** Higher rank = more trustworthy. */
export const CONFIDENCE_RANK: Record<Confidence, number> = {
    unverifiable: 0,
    auto: 1,
    verified: 2,
};

/** Returns the least-trustworthy confidence in a list. Empty list -> unverifiable. */
export function minConfidence(...confidences: Confidence[]): Confidence {
    if (confidences.length === 0) return "unverifiable";
    return confidences.reduce((lowest, c) =>
        CONFIDENCE_RANK[c] < CONFIDENCE_RANK[lowest] ? c : lowest,
    );
}

/** Steps a confidence down by one level (used by reconcile on conflict). */
export function demoteConfidence(c: Confidence): Confidence {
    if (c === "verified") return "auto";
    if (c === "auto") return "unverifiable";
    return "unverifiable";
}

/** User-facing coverage tier derived from overall confidence (spec §8). */
export type CoverageTier = "Verified" | "Auto" | "Unverifiable";

export function coverageTier(c: Confidence): CoverageTier {
    if (c === "verified") return "Verified";
    if (c === "auto") return "Auto";
    return "Unverifiable";
}
