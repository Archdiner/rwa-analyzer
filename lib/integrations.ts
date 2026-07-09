// ---------------------------------------------------------------------------
// Copy-paste integration snippets for the marketing / docs surface.
// ---------------------------------------------------------------------------

import { GITHUB_URL } from "@/lib/site";

/** Default deployed API - override with RWA_API_BASE for local dev. */
export const DEFAULT_API_BASE = "https://rwa-analyzer.vercel.app";

export const MCP_CONFIG = `{
  "mcpServers": {
    "rwa-backing-verifier": {
      "command": "npx",
      "args": ["tsx", "mcp/server.ts"],
      "cwd": "/absolute/path/to/rwa-analyzer",
      "env": { "RWA_API_BASE": "${DEFAULT_API_BASE}" }
    }
  }
}`;

export const CURSOR_MCP_HINT =
    "Cursor → Settings → MCP → paste the JSON above (or clone the repo and point cwd at your checkout).";

export const CLI_EXAMPLES = `# Before routing a deposit, check backing:
npm run verify -- BENJI
npm run verify -- OUSG
npm run verify -- 1:0x3ddc84940ab509c11b20b76b466933f40b750dc9

# Exit code is always 0 - read tier + caveats in the output.
# Set RWA_API_BASE=http://localhost:3000 for local dev.`;

export const HTTP_EXAMPLES = `# Structured AgentVerdict JSON - same contract as MCP + CLI
curl -s "${DEFAULT_API_BASE}/api/verify?asset=BENJI" | jq '.data.backing'

# Gate in your app (example):
# if (verdict.backing.tier === "does_not_reconcile") block();
# if (verdict.backing.caveats.length) surface them - never reduce to safe/unsafe.`;

export const AGENT_GUARD_EXAMPLE = `// Pre-deposit guard for wallets / treasury bots
const res = await fetch(\`\${API}/api/verify?asset=\${symbol}\`);
const { data: v } = await res.json();

// No boolean safe flag - read tier + market_risk + caveats together
if (v.backing.tier === "does_not_reconcile" || v.market_risk === "critical") {
  return { allow: false, reason: v.backing.meaning, caveats: v.backing.caveats };
}
if (v.backing.tier === "unverifiable") {
  return { allow: "warn", reason: v.backing.meaning, caveats: v.backing.caveats };
}
// verified_backed still has a trust_boundary - surface it
return { allow: true, trust_boundary: v.backing.trust_boundary, caveats: v.backing.caveats };`;

export const REPO_CLONE = `git clone ${GITHUB_URL}
cd rwa-analyzer && npm install
npm run mcp   # stdio MCP server
npm run verify -- BENJI`;
