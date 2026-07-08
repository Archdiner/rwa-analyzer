// ---------------------------------------------------------------------------
// Governance admin-label registry (optional, enrichment-only)
// ---------------------------------------------------------------------------
// Maps a known admin/controller address to a human label (e.g. a named
// governance timelock or a protocol multisig). PURELY cosmetic: it enriches
// `admin_label` for provenance and never changes a flag. The governance
// dimension is registry-OPTIONAL by design (KTD6) — it reads the asset's own
// contract and classifies control structurally, so an absent label costs only a
// name, never correctness.
//
// Keyed by "{chainId}:{address}" (lowercased). Empty by default; add entries
// only when the mapping is human-verified.
// ---------------------------------------------------------------------------

export const ADMIN_LABELS: Record<string, string> = {
    // "1:0x...": "Aave Governance Short Timelock",
};

export function lookupAdminLabel(chainId: number, address: string): string | undefined {
    return ADMIN_LABELS[`${chainId}:${address.toLowerCase()}`];
}
