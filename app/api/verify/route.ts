// ---------------------------------------------------------------------------
// GET /api/verify?asset={symbol | chainId:address}
// ---------------------------------------------------------------------------
// Returns the AgentVerdict JSON contract shared by the web UI, CLI, and MCP server.
// ---------------------------------------------------------------------------

import { NextRequest, after } from "next/server";
import { successResponse, errorResponse, rateLimit, rateLimitedResponse, getClientIp } from "@/lib/api-utils";
import { getAsset, fillQualitative } from "@/lib/service";
import { getSeed, resolveSeedAssetId } from "@/lib/seed/assets";
import { toAgentVerdict } from "@/lib/agent/verdict";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
    const { allowed } = rateLimit(`verify:${getClientIp(req)}`);
    if (!allowed) return rateLimitedResponse();

    const query = req.nextUrl.searchParams.get("asset");
    if (!query) {
        return errorResponse("Provide ?asset=<symbol or '{chainId}:{address}'>.", 400);
    }

    const assetId = resolveSeedAssetId(query);
    if (!assetId) {
        return errorResponse(
            `Unknown asset "${query}". Use a known symbol (e.g. OUSG, BENJI) or a canonical "{chainId}:{address}".`,
            404,
        );
    }

    const result = await getAsset(assetId);
    if (!result) return errorResponse("Asset does not resolve to any readable on-chain data.", 404);

    if (result.needsFill) {
        after(() => fillQualitative(assetId));
    }

    const providerUrl = getSeed(assetId)?.providerUrl ?? null;
    return successResponse(toAgentVerdict(result.data.record, result.data.assessment, providerUrl));
}
