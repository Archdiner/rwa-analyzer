// ---------------------------------------------------------------------------
// Display helpers — labels + styling maps shared by UI components
// ---------------------------------------------------------------------------

import type { Confidence, Flag, FieldName, EvidenceSourceType, EvidenceExtraction } from "@/lib/contracts";

const CHAIN_NAMES: Record<number, string> = { 1: "Ethereum", 8453: "Base", 43114: "Avalanche" };

export function chainDisplay(chainId: number): string {
    return CHAIN_NAMES[chainId] ?? `Chain ${chainId}`;
}

export const DIMENSION_TITLES: Record<string, string> = {
    access: "Access & Eligibility",
    backing: "Backing & Verification",
    redemption: "Redemption & Liquidity",
    structure: "Issuer & Structure",
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

/**
 * Where trust bottoms out for each evidence type — the exact point at which
 * on-chain verification stops and institutional trust begins. Every verdict has
 * one; naming it on the card (not just the README) is the product's integrity in
 * one line. No source is a chain of proof all the way down, and pretending
 * otherwise is the failure this tool exists to refuse.
 */
export const EVIDENCE_TRUST_BOUNDARY: Record<EvidenceSourceType, string> = {
    regulator_filing:
        "Proves this is a redeemable share of a regulator-verified fund — not a reconciliation of the on-chain float against the fund's share register. That linkage is the transfer agent's record.",
    onchain_holdings:
        "Proves what the reserve wallet holds on-chain. It does not prove the backing of the instruments held — this read is only as independent as they are.",
    auditor_attestation:
        "Rests on an independent auditor's attestation as of a date, not a live or continuous proof.",
    admin_report:
        "Rests on the fund administrator's report — independent of the issuer, but not a regulator filing or an audit.",
    custodian_feed: "Rests on the custodian's published balance — trust bottoms out at the custodian's record.",
    oracle_por: "Rests on the proof-of-reserve feed's methodology — trust bottoms out at whoever attests the feed.",
    issuer_selfreport:
        "Self-reported by the issuer — trust bottoms out at the issuer's own word, with no independent verification.",
};
