# @archdiner/rwa-verify

MCP server and CLI for the [RWA Reliability Analyzer](https://github.com/Archdiner/rwa-analyzer).

Thin HTTP clients over `GET /api/verify`. No local secrets when you use the hosted API. Clone the full repo only if you're into that kind of thing.

## MCP install

Paste into your MCP client config:

```json
{
  "mcpServers": {
    "rwa-backing-verifier": {
      "command": "npx",
      "args": ["-y", "-p", "@archdiner/rwa-verify@latest", "rwa-verify-mcp"]
    }
  }
}
```

**Tools:** `check_asset_backing`, `list_verified_assets`

## CLI

```bash
npx -y -p @archdiner/rwa-verify rwa-verify OUSG
npx -y -p @archdiner/rwa-verify rwa-verify BENJI
```

## Environment

| Variable | Default | Purpose |
|----------|---------|---------|
| `RWA_API_BASE` | `https://rwa-analyzer.vercel.app` | API base URL (`http://localhost:3000` for local dev) |

## Full docs

[docs/INTEGRATIONS.md](https://github.com/Archdiner/rwa-analyzer/blob/main/docs/INTEGRATIONS.md) in the main repo. Cursor, Claude, VS Code, Windsurf configs live there.
