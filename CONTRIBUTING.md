# Contributing

Thanks for helping improve RWA backing verification. This project values **honest unknowns** over inflated coverage.

## Before you open a PR

1. `npm install`
2. `npm run test` (128+ unit tests on the main tree)
3. `npm run lint`
4. If you touch MCP/CLI: `npm run build:verify`

## Adding a flagship asset

1. **Research first** — confirm contract address, chain, and at least one independent evidence path (EDGAR CIK/series, attestation URL, or published reserve wallet).
2. **Edit `lib/seed/assets.ts`** — add the asset with all verdict-affecting fields (`tokenizationMode`, `defillamaPool`, jurisdiction, etc.).
3. **Forward every seed field** through `seedIngestOptions` — silent drops change verdicts with no error. Run `npm run test -- seed-options`.
4. **Registry entries** (human-gated, same discipline):
   - EDGAR: `lib/ingestion/adapters/edgar-registry.ts`
   - Attestation: `lib/ingestion/adapters/attestation-registry.ts`
   - Chainlink PoR: `lib/ingestion/adapters/chainlink-registry.ts`
5. **Run `npm run seed`** against a dev Supabase instance and inspect `/api/verify?asset=SYMBOL`.
6. **Document gaps** in the PR — if backing stays `unverifiable`, say why.

## Adding an attestation (Lane C)

1. Confirm the PDF/HTML URL is stable and cites machine-readable figures.
2. Add to `attestation-registry.ts` with issuer metadata.
3. Attestations cap at `verified_backed` + `auto` (never `verified`). Green still requires arithmetic/citation guards.

## Code conventions

- **Contracts** in `lib/contracts.ts` are frozen — add fields additively; never repurpose.
- **LLM only in ingestion** — computation is deterministic, no LLM in `lib/computation/`.
- **Confidence is per field**, never per asset.
- **Reconciliation only demotes** — never promotes confidence on conflict.
- No `Co-Authored-By` lines in commit messages.

See `CLAUDE.md` / `AGENTS.md` for full invariants.

## MCP / CLI package

The publishable client lives in `packages/rwa-verify/`. Source of truth for logic is `mcp/server.ts` and `bin/rwa-verify.ts` at the repo root; the package bundles them with `tsup`. After editing those files, run `npm run build:verify` before publishing.

## Questions

Open a [GitHub issue](https://github.com/Archdiner/rwa-analyzer/issues) with the **Request asset verification** label or ask in your PR.
