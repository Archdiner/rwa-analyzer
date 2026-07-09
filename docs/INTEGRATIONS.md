# Integrations

One engine, three doors. Same verdict whether you hit HTTP, the CLI, or MCP.

Under the hood it's always `toAgentVerdict` in `lib/agent/verdict.ts`. There is **no `safe: true` boolean** (we checked twice). Agents need to read `tier`, `confidence`, `freshness`, and whatever lands in `caveats`. Together. Like a responsible adult.

### How a green is earned (three lanes)

Three doors in, but a green `tier: verified_backed` only comes out through one of three evidence lanes, and the verdict always tells you which one. In descending order of how much you have to trust a human:

1. **Regulator filing** (EDGAR N-MFP, for registered funds): independence 5, the only lane that reaches `verified` green. BENJI rides this one.
2. **On-chain reconstruction** (reserves read straight off chain): `verified` too, but only when the reserve wallet is actually published and attributable. Often it isn't.
3. **Auditor attestation** (Lane C, a CPA/administrator PDF): independence 4, green-capable but capped at `auto`, never `verified`. A visibly lesser cell, and the number *still* has to reconcile against supply × NAV before it counts.

No lane skips the arithmetic. If nothing reconciles, you get an honest `unverifiable`, not a hopeful green. `unverifiable` is not "unsafe", and a missing red flag is not a green light. Read `meaning` + `trust_boundary` + `caveats` and let the human decide.

## Surfaces

| Surface | Entry | Install |
| --- | --- | --- |
| **HTTP** | `GET /api/verify?asset={symbol\|chainId:address}` | Live at `https://rwa-analyzer.vercel.app` |
| **CLI** | `rwa-verify <asset>` | `npx -y -p @archdiner/rwa-verify rwa-verify OUSG` |
| **MCP** | stdio tools (below) | `npx -y -p @archdiner/rwa-verify rwa-verify-mcp` |

### MCP tools

| Tool | Input | Returns |
| --- | --- | --- |
| `check_asset_backing` | `asset`: ticker or `{chainId}:{address}` | Plain-English summary + full `AgentVerdict` JSON in `structuredContent` |
| `list_verified_assets` | (none) | Assets we know about, with current backing tier/confidence |

## Environment

| Variable | Default | Purpose |
| --- | --- | --- |
| `RWA_API_BASE` | `https://rwa-analyzer.vercel.app` | Point CLI/MCP at prod, or `http://localhost:3000` if you're running the app yourself |

No API keys needed for CLI/MCP when you use the hosted API. Seriously. We meant it.

## MCP configuration by client

### Claude Code (one command, no clone)

Paste this into your terminal and you're done:

```bash
claude mcp add rwa-backing-verifier \
  -e RWA_API_BASE=https://rwa-analyzer.vercel.app \
  -- npx -y -p @archdiner/rwa-verify@latest rwa-verify-mcp
```

Prefer to let the agent do it? Paste this into a Claude Code chat instead:

> Add an MCP server named `rwa-backing-verifier` that runs `npx -y -p @archdiner/rwa-verify@latest rwa-verify-mcp` with env `RWA_API_BASE=https://rwa-analyzer.vercel.app`, then call `list_verified_assets` so I know it's live.

Either way, ask it to `check_asset_backing OUSG` to confirm the wiring.

### Cursor (you cloned this repo)

`.cursor/mcp.json` is already here. It runs `npm run mcp` from the project root. Open Cursor, enable the server, go bother an agent about OUSG.

### Cursor / Claude Desktop / Windsurf (published npm package)

```json
{
  "mcpServers": {
    "rwa-backing-verifier": {
      "command": "npx",
      "args": ["-y", "-p", "@archdiner/rwa-verify@latest", "rwa-verify-mcp"],
      "env": {
        "RWA_API_BASE": "https://rwa-analyzer.vercel.app"
      }
    }
  }
}
```

**Where to put it:**
- Cursor: `~/.cursor/mcp.json` or `.cursor/mcp.json`
- Claude Desktop: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windsurf: `~/.codeium/windsurf/mcp_config.json`
- Claude Code: `.mcp.json` or `claude mcp add`

### VS Code + GitHub Copilot

VS Code is special. It wants `"servers"` instead of `"mcpServers"`, and each entry needs `"type": "stdio"`. Because of course it does.

```json
{
  "servers": {
    "rwa-backing-verifier": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "-p", "@archdiner/rwa-verify@latest", "rwa-verify-mcp"],
      "env": {
        "RWA_API_BASE": "https://rwa-analyzer.vercel.app"
      }
    }
  }
}
```

Drop that in `.vscode/mcp.json`, or open **MCP: Open User Configuration** and paste it there.

## CLI examples

```bash
# Published package (no clone, no shame)
npx -y -p @archdiner/rwa-verify rwa-verify OUSG
npx -y -p @archdiner/rwa-verify rwa-verify BENJI
npx -y -p @archdiner/rwa-verify rwa-verify 1:0x7712c34205737192402172409a8f7ccef8aa2aec

# From a cloned repo (we see you, contributor)
npm run verify -- OUSG
RWA_API_BASE=http://localhost:3000 npm run verify -- BENJI
```

Exit codes do **not** tell you if backing is good. Read the verdict. Don't `if (exitCode === 0) { yoloDeposit() }`. Please.

## HTTP examples

```bash
curl -s "https://rwa-analyzer.vercel.app/api/verify?asset=OUSG" | jq .
curl -s "https://rwa-analyzer.vercel.app/api/universe" | jq '.data.universe[].symbol'
```

Response shape (abbreviated):

```json
{
  "success": true,
  "data": {
    "asset": { "asset_id": "...", "symbol": "OUSG", "name": "...", "issuer_name": "..." },
    "backing": {
      "tier": "unverifiable",
      "confidence": "verified",
      "freshness": null,
      "meaning": "...",
      "trust_boundary": null,
      "caveats": ["..."]
    },
    "dimensions": { "backing": { "flag": "unknown", "confidence": "verified", "reason": "...", "sources": [] } },
    "evidence": [],
    "disclaimer": "..."
  }
}
```

## Agent guard (JavaScript)

A minimal example you can steal:

```javascript
const BASE = process.env.RWA_API_BASE ?? "https://rwa-analyzer.vercel.app";

export async function verifyBacking(asset) {
  const res = await fetch(`${BASE}/api/verify?asset=${encodeURIComponent(asset)}`);
  const json = await res.json();
  if (!res.ok || !json.success) throw new Error(json.error ?? `HTTP ${res.status}`);
  return json.data;
}

/** Example policy: only hard-block on explicit reconciliation failure. */
export function shouldBlockDeposit(verdict) {
  if (verdict.backing.tier === "does_not_reconcile") return { block: true, reason: verdict.backing.meaning };
  if (verdict.backing.caveats?.length) return { block: false, warn: verdict.backing.caveats };
  return { block: false };
}
```

Show the user `meaning`, `trust_boundary`, and `caveats`. Don't summarize as "looks safe to me, boss."

## Local full stack

Only needed if you want to run ingestion and scoring yourself. MCP/CLI against the hosted API skip all of this.

```bash
cp .env.example .env.local   # Supabase + optional RPC/OpenAI
npm install && npm run dev   # http://localhost:3000
RWA_API_BASE=http://localhost:3000 npm run verify -- BENJI
```

More context: [ARCHITECTURE.md](./ARCHITECTURE.md), [METHODOLOGY.md](./METHODOLOGY.md).

## Publishing the npm package

For maintainers (that's probably you if you're reading this section):

```bash
npm run build:verify
cd packages/rwa-verify && npm publish --access public
```

You'll need `npm login` and the `@archdiner` scope. No scope? Rename the package in `packages/rwa-verify/package.json` before your first publish. Future you will thank present you.
