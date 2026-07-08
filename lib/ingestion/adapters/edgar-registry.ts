// ---------------------------------------------------------------------------
// SEC EDGAR fund registry
// ---------------------------------------------------------------------------
// Maps an on-chain asset to the registered fund that files its holdings with
// the SEC. This is the STRONGEST independence axis available (regulator-grade,
// machine-readable), but its scope is NARROW and worth stating loudly:
//
//   EDGAR only exists for funds registered under the 1940 Act. It is USELESS for
//   OUSG (a 3(c)(7) private fund), USDY (a non-US note), BUIDL and USYC (private
//   funds). It essentially exists for the BENJI class - a registered '40-Act
//   money-market fund. It buys one flagship, not the set. That narrowness is the
//   point: verified green is genuinely rare, and this maps exactly where it's
//   real.
//
// INTEGRITY: the (cik, seriesId) pair must be verified against EDGAR before use,
// and the adapter re-checks that the fetched filing's seriesId matches this
// entry - attributing another fund's filing would manufacture a false green.
// ---------------------------------------------------------------------------

export interface EdgarFundEntry {
    /** SEC Central Index Key of the registrant (zero-padding handled downstream). */
    cik: number;
    /** The specific fund SERIES the on-chain token represents. */
    seriesId: string;
    /** Human label for provenance. */
    fundName: string;
}

/**
 * Keyed by canonical asset_id ("{chainId}:{address}", lowercased). Only the
 * BENJI class qualifies today (see the scope note above).
 *
 * BENJI = Franklin OnChain U.S. Government Money Fund (FOBXX), series
 * S000067043 of the Franklin Templeton Trust (CIK 1786958). Verified against
 * EDGAR company_tickers_mf.json + submissions on 2026-07-07.
 */
export const EDGAR_FUNDS: Record<string, EdgarFundEntry> = {
    "1:0x3ddc84940ab509c11b20b76b466933f40b750dc9": {
        cik: 1786958,
        seriesId: "S000067043",
        fundName: "Franklin OnChain U.S. Government Money Fund",
    },
};

export function lookupEdgarFund(assetId: string): EdgarFundEntry | undefined {
    return EDGAR_FUNDS[assetId.toLowerCase()];
}
