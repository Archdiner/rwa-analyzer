# @archdiner/rwa-verify

MCP server and CLI for the [RWA Reliability Analyzer](https://github.com/Archdiner/rwa-analyzer). Thin HTTP clients over `GET /api/verify` — no local secrets required when using the hosted API.

## Install (MCP)

Add to your MCP client config:

```json
{
  "mcpServers": {
    "rwa-backing-verifier": {
      "command": "npx",
      "args": ["-y", "@archdiner/rwa-verify@latest", "mcp"]
    }
  }
}
```

**Tools:** `check_asset_backing`, `list_verified_assets`

## Install (CLI)

```bash
npx @archdiner/rwa-verify@latest OUSG
npx @archdiner/rwa-verify@latest BENJI
```

## Environment

| Variable | Default | Purpose |
|----------|---------|---------|
| `RWA_API_BASE` | `https://rwa-analyzer.vercel.app` | API base URL (use `http://localhost:3000` for local dev) |

## Full docs

See [docs/INTEGRATIONS.md](https://github.com/Archdiner/rwa-analyzer/blob/main/docs/INTEGRATIONS.md) in the main repo.
