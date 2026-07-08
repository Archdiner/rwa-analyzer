// ---------------------------------------------------------------------------
// Auditor-attestation registry (Lane C)
// ---------------------------------------------------------------------------
// Maps an on-chain asset to its off-chain auditor/administrator attestation.
// This is the coverage lane for assets with NO SEC primary filing (OUSG, most
// private credit): their real proof is a CPA/administrator attestation PDF.
//
// It is a DELIBERATELY LESSER lane than EDGAR:
//   - independence 4 (auditor), not 5 (regulator) - see NOMINAL_INDEPENDENCE.
//   - extraction is `llm_extracted` -> confidence is `auto`, never `verified`.
// So the best an attestation can ever confer is `verified_backed` + `auto`: a
// real cell, visibly weaker than a regulator filing's `verified_backed` +
// `verified`. And a green STILL requires the supply x NAV arithmetic to
// reconcile - the attestation is not trusted blindly, its number must agree
// with the on-chain float.
//
// INTEGRITY: an entry here can mint a green, so the same rule as edgar-registry
// applies - `doc_url` must be verified against the issuer's official
// transparency page before it ships, and `verified_at` records when. The map is
// EMPTY by default on purpose: an unverified URL could fetch the wrong document
// and manufacture a false green, the exact failure this project refuses. Add a
// row only after a human confirms the URL is the asset's current attestation.
// ---------------------------------------------------------------------------

const DAY_MS = 24 * 60 * 60 * 1000;

export interface AttestationEntry {
    /** Direct URL to the attestation document (PDF or HTML). Human-verified. */
    doc_url: string;
    /** The attesting firm / administrator (Ankura, The Network Firm, etc.). */
    administrator_name: string;
    /** How often the attestation is published (drives freshness). */
    cadence_ms: number;
    /** ISO date the doc_url was confirmed against the issuer's official page. */
    verified_at: string;
    /** What it was verified against (issuer transparency URL). */
    verified_against: string;
}

/**
 * Keyed by canonical asset_id ("{chainId}:{address}", lowercased). EMPTY by
 * default - see the integrity note above. To enable an asset, verify its
 * current attestation URL and add a row, e.g.:
 *
 *   "1:0x1b19c19393e2d034d8ff31ff34c81252fcbbee92": {   // OUSG
 *       doc_url: "https://<verified Ankura attestation PDF>",
 *       administrator_name: "Ankura Trust",
 *       cadence_ms: 35 * DAY_MS,
 *       verified_at: "2026-07-08",
 *       verified_against: "https://ondo.finance/ousg (transparency)",
 *   },
 */
export const ATTESTATIONS: Record<string, AttestationEntry> = {
    // OUSG - Ondo Short-Term US Government Bond Fund LP (Cayman), Ankura Trust
    // administrator, daily attestations. The official transparency surface is a
    // JS-rendered dashboard with no citable reserve figures in its HTML and no
    // public reserves document/API, so extraction finds nothing to cite and the
    // verdict stays an HONEST `unknown` - the tool refuses to fake a green off a
    // source it cannot read. Wired so it starts working the moment Ondo ships a
    // machine-readable attestation (PDF/JSON). Verified 2026-07-08.
    "1:0x1b19c19393e2d034d8ff31ff34c81252fcbbee92": {
        doc_url: "https://app.ondo.finance/assets/ousg",
        administrator_name: "Ankura Trust",
        cadence_ms: 2 * DAY_MS, // daily attestation
        verified_at: "2026-07-08",
        verified_against: "https://docs.ondo.finance/qualified-access-products/ousg",
    },
};

// Referenced by the example above; keeps the constant from being unused so the
// cadence unit is documented in one place.
export const DEFAULT_ATTESTATION_CADENCE_MS = 35 * DAY_MS;

export function lookupAttestation(assetId: string): AttestationEntry | undefined {
    return ATTESTATIONS[assetId.toLowerCase()];
}
