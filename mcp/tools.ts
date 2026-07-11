// ---------------------------------------------------------------------------
// Shared MCP server + tool metadata
// ---------------------------------------------------------------------------
// Single source of truth for the server identity and the tools it exposes, so
// the .well-known/mcp/server-card advertisement (app/.well-known/mcp/...) can't
// drift from what the stdio server registers.
//
// TODO(follow-up): have mcp/server.ts import MCP_SERVER/MCP_TOOLS from here so
// the registration and the card are provably one source. Deferred only because
// server.ts currently carries unrelated in-flight edits; the card + its test
// already read from this constant.
// ---------------------------------------------------------------------------

export const MCP_SERVER = {
    name: "rwa-backing-verifier",
    version: "1.0.0",
    description:
        "Backing-verifiability reads for tokenized real-world assets (money-market funds, " +
        "tokenized treasuries, yield-bearing stablecoins). Three-axis verdicts (tier, confidence, " +
        "freshness); no safe/unsafe boolean.",
} as const;

export interface McpToolInfo {
    name: string;
    title: string;
    description: string;
}

export const MCP_TOOLS: McpToolInfo[] = [
    {
        name: "check_asset_backing",
        title: "Check RWA backing verifiability",
        description:
            "Returns a machine-readable backing-verifiability read for a tokenized real-world asset. " +
            "Input is a ticker (e.g. OUSG, BENJI, sDAI) or '{chainId}:{address}'.",
    },
    {
        name: "list_verified_assets",
        title: "List assets the verifier knows",
        description:
            "Lists the assets this verifier can check by ticker, with each one's current backing " +
            "tier and confidence. Use it to discover what check_asset_backing can be called on.",
    },
];
