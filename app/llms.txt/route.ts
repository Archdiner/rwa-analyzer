import { appUrl } from "@/lib/env";
import { allSeeds } from "@/lib/seed/assets";
import { GITHUB_URL } from "@/lib/site";

// Curated index only - a pointer to the agent surface, not a full-text mirror.
// Deliberately no llms-full.txt: full-text dumps go stale and are the flagged
// anti-pattern; the value here is a small, maintained map for IDE/coding agents.
export function GET(): Response {
    const base = appUrl();

    const assets = allSeeds()
        .map(
            ({ assetId, seed }) =>
                `- [${seed.identifiers.symbol}](${base}/a/${encodeURIComponent(assetId)}): ${seed.identifiers.name}`,
        )
        .join("\n");

    const body = `# RWA Reliability

> Structured backing verdicts for tokenized real-world assets. Check where proof
> stops before an agent or wallet routes a deposit. Every verdict is three-axis
> (tier, confidence, freshness) and rests only on arithmetic guards - verbatim
> citation match and supply x NAV reconciliation - never on model confidence.

## Agent access
- HTTP API: \`GET ${base}/api/verify?asset={symbol|chainId:address}\` returns a structured backing verdict (JSON).
- Universe: \`GET ${base}/api/universe\` lists the assets that can be verified.
- MCP server: a stdio server exposing \`check_asset_backing\` and \`list_verified_assets\` (run \`npm run mcp\`).
- CLI: \`npm run verify -- {symbol}\`.

## Verified assets
${assets}

## Source
- Code, architecture, and contracts: ${GITHUB_URL}
`;

    return new Response(body, {
        headers: { "content-type": "text/plain; charset=utf-8" },
    });
}
