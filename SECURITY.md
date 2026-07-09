# Security policy

## Supported versions

| Version | Supported |
| --- | --- |
| `main` / latest release | Yes |

## Reporting a vulnerability

**Do not open a public GitHub issue for security vulnerabilities.**

Email the maintainers via GitHub private vulnerability reporting on [Archdiner/rwa-analyzer](https://github.com/Archdiner/rwa-analyzer/security/advisories/new) or contact the repo owner directly.

Include:

- Description of the issue
- Steps to reproduce
- Impact assessment (especially for MCP stdio command execution or API abuse)

We aim to acknowledge reports within 72 hours.

## Scope notes

- **MCP stdio** runs as a local subprocess under your IDE's trust model. Only install MCP configs from sources you trust; prefer the published `@archdiner/rwa-verify` package with pinned versions in production agent workflows.
- **`GET /api/verify`** is rate-limited and read-only. It does not move funds or execute trades.
- **Secrets** (`OPENAI_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, RPC URLs) belong in server-side env only — never in MCP client config when using the hosted API.

## Out of scope

- Investment loss from acting on a verdict (the tool is a verifiability read, not financial advice)
- Compromise of third-party data sources (SEC EDGAR, Chainlink, issuer sites)
