// ---------------------------------------------------------------------------
// Display helpers — labels + styling maps shared by UI components
// ---------------------------------------------------------------------------

import type { Confidence, Flag, FieldName } from "@/lib/contracts";

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
