// ---------------------------------------------------------------------------
// On-chain reserve-wallet registry
// ---------------------------------------------------------------------------
// On-chain reconstruction reads an issuer's reserve wallet directly and values
// what it holds — no PDF, no feed, no one's cooperation. But it only works when
// the reserve wallet is PUBLISHED and ATTRIBUTABLE to the asset. This registry
// holds only wallets verified against a primary source (issuer docs / a labelled
// explorer). An unverified wallet is never asserted — asserting the wrong wallet
// would manufacture a false green, the worst-case failure.
//
// ANTI-LAUNDERING: reconstruction that holds another tokenized instrument can be
// no more independent than that instrument's own backing. A wallet holding an
// amber token is amber, not green (see leafBackingIndependence in holdings.ts).
//
// ───────────────────────────────────────────────────────────────────────────
// FLAGSHIP FINDING (verified on-chain 2026-07-07, Ethereum mainnet):
//   OUSG (1:0x1b19c19393e2d034d8ff31ff34c81252fcbbee92) is NOT reconstructable.
//   Ondo publishes no on-chain reserve wallet: every Ondo-published Ethereum
//   address (OUSG token, InstantManager, Coinbase Prime ousg.eth, IDRegistry,
//   recipients) holds ZERO BUIDL. OUSG's BUIDL sits in segregated accounts at
//   third-party custodians (Clear Street / Coinbase Custody) for the Ondo I LP
//   SPV — addresses Ondo does not attribute publicly. The reserve PROOF is
//   Ankura Trust's OFF-CHAIN daily attestation, not an on-chain balance. So
//   on-chain reconstruction resolves 0% of OUSG's backing to an attributable
//   wallet; its honest verdict is a WEAK amber resting on an admin attestation
//   (once parsed), and its real green path is attestation/EDGAR — NOT this
//   adapter. Do not add a top-BUIDL-holder address here on a hunch: none of them
//   are attributable to OUSG from published data.
// ───────────────────────────────────────────────────────────────────────────

export type HeldKind = "stablecoin" | "rwa_token" | "cash_treasury_proven";

export interface HeldInstrument {
    /** Display label (e.g. "BUIDL", "USDC"). */
    label: string;
    token: `0x${string}`;
    chainId: number;
    kind: HeldKind;
    /** Canonical asset_id of the held instrument, if it is an RWA we track.
     *  Enables the recursive backing-independence ceiling. */
    assetId?: string;
    /** USD value per whole token. Defaults to 1 (stablecoins / $1-NAV tokens). */
    usdPerToken?: number;
}

export interface ReserveWalletEntry {
    /** Chain the reserve wallets live on. */
    walletChainId: number;
    /** Verified, attributable reserve wallet address(es). */
    wallets: `0x${string}`[];
    instruments: HeldInstrument[];
    /** Provenance of the attribution (for auditability). */
    note: string;
}

/**
 * Keyed by canonical asset_id. Intentionally EMPTY for the flagship set — none
 * of them publish an attributable on-chain reserve wallet (see the OUSG finding
 * above; the same custody pattern holds for USDY, USYC, BENJI). Entries are
 * added only after verifying the wallet holds the reserves and is attributable
 * to the asset.
 */
export const RESERVE_WALLETS: Record<string, ReserveWalletEntry> = {};

/**
 * Assets whose OWN backing is independently proven, so holding them on-chain is
 * green-eligible as a leaf. Empty by default: a token is added here only once it
 * independently earns green in our own system (never on reputation).
 */
export const PROVEN_LEAVES: Set<string> = new Set<string>();

export function lookupReserveWallet(assetId: string): ReserveWalletEntry | undefined {
    return RESERVE_WALLETS[assetId.toLowerCase()];
}
