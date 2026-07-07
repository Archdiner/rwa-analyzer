// ---------------------------------------------------------------------------
// GET /api/verify?asset={symbol | chainId:address} — the agent verification tool
// ---------------------------------------------------------------------------
// The primary artifact of this project: an honest, machine-readable backing
// verifiability read that any caller (agent, CLI, another service) can call
// before it commits money to a tokenized asset. The web card, the CLI, and the
// MCP server are all clients of THIS. It returns the two-axis AgentVerdict whose
// caveat is load-bearing by construction (see lib/agent/verdict.ts).
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
