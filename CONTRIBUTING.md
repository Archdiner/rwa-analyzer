# Contributing

Thanks for showing up. This project prefers **honest unknowns** over a leaderboard full of fake greens. If that sounds like your kind of party, read on.

## Before you open a PR

1. `npm install`
2. `npm run test` (128+ tests on the main tree; they bite if something's wrong)
3. `npm run lint`
4. Touched MCP or CLI? Run `npm run build:verify`

## Adding a flagship asset

1. **Research first.** Confirm contract address, chain, and at least one real evidence path (EDGAR CIK/series, attestation URL, or a published reserve wallet you can actually point at).
2. **Edit `lib/seed/assets.ts`.** Add the asset with every field that affects the verdict (`tokenizationMode`, `defillamaPool`, jurisdiction, the works).
3. **Forward every seed field** through `seedIngestOptions`. Silent drops change verdicts with zero errors. That's how BENJI got a false red once. Run `npm run test -- seed-options`.
4. **Registry entries** (human-gated, same vibe as EDGAR):
   - EDGAR: `lib/ingestion/adapters/edgar-registry.ts`
   - Attestation: `lib/ingestion/adapters/attestation-registry.ts`
   - Chainlink PoR: `lib/ingestion/adapters/chainlink-registry.ts`
5. **Run `npm run seed`** against dev Supabase. Hit `/api/verify?asset=SYMBOL` and squint at the result.
6. **Document gaps in the PR.** If backing stays `unverifiable`, say why. "We tried, here's what's missing" beats hand-waving.

## Adding an attestation (Lane C)

1. Confirm the PDF/HTML URL is stable and has numbers you can cite.
2. Add it to `attestation-registry.ts` with issuer metadata.
3. Remember: attestations cap at `verified_backed` + `auto`, never `verified`. Green still needs the arithmetic/citation guards. No shortcuts.

## Code conventions

- **Contracts** in `lib/contracts.ts` are frozen. Add fields; don't repurpose old ones like it's a JSON yard sale.
- **LLM only in ingestion.** Computation in `lib/computation/` is deterministic. No vibes-based scoring.
- **Confidence is per field**, never per asset.
- **Reconciliation only demotes.** It never promotes confidence when sources disagree.
- No `Co-Authored-By` lines in commit messages.

Full invariant list: `CLAUDE.md` / `AGENTS.md`.

## MCP / CLI package

The publishable client lives in `packages/rwa-verify/`. Source of truth is `mcp/server.ts` and `bin/rwa-verify.ts` at the repo root; `tsup` bundles them for npm. Edit those files, then `npm run build:verify` before publishing.

## Questions?

Open a [GitHub issue](https://github.com/Archdiner/rwa-analyzer/issues) or ask in your PR. We're not bitey.
