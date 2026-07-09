// ---------------------------------------------------------------------------
// SEC EDGAR adapter (free, structured, regulator-grade)
// ---------------------------------------------------------------------------
// For a registered '40-Act money-market fund, fetches the latest N-MFP monthly
// portfolio filing and emits (1) a nav field from the market-based shadow NAV
// and (2) one regulator_filing EvidenceItem. This is the ONLY green path for the
// registered-fund (BENJI) class - see edgar-registry.ts for the narrow scope.
//
// Two integrity guards:
//   - Only registered assets in EDGAR_FUNDS are queried (no guessing a CIK).
//   - The fetched filing's seriesId MUST match the registry entry, or nothing is
//     emitted - attributing another fund's filing would manufacture a green.
// ---------------------------------------------------------------------------

import { field, type AdapterResult, EMPTY } from "@/lib/ingestion/adapters/base";
import type { ParsedAssetId } from "@/lib/chains";
import { formatAssetId as buildAssetId } from "@/lib/chains";
import { secUserAgent } from "@/lib/env";
import { lookupEdgarFund } from "@/lib/ingestion/adapters/edgar-registry";
import { parseNmfp, navFromFiling, buildRegulatorEvidence, buildFeeEvents } from "@/lib/ingestion/edgar";
import { buildFeeContribution } from "@/lib/ingestion/redemption-history";

interface RecentFilings {
    form: string[];
    filingDate: string[];
    accessionNumber: string[];
}

async function fetchJson<T>(url: string): Promise<T | null> {
    const res = await fetch(url, { headers: { "User-Agent": secUserAgent(), accept: "application/json" } });
    if (!res.ok) throw new Error(`edgar ${res.status} ${url}`);
    return (await res.json()) as T;
}

/** Latest N-MFP accession number for a CIK, or null if none filed. */
async function latestNmfpAccession(cik: number): Promise<string | null> {
    const padded = String(cik).padStart(10, "0");
    const sub = await fetchJson<{ filings: { recent: RecentFilings } }>(
        `https://data.sec.gov/submissions/CIK${padded}.json`,
    );
    const r = sub?.filings?.recent;
    if (!r) return null;

    // Filings are newest-first; take the first N-MFP form.
    for (let i = 0; i < r.form.length; i++) {
        if (r.form[i]?.startsWith("N-MFP")) return r.accessionNumber[i];
    }
    return null;
}

export async function edgarAdapter(asset: ParsedAssetId): Promise<AdapterResult> {
    const assetId = buildAssetId(asset.chainId, asset.address);
    const entry = lookupEdgarFund(assetId);
    if (!entry) return EMPTY;

    try {
        const accession = await latestNmfpAccession(entry.cik);
        if (!accession) return EMPTY;

        const noDashes = accession.replace(/-/g, "");
        const xmlUrl = `https://www.sec.gov/Archives/edgar/data/${entry.cik}/${noDashes}/primary_doc.xml`;
        const res = await fetch(xmlUrl, { headers: { "User-Agent": secUserAgent() } });
        if (!res.ok) throw new Error(`edgar xml ${res.status}`);
        const xml = await res.text();

        const data = parseNmfp(xml);
        if (!data) return EMPTY;

        // INTEGRITY: refuse to attribute a filing for a different series.
        if (data.seriesId !== entry.seriesId) {
            console.error(
                `[edgar] seriesId mismatch for ${assetId}: filing ${data.seriesId} != registry ${entry.seriesId}. Not emitting.`,
            );
            return EMPTY;
        }

        const source = `SEC EDGAR N-MFP (${entry.seriesId})`;
        const result: AdapterResult = {
            fields: {},
            backing_evidence: [buildRegulatorEvidence(data, source)],
            // v1.3: the registered-MMF redemption-restriction signal — the latest
            // liquidity-fee flag + any fee events. Merged with the on-chain
            // pause/incident contribution by the orchestrator.
            redemption_history_data: buildFeeContribution(
                data.liquidityFeeApplied,
                buildFeeEvents(data, source),
                data.reportDate || new Date().toISOString(),
            ),
        };

        const navValue = navFromFiling(data);
        if (navValue != null) {
            result.fields.nav = field(navValue, {
                source,
                method: "reference_api",
                confidence: "verified",
                as_of: data.reportDate || new Date().toISOString(),
            });
        }

        return result;
    } catch (err) {
        console.error(`[edgar] lookup failed for ${assetId}:`, err);
        return EMPTY;
    }
}
