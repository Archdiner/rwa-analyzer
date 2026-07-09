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

Lane C is the coverage lane for assets with no SEC filing: most tokenized treasuries and private credit, where the only real proof is a CPA or administrator PDF. It's deliberately the weakest green-capable lane, and that's the point: it extends coverage without pretending an auditor is a regulator.

1. **The URL has to actually contain a number you can quote.** A JS-rendered dashboard with no citable reserve figure (hi, OUSG) is not an attestation the engine can use. The citation guard needs a verbatim string to check; no string, no green, honest `unknown`. Confirm the PDF/HTML is stable and has real figures before you touch the registry.
2. **Add it to `attestation-registry.ts`** with issuer metadata and a `verified_at` date. This map mints greens, so a wrong URL could fetch the wrong document and manufacture a false one, exactly the failure this project exists to prevent. Only add a row after a human eyeballs the URL against the issuer's official transparency page.
3. **Know the ceiling.** Attestations cap at `verified_backed` + `auto`, never `verified` (independence 4, not 5). And a green *still* has to clear supply × NAV. We don't trust the CPA blindly; we make their number reconcile against the on-chain float. No shortcuts, no exceptions, no "but this auditor is really reputable."

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
