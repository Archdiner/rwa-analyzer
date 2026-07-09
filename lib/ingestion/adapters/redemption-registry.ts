// ---------------------------------------------------------------------------
// Redemption-restriction incident registry (human-gated)
// ---------------------------------------------------------------------------
// Curated record of redemption gates / suspensions / repurchase caps for
// tokenized assets, keyed by canonical asset_id. This is the interpreted-history
// layer (the competitive moat: rwa.xyz has no gate/freeze/suspension history
// field). Each incident carries provenance (source + citation) and — CRITICALLY
// — a `regime`, so a non-traded-REIT contractual repurchase cap is NEVER
// surfaced as a '40-Act regulatory suspension, or vice versa (KTD7).
//
// EMPTY BY DEFAULT, on purpose (same discipline as reserves-registry.ts /
// attestation-registry.ts): no incident ships until it is human-verified with a
// citation. Note from research: BREIT/SREIT are non-traded REITs with no
// on-chain token, so they are NOT asset_id-keyable here; and no confirmed
// regulated tokenized-fund freeze exists to seed. The registry therefore ships
// empty, and the dimension reports "none on record" (freshness-scoped) — an
// honest absence claim, never "provably never restricted".
//
// Registered money-market fund liquidity-FEE history is NOT curated here — it is
// parsed from N-MFP filings by the EDGAR adapter (the modern MMF signal;
// regulatory gates are structurally dead post-Oct-2023).
// ---------------------------------------------------------------------------

import type { RedemptionIncident } from "@/lib/contracts";

/** One human-verified incident plus the provenance that gated it in. */
export interface RedemptionIncidentEntry extends RedemptionIncident {
    /** ISO date this entry was verified. */
    verified_at: string;
    /** How the incident was confirmed (filing URL / press release / order). */
    verified_against: string;
}

/**
 * Keyed by canonical asset_id ("{chainId}:{address}", lowercased) → incidents.
 * Empty by default. Example shape (commented — do not ship unverified):
 *
 *   "1:0x...": [{
 *     as_of: "2025-11-04T00:00:00Z",
 *     kind: "suspension",
 *     regime: "onchain_contract",
 *     resolved_at: "2026-01-10T00:00:00Z",
 *     source: "issuer post-mortem",
 *     citation: { url: "https://...", text_span: "redemptions were suspended" },
 *     note: "synthetic-dollar wrapper; redemptions halted during the Nov-2025 contagion",
 *     verified_at: "2026-07-09",
 *     verified_against: "https://... (issuer post-mortem confirming the halt + resolution)",
 *   }],
 */
export const REDEMPTION_INCIDENTS: Record<string, RedemptionIncidentEntry[]> = {};

/** Returns verified incidents for an asset (empty array if none on record). */
export function lookupRedemptionIncidents(assetId: string): RedemptionIncidentEntry[] {
    return REDEMPTION_INCIDENTS[assetId.toLowerCase()] ?? [];
}
