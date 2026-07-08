// ---------------------------------------------------------------------------
// GET /api/asset/{id} - cache-or-on-demand asset assessment
// ---------------------------------------------------------------------------
// id = canonical asset_id "{chainId}:{address}". Two-phase: returns the fast
// quant card immediately and defers the slow qualitative fill via `after`. Rate
// limited so cold lookups (each an on-chain read, and eventually one OpenAI
// call) cannot be abused.
// ---------------------------------------------------------------------------

import { NextRequest } from "next/server";
import { after } from "next/server";
import { successResponse, errorResponse, rateLimit, rateLimitedResponse, getClientIp } from "@/lib/api-utils";
import { parseAssetId } from "@/lib/chains";
import { getAsset, fillQualitative } from "@/lib/service";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const { allowed } = rateLimit(`asset:${getClientIp(req)}`);
    if (!allowed) return rateLimitedResponse();

    const { id } = await params;
    if (!parseAssetId(id)) return errorResponse("Malformed asset_id (expected '{chainId}:{address}').", 400);

    const result = await getAsset(id);
    if (!result) return errorResponse("Asset does not resolve to any readable on-chain data.", 404);

    // Defer the expensive qualitative fill off the response path.
    if (result.needsFill) {
        after(() => fillQualitative(id));
    }

    return successResponse({
        record: result.data.record,
        assessment: result.data.assessment,
        ingested_at: result.data.ingested_at,
        computed_at: result.data.computed_at,
        qualitative_pending: result.data.record.qualitative_pending === true,
    });
}
