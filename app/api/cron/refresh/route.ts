// ---------------------------------------------------------------------------
// GET /api/cron/refresh - daily quant refresh of stored assets
// ---------------------------------------------------------------------------
// Re-runs the fast quant ingest (supply/reserves/nav/yield) for the stalest
// stored assets and recomputes their assessments. Qualitative fields change
// rarely and are left to the on-demand/next-load fill. Guarded by CRON_SECRET.
// ---------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";
import { cronSecret } from "@/lib/env";
import { staleAssetIds, saveAsset } from "@/lib/store";
import { ingestQuant } from "@/lib/ingestion";
import { getSeed } from "@/lib/seed/assets";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const BATCH = 15; // cap RPC/API load per run

export async function GET(req: NextRequest) {
    const secret = cronSecret();
    if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const ids = await staleAssetIds(ONE_DAY_MS, BATCH);
    const results: { asset_id: string; status: "ok" | "error" }[] = [];

    for (const assetId of ids) {
        try {
            const seed = getSeed(assetId);
            const record = await ingestQuant(assetId, seed ? {
                identifiers: seed.identifiers,
                seedFields: seed.seedFields,
                disclosureUrl: seed.disclosureUrl,
            } : {});
            await saveAsset(record);
            results.push({ asset_id: assetId, status: "ok" });
        } catch (err) {
            console.error(`[cron] refresh failed for ${assetId}:`, err);
            results.push({ asset_id: assetId, status: "error" });
        }
    }

    return NextResponse.json({ success: true, refreshed: results.length, results });
}
