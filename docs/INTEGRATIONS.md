# Integrations

The backing verdict is one server-side contract (`toAgentVerdict` in `lib/agent/verdict.ts`), exposed identically over HTTP, CLI, and MCP. There is **no boolean `safe` flag** — agents must read `tier`, `confidence`, `freshness`, and non-empty `caveats` together.

## Surfaces

| Surface | Entry | Install |
| --- | --- | --- |
| **HTTP** | `GET /api/verify?asset={symbol\|chainId:address}` | Hosted at `https://rwa-analyzer.vercel.app` |
| **CLI** | `rwa-verify <asset>` | `npx -y -p @archdiner/rwa-verify rwa-verify OUSG` |
| **MCP** | stdio tools (below) | `npx -y -p @archdiner/rwa-verify rwa-verify-mcp` |

### MCP tools

| Tool | Input | Returns |
| --- | --- | --- |
| `check_asset_backing` | `asset`: ticker or `{chainId}:{address}` | Text summary + `structuredContent` (`AgentVerdict` JSON) |
| `list_verified_assets` | (none) | Known assets with current backing tier/confidence |

## Environment

| Variable | Default | Purpose |
| --- | --- | --- |
| `RWA_API_BASE` | `https://rwa-analyzer.vercel.app` | Point CLI/MCP at production or `http://localhost:3000` |

No API keys are required for CLI/MCP when using the hosted API.

## MCP configuration by client

### Cursor (project — clone this repo)

`.cursor/mcp.json` is committed and uses `npm run mcp` from the workspace root.

### Cursor / Claude Desktop / Windsurf (published package)

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

**File locations:** Cursor `~/.cursor/mcp.json` or `.cursor/mcp.json`; Claude Desktop `~/Library/Application Support/Claude/claude_desktop_config.json`; Windsurf `~/.codeium/windsurf/mcp_config.json`; Claude Code `.mcp.json` or `claude mcp add`.

### VS Code + GitHub Copilot

VS Code uses `"servers"` (not `"mcpServers"`) and requires `"type": "stdio"`:

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

Save as `.vscode/mcp.json` in the project or via **MCP: Open User Configuration**.

## CLI examples

```bash
# Published package (no clone)
npx -y -p @archdiner/rwa-verify rwa-verify OUSG
npx -y -p @archdiner/rwa-verify rwa-verify BENJI
npx -y -p @archdiner/rwa-verify rwa-verify 1:0x7712c34205737192402172409a8f7ccef8aa2aec

# From a cloned repo
npm run verify -- OUSG
RWA_API_BASE=http://localhost:3000 npm run verify -- BENJI
```

Exit codes do **not** encode backing tier. Read the printed verdict or JSON; do not branch on `0`/`1` alone.

## HTTP examples

```bash
curl -s "https://rwa-analyzer.vercel.app/api/verify?asset=OUSG" | jq .
curl -s "https://rwa-analyzer.vercel.app/api/universe" | jq '.data.universe[].symbol'
```

Response shape:

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

```javascript
const BASE = process.env.RWA_API_BASE ?? "https://rwa-analyzer.vercel.app";

export async function verifyBacking(asset) {
  const res = await fetch(`${BASE}/api/verify?asset=${encodeURIComponent(asset)}`);
  const json = await res.json();
  if (!res.ok || !json.success) throw new Error(json.error ?? `HTTP ${res.status}`);
  return json.data;
}

/** Example policy: block only on explicit reconciliation failure. */
export function shouldBlockDeposit(verdict) {
  if (verdict.backing.tier === "does_not_reconcile") return { block: true, reason: verdict.backing.meaning };
  if (verdict.backing.caveats?.length) return { block: false, warn: verdict.backing.caveats };
  return { block: false };
}
```

Always surface `meaning`, `trust_boundary`, and `caveats` to the user — never collapse to “safe” or “unsafe”.

## Local full stack

To run ingestion + scoring locally (not required for MCP/CLI against hosted API):

```bash
cp .env.example .env.local   # fill Supabase + optional RPC/OpenAI
npm install && npm run dev   # http://localhost:3000
RWA_API_BASE=http://localhost:3000 npm run verify -- BENJI
```

See [ARCHITECTURE.md](./ARCHITECTURE.md) and [METHODOLOGY.md](./METHODOLOGY.md).

## Publishing the npm package

Maintainers:

```bash
npm run build:verify
cd packages/rwa-verify && npm publish --access public
```

Requires npm login and ownership of the `@archdiner` scope (or change the package name in `packages/rwa-verify/package.json` before first publish).
