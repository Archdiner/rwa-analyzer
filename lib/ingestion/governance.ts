// ---------------------------------------------------------------------------
// Governance / admin-key shaping (pure, network-free)
// ---------------------------------------------------------------------------
// The classification core of the governance adapter, split from the network
// shell the way parseNmfp/shapeAaveReserve are. Everything here is deterministic
// and fixture-tested, because this is where a misclassification could flip a
// flag — and the cardinal risk is a FALSE GREEN (calling an upgradeable contract
// "immutable").
//
// Honesty rule learned from real reads: absence of recognized proxy markers is
// NOT proof of immutability. BUIDL (a bespoke Securitize proxy) has neither
// EIP-1967 slots nor standard proxy selectors, yet it IS upgradeable. So this
// module NEVER emits `is_upgradeable: false` from mere absence — it emits
// `null` (unknown). A green rests only on POSITIVELY-detected safe control
// (a recognized proxy behind a timelock / healthy multisig), never on "we
// found no upgrade path."
// ---------------------------------------------------------------------------

import type {
    AdminType,
    Confidence,
    DimensionRead,
    Flag,
    GovernanceData,
    Method,
    ProxyPattern,
} from "@/lib/contracts";

// EIP-1967 storage slots (keccak256("eip1967.proxy.*") - 1).
export const EIP1967_IMPL_SLOT = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";
export const EIP1967_ADMIN_SLOT = "0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103";
export const EIP1967_BEACON_SLOT = "0xa3f0ad74e5423aebfd80d3ef4346578335a9a72aeaee59ff6cb3582b35133d50";

/** A 32-byte storage word to a checksummable lower-hex address, or null if zero/empty. */
export function slotToAddress(word: string | null | undefined): string | null {
    if (!word) return null;
    const hex = word.toLowerCase().replace(/^0x/, "");
    if (hex.length < 40) return null;
    const addr = "0x" + hex.slice(-40);
    if (/^0x0{40}$/.test(addr)) return null;
    return addr;
}

/** The reads the shell gathers for one contract (JSON-serializable → fixture shape). */
export interface RawGovernanceReads {
    /** EIP-1967 implementation slot as a resolved address, or null. */
    impl: string | null;
    /** EIP-1967 admin slot as a resolved address, or null. */
    adminSlot: string | null;
    /** EIP-1967 beacon slot as a resolved address, or null. */
    beacon: string | null;
    /** Whether the bytecode advertises standard proxy/upgrade selectors. */
    hasProxySelectors: boolean;
    /** `owner()` result (UUPS/Ownable upgrade authority), or null. */
    owner: string | null;
    /** Whether the resolved admin address has code (contract vs EOA). null = unknown. */
    adminIsContract: boolean | null;
    /** Gnosis Safe threshold / owner count for the admin, if it is a Safe. */
    safeThreshold: number | null;
    safeOwnerCount: number | null;
    /** TimelockController minimum delay (seconds) for the admin, if it is a timelock. */
    timelockDelaySeconds: number | null;
    /** Whether a pause/guardian power exists on the contract. null = unknown. */
    pausePower: boolean | null;
    asOf: string;
}

/**
 * Classifies the proxy pattern + upgradeability. Emits `is_upgradeable: null`
 * (unknown) when no recognized marker is found — NEVER `false` — so a bespoke
 * proxy is never mistaken for immutable.
 */
export function classifyProxy(r: RawGovernanceReads): { pattern: ProxyPattern; isUpgradeable: boolean | null } {
    if (r.beacon) return { pattern: "beacon", isUpgradeable: true };
    if (r.impl) return { pattern: r.adminSlot ? "transparent" : "uups", isUpgradeable: true };
    if (r.hasProxySelectors) return { pattern: "unknown", isUpgradeable: true }; // non-EIP-1967 proxy (e.g. USDC)
    // No recognized marker: cannot confirm upgradeable OR immutable.
    return { pattern: "unknown", isUpgradeable: null };
}

/** Resolves the upgrade authority: the transparent admin slot, else `owner()`. */
export function resolveAdmin(r: RawGovernanceReads): string | null {
    return r.adminSlot ?? r.owner ?? null;
}

/** Classifies who controls the upgrade authority. */
export function classifyAdmin(r: RawGovernanceReads): {
    adminType: AdminType;
    adminAddress: string | null;
    threshold: number | null;
    ownerCount: number | null;
    delay: number | null;
} {
    const adminAddress = resolveAdmin(r);
    if (!adminAddress) return { adminType: "unknown", adminAddress: null, threshold: null, ownerCount: null, delay: null };
    if (r.adminIsContract === false) return { adminType: "eoa", adminAddress, threshold: null, ownerCount: null, delay: null };
    if (r.timelockDelaySeconds != null) return { adminType: "timelock", adminAddress, threshold: null, ownerCount: null, delay: r.timelockDelaySeconds };
    if (r.safeThreshold != null) return { adminType: "multisig", adminAddress, threshold: r.safeThreshold, ownerCount: r.safeOwnerCount, delay: null };
    if (r.adminIsContract === true) return { adminType: "contract_unknown", adminAddress, threshold: null, ownerCount: null, delay: null };
    return { adminType: "unknown", adminAddress, threshold: null, ownerCount: null, delay: null };
}

function read<T extends number | boolean | string>(value: T | null, source: string, as_of: string): DimensionRead<T> {
    return { value, source, method: "onchain_read" as Method, confidence: "verified" as Confidence, as_of };
}

/** Builds the governance Contract-A payload from raw reads. */
export function buildGovernanceData(r: RawGovernanceReads, opts: { adminLabel?: string; underlyingCeiling?: Flag } = {}): GovernanceData {
    const { pattern, isUpgradeable } = classifyProxy(r);
    const { adminType, adminAddress, threshold, ownerCount, delay } = classifyAdmin(r);
    const src = "onchain:governance";
    return {
        proxy_pattern: read<string>(pattern, src, r.asOf),
        is_upgradeable: read<boolean>(isUpgradeable, src, r.asOf),
        // Admin fields are only meaningful when upgradeable; when upgradeability
        // is unknown, leave admin_type unknown too (don't imply control we can't verify).
        admin_type: read<string>(isUpgradeable ? adminType : "unknown", src, r.asOf),
        admin_address: read<string>(isUpgradeable ? adminAddress : null, src, r.asOf),
        multisig_threshold: read<number>(threshold, src, r.asOf),
        multisig_owner_count: read<number>(ownerCount, src, r.asOf),
        timelock_delay_seconds: read<number>(delay, src, r.asOf),
        pause_power: read<boolean>(r.pausePower, src, r.asOf),
        ...(opts.adminLabel ? { admin_label: opts.adminLabel } : {}),
        ...(opts.underlyingCeiling ? { underlying_ceiling: opts.underlyingCeiling } : {}),
    };
}
