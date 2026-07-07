// ---------------------------------------------------------------------------
// rwa.xyz adapter (OPTIONAL — Enterprise API)
// ---------------------------------------------------------------------------
// IMPORTANT: rwa.xyz has no free programmatic API. The $0 plan is dashboard-
// only; /v4/assets requires a paid Enterprise key. This adapter therefore runs
// only when RWA_XYZ_API_KEY is set, and never scrapes. When absent (the common
// case) it contributes nothing and the qualitative load falls to the seed +
// LLM extractor — exactly the coverage-tier honesty mechanism.
//
// Their research team human-verifies data, so identity fields are `verified`
// (reference_api). We defensively map only well-known, stable fields; anything
// missing is simply omitted.
// ---------------------------------------------------------------------------

import { field, type AdapterResult, EMPTY } from "@/lib/ingestion/adapters/base";
import type { ParsedAssetId } from "@/lib/chains";
import { rwaXyzKey } from "@/lib/env";

const BASE = "https://api.rwa.xyz/v4";

interface Metric {
    val?: number | null;
}

interface RwaAsset {
    name?: string;
    ticker?: string;
    issuer_name?: string;
    asset_class_name?: string;
    circulating_market_value_dollar?: Metric;
    minimum_investment_dollar?: Metric;
}

function num(m: Metric | undefined): number | null {
    return typeof m?.val === "number" ? m.val : null;
}

export async function rwaxyzAdapter(asset: ParsedAssetId, symbolHint?: string): Promise<AdapterResult> {
    const key = rwaXyzKey();
    if (!key || !symbolHint) return EMPTY;

    try {
        const query = JSON.stringify({
            filter: { operator: "equals", field: "ticker", value: symbolHint },
            pagination: { page: 1, perPage: 1 },
        });
        const res = await fetch(`${BASE}/assets?query=${encodeURIComponent(query)}`, {
            headers: { Authorization: `Bearer ${key}`, accept: "application/json" },
        });
        if (!res.ok) return EMPTY;

        const json = (await res.json()) as { results?: RwaAsset[] };
        const row = json.results?.[0];
        if (!row) return EMPTY;

        const result: AdapterResult = { fields: {}, identifiers: {} };
        const nowIso = new Date().toISOString();

        if (row.issuer_name) result.identifiers!.issuer_name = row.issuer_name;
        if (row.name) result.identifiers!.name = row.name;

        const aum = num(row.circulating_market_value_dollar);
        if (aum != null) {
            result.fields.aum = field(aum, {
                source: "rwa.xyz",
                method: "reference_api",
                confidence: "verified",
                as_of: nowIso,
            });
        }

        const minInv = num(row.minimum_investment_dollar);
        if (minInv != null) {
            result.fields.min_investment_usd = field(minInv, {
                source: "rwa.xyz",
                method: "reference_api",
                confidence: "verified",
                as_of: nowIso,
            });
        }

        return result;
    } catch (err) {
        console.error("[rwaxyz] lookup failed:", err);
        return EMPTY;
    }
}
