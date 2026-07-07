// ---------------------------------------------------------------------------
// Asset service — get-or-ingest orchestration
// ---------------------------------------------------------------------------
// Shared by the API route and the risk-card page. Implements the two-phase
// cold-lookup: a cache miss runs the fast quant ingest and returns immediately
// with `needsFill: true`; the caller defers the slow qualitative fill (OpenAI)
// via next/server `after`, so the first render is fast and the LLM call happens
// off the response path.
// ---------------------------------------------------------------------------

import type { IngestOptions } from "@/lib/ingestion";
import { ingestQuant, ingestQualitative } from "@/lib/ingestion";
import { getStoredAsset, saveAsset, type StoredAsset } from "@/lib/store";
import { getSeed } from "@/lib/seed/assets";

function seedOptions(assetId: string): IngestOptions {
    const seed = getSeed(assetId);
    if (!seed) return {};
    return {
        identifiers: seed.identifiers,
        seedFields: seed.seedFields,
        disclosureUrl: seed.disclosureUrl,
    };
}

export interface AssetResult {
    data: StoredAsset;
    needsFill: boolean;
}

/**
 * Returns a renderable asset. Cache hit is returned as-is (flagging whether a
 * qualitative fill is still pending). Cache miss runs the fast quant phase,
 * stores it, and returns it with needsFill=true. Returns null if the asset
 * does not resolve to any readable data.
 */
export async function getAsset(assetId: string): Promise<AssetResult | null> {
    const cached = await getStoredAsset(assetId);
    if (cached) {
        return { data: cached, needsFill: cached.record.qualitative_pending === true };
    }

    const record = await ingestQuant(assetId, seedOptions(assetId));

    // Nothing readable on-chain and not seeded -> not a resolvable asset.
    if (Object.keys(record.fields).length === 0) return null;

    const assessment = await saveAsset(record);
    return {
        data: {
            record,
            assessment,
            ingested_at: record.ingested_at,
            computed_at: assessment.computed_at,
        },
        needsFill: record.qualitative_pending === true,
    };
}

/**
 * Runs the deferred qualitative phase for an asset and persists the result.
 * Safe to call from `after()`; failures are logged, not thrown.
 */
export async function fillQualitative(assetId: string): Promise<void> {
    try {
        const stored = await getStoredAsset(assetId);
        const opts = seedOptions(assetId);

        // Prefer the stored record; if none (no DB), re-run quant to get one.
        const base = stored?.record ?? (await ingestQuant(assetId, opts));
        if (base.qualitative_pending === false) return;

        const filled = await ingestQualitative(base, opts);
        await saveAsset(filled);
    } catch (err) {
        console.error(`[service] qualitative fill failed for ${assetId}:`, err);
    }
}
