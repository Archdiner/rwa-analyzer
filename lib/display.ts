// ---------------------------------------------------------------------------
// Display helpers - labels + styling maps shared by UI components
// ---------------------------------------------------------------------------

import type {
    Confidence,
    Flag,
    FieldName,
    EvidenceSourceType,
    EvidenceExtraction,
    RedemptionSpeed,
} from "@/lib/contracts";

const CHAIN_NAMES: Record<number, string> = { 1: "Ethereum", 8453: "Base", 43114: "Avalanche" };

export function chainDisplay(chainId: number): string {
    return CHAIN_NAMES[chainId] ?? `Chain ${chainId}`;
}

export const DIMENSION_TITLES: Record<string, string> = {
    access: "Access & Eligibility",
    backing: "Backing & Verification",
    redemption: "Redemption & Liquidity",
    structure: "Issuer & Structure",
    yield_source: "Yield Source",
    market_risk: "Market Risk",
    governance: "Governance & Control",
    redemption_history: "Redemption Restriction History",
};

export const FIELD_LABELS: Partial<Record<FieldName, string>> = {
    supply: "On-chain supply",
    nav: "Net asset value",
    auditor: "Auditor",
    custodian: "Custodian",
    issuer_domicile: "Issuer domicile",
    wrapper_type: "Legal wrapper",
    redemption_speed: "Redemption speed",
    redemption_cap: "Redemption cap",
    jurisdiction: "Jurisdiction",
    min_investment_usd: "Minimum investment",
    kyc_required: "KYC required",
    yield_apy: "Yield (APY)",
    yield_source: "Yield source",
    aum: "AUM",
    holders: "Holders",
};

/** Flag word (neutral; access-red is relabeled at the component). */
export function flagLabel(flag: Flag): string {
    switch (flag) {
        case "green":
            return "Clear";
        case "amber":
            return "Caution";
        case "red":
            return "Concern";
        default:
            return "Unknown";
    }
}

export function confidenceLabel(c: Confidence): string {
    if (c === "verified") return "Verified";
    if (c === "auto") return "Auto-extracted";
    return "Unverifiable";
}

/** How fast a user can get their money back out. */
export const REDEMPTION_LABELS: Record<RedemptionSpeed, string> = {
    instant: "Instant exit",
    instant_capped: "Instant (capped)",
    daily: "Daily exit",
    t_plus_n: "Exit in days",
    none: "No redemption",
    unknown: "Exit speed unknown",
};

/**
 * The kind of yield number, shown next to it - because the source of a number is
 * part of the number. A live pool APY reads differently than a stated fund rate.
 */
export function yieldKindLabel(kind: "pool_apy" | "stated_rate" | null): string {
    if (kind === "pool_apy") return "live pool APY";
    if (kind === "stated_rate") return "stated rate";
    return "yield";
}

/** ISO timestamp -> a compact "as of" date (YYYY-MM-DD), or null. */
export function asOfShort(iso: string | null): string | null {
    if (!iso) return null;
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

/** Plain, one-line safety read for the decision surface (safety leads). */
export function safetyHeadline(flag: Flag): string {
    switch (flag) {
        case "green":
            return "Backing independently verified";
        case "amber":
            return "Backing partly verified; read the caveat";
        case "red":
            return "Backing does not reconcile";
        default:
            return "Backing not verifiable yet";
    }
}

// ── Backing evidence labels (v1.1) ──────────────────────────────────────────

export const EVIDENCE_SOURCE_LABELS: Record<EvidenceSourceType, string> = {
    regulator_filing: "Regulator filing",
    onchain_holdings: "On-chain holdings",
    auditor_attestation: "Auditor attestation",
    admin_report: "Administrator report",
    custodian_feed: "Custodian feed",
    oracle_por: "Oracle PoR feed",
    issuer_selfreport: "Issuer self-report",
};

export const EVIDENCE_EXTRACTION_LABELS: Record<EvidenceExtraction, string> = {
    onchain_read: "on-chain read",
    structured: "structured data",
    llm_extracted: "parsed",
};

/** Independence 0–5 -> short word. Green-eligible at >= 3. */
export function independenceLabel(n: number): string {
    if (n >= 5) return "regulator / on-chain proof";
    if (n >= 4) return "independent (auditor)";
    if (n >= 3) return "independent";
    if (n >= 2) return "unclassified";
    if (n >= 1) return "self-reported";
    return "unproven";
}

/** Where verification stops for each evidence type. Shown on every verdict card. */
export const EVIDENCE_TRUST_BOUNDARY: Record<EvidenceSourceType, string> = {
    regulator_filing:
        "Confirms a redeemable share of a regulator-verified fund. Does not reconcile on-chain float against the fund share register; that linkage is the transfer agent's record.",
    onchain_holdings:
        "Shows what the reserve wallet holds on-chain. Does not prove backing of nested instruments; independence is limited to what those holdings themselves verify.",
    auditor_attestation:
        "Verification stops at the attesting firm: you trust that the auditor did the reconciliation, not a regulator. As of a stated date, not continuous proof.",
    admin_report:
        "Based on the fund administrator's report. Independent of the issuer, but not a regulator filing or audit.",
    custodian_feed: "Based on the custodian's published balance.",
    oracle_por: "Based on the proof-of-reserve feed methodology and its attestation chain.",
    issuer_selfreport: "Issuer-reported with no independent verification.",
};
