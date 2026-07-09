// ---------------------------------------------------------------------------
// On-chain reconstruction - pure logic (no network, fully testable)
// ---------------------------------------------------------------------------
// Two jobs, both kept out of the network adapter so they can be unit-tested:
//
//   1. leafBackingIndependence - the ANTI-LAUNDERING ceiling. Reading a balance
//      on-chain is independence-5 in EXTRACTION (no parse risk), but the BACKING
//      independence of that evidence can be no higher than the independence of
//      what is held. Holding an amber token (BUIDL: unknown backing) is amber,
//      not green. Recursive and cycle-safe: a reference cycle proves nothing.
//
//   2. buildHoldingsEvidence - turn valued holdings into one EvidenceItem, with
//      coverage measured against supply x NAV so a partial reconstruction reads
//      as "X% verified on-chain", not a false full green.
// ---------------------------------------------------------------------------

import type { EvidenceItem } from "@/lib/contracts";
import type {
    HeldInstrument,
    ReserveWalletEntry,
} from "@/lib/ingestion/adapters/reserves-registry";

type WalletMap = Record<string, ReserveWalletEntry>;

/**
 * The backing independence (0–5) a held instrument confers as a reserve leaf.
 *   cash_treasury_proven - the reserve IS cash/Treasuries with proof: 5.
 *   proven leaf           - an asset already green in our system: 5.
 *   another RWA token     - recurse into ITS reserves (ceiling = what it holds).
 *   an RWA with no wallet  - we can't independently prove it: 1 (issuer trust).
 *   stablecoin (untracked) - a claim on an issuer, not independently proven: 2.
 */
export function leafBackingIndependence(
    assetId: string,
    provenLeaves: Set<string>,
    wallets: WalletMap,
    visited: Set<string> = new Set(),
): number {
    const id = assetId.toLowerCase();
    if (visited.has(id)) return 0; // cycle - proves nothing
    if (provenLeaves.has(id)) return 5;

    const entry = wallets[id];
    if (!entry) return 1; // an RWA token we cannot independently reconstruct

    const next = new Set(visited);
    next.add(id);
    return instrumentsIndependence(entry.instruments, provenLeaves, wallets, next);
}

function instrumentIndependence(
    inst: HeldInstrument,
    provenLeaves: Set<string>,
    wallets: WalletMap,
    visited: Set<string>,
): number {
    switch (inst.kind) {
        case "cash_treasury_proven":
            return 5;
        case "stablecoin":
            return inst.assetId
                ? leafBackingIndependence(inst.assetId, provenLeaves, wallets, visited)
                : 2;
        case "rwa_token":
            return inst.assetId
                ? leafBackingIndependence(inst.assetId, provenLeaves, wallets, visited)
                : 1;
    }
}

/** A reconstruction is only as independent as its weakest material holding. */
export function instrumentsIndependence(
    instruments: HeldInstrument[],
    provenLeaves: Set<string>,
    wallets: WalletMap,
    visited: Set<string> = new Set(),
): number {
    if (instruments.length === 0) return 0;
    return Math.min(...instruments.map((i) => instrumentIndependence(i, provenLeaves, wallets, visited)));
}

export interface ValuedHolding {
    label: string;
    balanceUsd: number;
    /** Backing independence this instrument confers (from leaf resolution). */
    independence: number;
}

/**
 * Builds a single onchain_holdings evidence item from valued holdings.
 * `expectedUsd` is supply × NAV - the AUM the reserve must cover. Coverage below
 * 100% is the honest "X% verified on-chain, remainder unverified" signal.
 * Returns null when nothing is readable (adapter then contributes nothing).
 */
export function buildHoldingsEvidence(
    holdings: ValuedHolding[],
    expectedUsd: number,
    asOf: string,
): EvidenceItem | null {
    const material = holdings.filter((h) => h.balanceUsd > 0);
    if (material.length === 0) return null;

    const reserves = material.reduce((s, h) => s + h.balanceUsd, 0);
    // Weakest-link ceiling: the reconstruction inherits the least-independent
    // instrument's backing independence.
    const independence = Math.min(...material.map((h) => h.independence));
    const coverage = expectedUsd > 0 ? Math.min(100, (reserves / expectedUsd) * 100) : 0;

    const composition = material
        .map((h) => `${h.label} (indep ${h.independence})`)
        .join(", ");
    const note =
        independence < 3
            ? `Composition verified on-chain (${composition}); underlying not independently proven, so backing cannot exceed amber.`
            : `Reserves verified on-chain (${composition}).`;

    return {
        source_type: "onchain_holdings",
        independence,
        reserves_value: reserves,
        coverage_pct: coverage,
        as_of: asOf,
        extraction: "onchain_read",
        confidence: "verified",
        parse_confidence: null,
        citation: null,
        source: "onchain_reserves",
        note,
    };
}
