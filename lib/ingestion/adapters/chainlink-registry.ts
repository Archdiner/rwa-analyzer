// ---------------------------------------------------------------------------
// Chainlink Proof-of-Reserve / SmartData feed registry
// ---------------------------------------------------------------------------
// The product's edge lives here: we record HOW reserves are proven, not just a
// number. Chainlink's own docs warn that much PoR data is self-reported via an
// issuer-hosted API and is NOT independently verified.
//
// INTEGRITY RULE: never add a feed address you have not verified on Chainlink's
// official feed page (https://data.chain.link). A wrong address that produces a
// confident "fully backed" verdict is the worst-case failure for this product.
// An unclassified asset MUST resolve to no feed (reserves_method: none) rather
// than a guess. `reserves_method: "unknown"` is reserved for a feed we read but
// have not classified as attested vs self-reported.
// ---------------------------------------------------------------------------

import type { ReservesMethod } from "@/lib/contracts";

export interface PorFeedEntry {
    /** Chain the FEED lives on (often Ethereum mainnet, even for L2 assets). */
    feedChainId: number;
    /** Verified AggregatorV3Interface (proxy) address. */
    feedAddress: `0x${string}`;
    /** What the feed measures. */
    kind: "reserves" | "nav";
    /** Verified classification of how the reserve is proven. */
    reservesMethod: Exclude<ReservesMethod, "none">;
    /** Free-text note on the source of the classification (for auditability). */
    note: string;
}

/**
 * Keyed by canonical asset_id ("{chainId}:{address}", lowercased).
 *
 * Intentionally starts EMPTY. Entries are added only after verifying the feed
 * address and its attestation model on data.chain.link. Until an asset is
 * listed here, the Chainlink adapter contributes nothing and backing falls to
 * `reserves_method: none` (red) — the honest default.
 *
 * FLAGSHIP FEED VERIFICATION (checked Chainlink reference-data-directory
 * 2026-07-07 — the machine-readable source behind data.chain.link; Ethereum
 * mainnet has 315 feeds incl. many PoR/reserves feeds, so absence is real):
 *   - OUSG  (1:0x1b19c19393e2d034d8ff31ff34c81252fcbbee92): ON-CHAIN ONLY.
 *       VERIFIED no Chainlink RESERVES/PoR feed (ETH mainnet + Avalanche
 *       checked). Ondo's only Chainlink feeds are PRICE feeds for its tokenized
 *       equities/ETFs (SPYon, QQQon, TSLAon, "Ondo API"/"Ondo Tokenized ETF") —
 *       price != reserves, so G2 fails. Backing stays unknown. Revisit if Ondo
 *       ships a real PoR feed (the Feb-2026 integration announcement had not
 *       produced one as of this check).
 *   - USDY  (1:0x96f6ef951840721adbf46ac996b59e0235cb985c): ON-CHAIN ONLY.
 *       Same finding — no Chainlink reserves/PoR feed. G2 fails.
 *   - USYC  (1:0x136471a34f6ef19fe571effc1ca711fdb8e49f2b): NOT CHECKED THIS RUN.
 *       Prior research: daily NAV oracle on the Chainlink interface but likely
 *       ISSUER-OPERATED -> would be self_reported (amber), and no reserves feed
 *       confirmed. Verify before any entry.
 *   - BUIDL (1:0x7712c34205737192402172409a8f7ccef8aa2aec): ON-CHAIN ONLY.
 *       NAV fixed at $1.00 at the contract level (rebase); oracle partner is
 *       RedStone, NOT Chainlink. Nothing to add here. Backing stays unknown.
 *   - BENJI (1:0x3ddc84940ab509c11b20b76b466933f40b750dc9): ON-CHAIN ONLY.
 *       Reserve attestations are annual (1940 Act board oversight); no PoR feed.
 */
export const POR_FEEDS: Record<string, PorFeedEntry> = {
    // Example of the required shape (commented until verified):
    // "1:0x0000000000000000000000000000000000000000": {
    //     feedChainId: 1,
    //     feedAddress: "0x...",           // verified on data.chain.link
    //     kind: "reserves",
    //     reservesMethod: "auditor_attested",
    //     note: "Verified <date> against data.chain.link PoR feed page",
    // },
};

export function lookupPorFeed(assetId: string): PorFeedEntry | undefined {
    return POR_FEEDS[assetId.toLowerCase()];
}
