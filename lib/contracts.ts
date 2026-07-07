// ---------------------------------------------------------------------------
// FROZEN CONTRACTS
// ---------------------------------------------------------------------------
// These are the two stable shapes the whole system depends on:
//
//   Contract A — NormalizedAssetRecord   (Ingestion  -> Computation)
//   Contract B — Assessment              (Computation -> App)
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
 *   verified     — independently checkable (on-chain read, attested feed, ref API)
 *   auto         — machine-derived, plausible but unconfirmed (LLM, aggregator)
 *   unverifiable — required but missing, or a citation that failed validation
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
 * How reserves are proven. `unknown` (feed not classified) is intentionally
 * distinct from `self_reported` (known to be issuer-reported) and `none`
 * (no reserve feed at all).
 */
export type ReservesMethod = "auditor_attested" | "self_reported" | "unknown" | "none";

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

// ── Field registry ───────────────────────────────────────────────────────────

/** The complete set of field keys a record may carry. */
export type FieldName =
    | "supply"
    | "nav"
    | "reserves_value"
    | "reserves_method"
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

/** Partial map of fields — adapters return a subset; reconcile merges them. */
export type FieldMap = Partial<Record<FieldName, FieldObject>>;

// ── Contract A — Normalized Asset Record ─────────────────────────────────────

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
    conflicts: FieldConflict[];
    ingested_at: string;
    /** Marks whether the slow qualitative pass has run yet (two-phase ingest). */
    qualitative_pending?: boolean;
}

// ── Contract B — Assessment ──────────────────────────────────────────────────

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
