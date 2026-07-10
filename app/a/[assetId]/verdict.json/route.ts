// GET /a/{assetId}/verdict.json - the AgentVerdict as JSON, keyed off the path
// param (no query). Reached directly, or via the Accept: application/json rewrite
// in middleware.ts. Path-based (like verdict.md) so the rewrite carries no query.

import { NextRequest, after } from "next/server";
import { getAsset, fillQualitative } from "@/lib/service";
import { getSeed, resolveSeedAssetId } from "@/lib/seed/assets";
import { toAgentVerdict } from "@/lib/agent/verdict";

export const dynamic = "force-dynamic";

function json(data: unknown, status = 200): Response {
    return Response.json(data, { status, headers: { vary: "Accept" } });
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ assetId: string }> }) {
    const { assetId } = await params;
    const resolved = resolveSeedAssetId(decodeURIComponent(assetId));
    if (!resolved) return json({ success: false, error: "Unknown asset." }, 404);

    const result = await getAsset(resolved);
    if (!result) return json({ success: false, error: "Does not resolve to readable on-chain data." }, 404);

    if (result.needsFill) after(() => fillQualitative(resolved));

    const providerUrl = getSeed(resolved)?.providerUrl ?? null;
    return json({ success: true, data: toAgentVerdict(result.data.record, result.data.assessment, providerUrl) });
}
