// ---------------------------------------------------------------------------
// Decision engine — the thing a list structurally cannot do
// ---------------------------------------------------------------------------
// Given WHERE a user is and roughly HOW MUCH they have, filters the universe to
// what they can ACTUALLY reach, then ranks it SAFETY-FIRST (the safety read
// leads; yield is what you weigh against it). A list shows options; this answers
// a decision. Pure and network-free so the reachability + ranking rules are
// unit-tested, not trusted.
// ---------------------------------------------------------------------------

import type { Confidence, Flag, Jurisdiction, RedemptionSpeed } from "@/lib/contracts";

// ── User profile ─────────────────────────────────────────────────────────────

export type UserJurisdiction =
    | "us_retail"
    | "us_accredited"
    | "us_qualified_purchaser"
    | "non_us"
    | "eu";

export const USER_JURISDICTIONS: { id: UserJurisdiction; label: string }[] = [
    { id: "us_retail", label: "US — retail" },
    { id: "us_accredited", label: "US — accredited investor" },
    { id: "us_qualified_purchaser", label: "US — qualified purchaser ($5M+)" },
    { id: "non_us", label: "Outside the US" },
    { id: "eu", label: "European Union" },
];

export type AmountBand = "under_1k" | "1k_10k" | "10k_100k" | "100k_1m" | "over_1m";

export const AMOUNT_BANDS: { id: AmountBand; label: string; ceiling: number }[] = [
    { id: "under_1k", label: "Under $1,000", ceiling: 1_000 },
    { id: "1k_10k", label: "$1,000 – $10,000", ceiling: 10_000 },
    { id: "10k_100k", label: "$10,000 – $100,000", ceiling: 100_000 },
    { id: "100k_1m", label: "$100,000 – $1M", ceiling: 1_000_000 },
    { id: "over_1m", label: "Over $1M", ceiling: Number.POSITIVE_INFINITY },
];

export interface UserProfile {
    jurisdiction: UserJurisdiction;
    amount: AmountBand;
}

/** Upper bound of the amount band — the most the user might commit. */
export function amountCeiling(band: AmountBand): number {
    return AMOUNT_BANDS.find((b) => b.id === band)?.ceiling ?? 0;
}

// ── The per-asset shape the decision engine ranks (Contract-like summary) ─────

export interface AssetSummary {
    asset_id: string;
    symbol: string;
    name: string;
    issuer_name?: string | null;
    chain_id: number;
    provider_url?: string | null;
    jurisdiction: Jurisdiction | null;
    min_investment_usd: number | null;
    yield_apy: number | null;
    /** Kind of yield number: a live DeFi pool APY vs a fund's stated rate. */
    yield_kind: "pool_apy" | "stated_rate" | null;
    /** When the yield figure was observed (ISO), for the "as of" stamp. */
    yield_as_of: string | null;
    redemption_speed: RedemptionSpeed | null;
    backing_flag: Flag;
    backing_reason: string;
    backing_confidence: Confidence;
    /** Where trust bottoms out for the strongest backing evidence (may be null). */
    trust_boundary: string | null;
}

// ── Access matrix ─────────────────────────────────────────────────────────────

/** Which asset jurisdictions each user location can legally reach. */
const ACCESS: Record<UserJurisdiction, Jurisdiction[]> = {
    us_retail: ["permissionless", "us_retail"],
    us_accredited: ["permissionless", "us_retail", "us_accredited"],
    us_qualified_purchaser: [
        "permissionless",
        "us_retail",
        "us_accredited",
        "us_qualified_purchaser",
    ],
    non_us: ["permissionless", "non_us_only"],
    eu: ["permissionless", "non_us_only", "eu_only"],
};

const JURISDICTION_LABEL: Record<Jurisdiction, string> = {
    permissionless: "anyone",
    us_retail: "US retail investors",
    us_accredited: "US accredited investors",
    us_qualified_purchaser: "US qualified purchasers ($5M+)",
    non_us_only: "non-US persons",
    eu_only: "EU investors",
    unknown: "unspecified investors",
};

// ── Ranking ───────────────────────────────────────────────────────────────────
// Safety leads. Green before amber before unknown before red; higher yield only
// breaks ties within the same safety tier.
const SAFETY_RANK: Record<Flag, number> = { green: 0, amber: 1, unknown: 2, red: 3 };

// ── Outputs ───────────────────────────────────────────────────────────────────

export interface ReachableAsset {
    asset: AssetSummary;
    /** Honest caveats that don't block access (e.g. minimum unconfirmed). */
    caveats: string[];
}

export interface ClosedAsset {
    asset: AssetSummary;
    /** The single, plain reason it's out of reach. */
    reason: string;
}

export interface DecisionResult {
    reachable: ReachableAsset[];
    closed: ClosedAsset[];
}

function usd(n: number): string {
    if (n >= 1_000_000) return `$${(n / 1_000_000).toLocaleString(undefined, { maximumFractionDigits: 1 })}M`;
    if (n >= 1_000) return `$${(n / 1_000).toLocaleString(undefined, { maximumFractionDigits: 0 })}K`;
    return `$${n.toLocaleString()}`;
}

/** Evaluates one asset against a profile: reachable (+caveats) or closed (+reason). */
export function evaluate(asset: AssetSummary, profile: UserProfile): ReachableAsset | ClosedAsset {
    const juris = asset.jurisdiction ?? "unknown";
    const caveats: string[] = [];

    // Jurisdiction gate. `unknown` never blocks (we don't invent a restriction),
    // but it is surfaced as a caveat.
    if (juris !== "unknown") {
        const allowed = ACCESS[profile.jurisdiction].includes(juris);
        if (!allowed) {
            return { asset, reason: `Restricted to ${JURISDICTION_LABEL[juris]}.` };
        }
    } else {
        caveats.push("Eligibility rules are unconfirmed — verify before depositing.");
    }

    // Minimum gate.
    const ceiling = amountCeiling(profile.amount);
    if (asset.min_investment_usd != null) {
        if (ceiling < asset.min_investment_usd) {
            return { asset, reason: `Needs a ${usd(asset.min_investment_usd)} minimum.` };
        }
    } else {
        caveats.push("Minimum investment not confirmed.");
    }

    return { asset, caveats };
}

function isClosed(x: ReachableAsset | ClosedAsset): x is ClosedAsset {
    return "reason" in x;
}

/** Compare for safety-first ranking: safest tier first, higher yield within tier. */
function bySafetyThenYield(a: AssetSummary, b: AssetSummary): number {
    const s = SAFETY_RANK[a.backing_flag] - SAFETY_RANK[b.backing_flag];
    if (s !== 0) return s;
    return (b.yield_apy ?? -1) - (a.yield_apy ?? -1);
}

/** Filters the universe to what the user can reach and ranks it safety-first. */
export function decide(universe: AssetSummary[], profile: UserProfile): DecisionResult {
    const reachable: ReachableAsset[] = [];
    const closed: ClosedAsset[] = [];

    for (const asset of universe) {
        const r = evaluate(asset, profile);
        if (isClosed(r)) closed.push(r);
        else reachable.push(r);
    }

    reachable.sort((x, y) => bySafetyThenYield(x.asset, y.asset));
    // Closed: show the ones you're closest to (highest yield) first — aspirational.
    closed.sort((x, y) => (y.asset.yield_apy ?? -1) - (x.asset.yield_apy ?? -1));

    return { reachable, closed };
}
