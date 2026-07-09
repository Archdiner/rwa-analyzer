# Security policy

## Supported versions

| Version | Supported |
| --- | --- |
| `main` / latest release | Yes |

## Reporting a vulnerability

**Please don't open a public GitHub issue for security stuff.**

Use [GitHub private vulnerability reporting](https://github.com/Archdiner/rwa-analyzer/security/advisories/new) or contact the repo owner directly.

Tell us:

- What you found
- How to reproduce it
- Why it matters (especially if it touches MCP stdio or API abuse)

We'll try to acknowledge within 72 hours. We're human; if we're slow, nudge us.

## Scope notes

- **MCP stdio** runs as a local subprocess under whatever trust model your IDE uses. Only install MCP configs from sources you trust. In production agent workflows, pin `@archdiner/rwa-verify` to a specific version.
- **`GET /api/verify`** is rate-limited and read-only. It does not move money or execute trades. (We can't stress this enough.)
- **Secrets** (`OPENAI_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, RPC URLs) stay on the server. Don't put them in MCP client config when you're using the hosted API.

## Out of scope

- Losing money because you treated a verdict as financial advice (it's a verifiability read, not a hot stock tip)
- SEC EDGAR, Chainlink, or issuer sites getting compromised (we read them; we don't run them)
