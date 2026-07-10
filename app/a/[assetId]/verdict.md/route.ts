// GET /a/{assetId}/verdict.md - markdown rendering of the backing verdict.
// Reached directly, or via the Accept: text/markdown rewrite in middleware.ts.

import { NextRequest, after } from "next/server";
import { getAsset, fillQualitative } from "@/lib/service";
import { getSeed, resolveSeedAssetId } from "@/lib/seed/assets";
import { toAgentVerdict } from "@/lib/agent/verdict";
import { renderVerdictMarkdown } from "@/lib/agent/markdown";

export const dynamic = "force-dynamic";

function md(body: string, status = 200): Response {
    return new Response(body, {
        status,
        headers: { "content-type": "text/markdown; charset=utf-8", vary: "Accept" },
    });
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ assetId: string }> }) {
    const { assetId } = await params;
    const resolved = resolveSeedAssetId(decodeURIComponent(assetId));
    if (!resolved) return md(`# Unknown asset\n\nNo known symbol or canonical "{chainId}:{address}".\n`, 404);

    const result = await getAsset(resolved);
    if (!result) return md("# Not readable\n\nDoes not resolve to readable on-chain data.\n", 404);

    if (result.needsFill) after(() => fillQualitative(resolved));

    const providerUrl = getSeed(resolved)?.providerUrl ?? null;
    const verdict = toAgentVerdict(result.data.record, result.data.assessment, providerUrl);
    return md(renderVerdictMarkdown(verdict));
}
