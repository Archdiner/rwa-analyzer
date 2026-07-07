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
