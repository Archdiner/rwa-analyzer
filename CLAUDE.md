# CLAUDE.md

Guidance for AI assistants working in this repo.

## Git

- No `Co-Authored-By` lines in commit messages.

## Commands

```bash
npm run dev    # dev server (http://localhost:3000)
npm run build  # production build
npm run lint   # eslint
npm run test   # jest
npm run seed   # ingest + store flagship assets
```

## Architecture

Three modules behind two frozen contracts in `lib/contracts.ts`:

1. **Ingestion** (`lib/ingestion/`): source adapters, OpenAI extractor, reconciliation → `NormalizedAssetRecord` (Contract A).
2. **Computation** (`lib/computation/`): deterministic rule modules → `Assessment` (Contract B). No LLM, no composite grade.
3. **App** (`app/`, `components/`): lookup and risk card UI.

See `docs/ARCHITECTURE.md` for the full layout.

### Invariants (tested in `**/__tests__/`)

- Confidence is per FIELD, never per asset.
- A verdict's confidence is capped at the min confidence of its inputs (`finalize` in `lib/computation/util.ts`).
- Every `llm_extracted` field's citation must be a verbatim substring of the source doc, or it drops to `unverifiable` (`lib/ingestion/citations.ts`).
- Reconciliation only demotes confidence on source conflict; it never promotes.
- Yields are `auto` with an as-of stamp, never `verified`. They pass `sanitizeApy` (0–100%). Pool APY (`aggregator` / `defillamaPool`) is labeled separately from stated fund rates (`manual`). See `lib/ingestion/adapters/defillama.ts` and `yieldKind` in `lib/service.ts`.
- The agent contract has no boolean safe flag. `toAgentVerdict` (`lib/agent/verdict.ts`, served by `GET /api/verify`, CLI `bin/rwa-verify.ts`, MCP `mcp/server.ts`) emits THREE axes — `tier` + `confidence` + `freshness` (plus `next_expected_update`) — and non-empty `caveats` unless (`tier === verified_backed` AND `confidence === verified` AND `freshness === live`). A stale/aging verdict always carries a caveat.
- Green backing rests only on arithmetic/string-equality guards: verbatim citation match and supply×NAV reconciliation. `parse_confidence` is a floor only, never a gate. See `lib/contracts.ts`.
- Freshness is the third backing axis (`live`/`aging`/`stale`), measured per-source cadence (`EXPECTED_CADENCE_MS`, or a per-item `cadence_ms`). It only DEMOTES a flag, never promotes: `live` no-op, `aging` notes, `stale` downgrades one notch (to `unknown` past 3× cadence). See `lib/computation/freshness.ts`.
- Auditor attestations (Lane C, `lib/ingestion/adapters/attestation.ts`) are independence 4 and `llm_extracted`, so they can reach `verified_backed` but only at `auto`, NEVER `verified`. A green still requires the supply×NAV arithmetic and the parse floor; the verdict names the attesting firm as the trust boundary, never the SEC. The registry (`attestation-registry.ts`) is human-gated like EDGAR.
- Every verdict-affecting seed field must be forwarded via `seedIngestOptions` (`lib/seed/assets.ts`). A silently dropped field changes the verdict with no error — this caused BENJI's false red when `tokenizationMode` was omitted. Guarded by `seed-options.test.ts`.

### Backing (v1.1)

Backing reads `NormalizedAssetRecord.backing_evidence[]`. Each `EvidenceItem` has independence (ceiling color), extraction (confidence label), and an `as_of` that feeds the freshness axis. On-chain reconstruction cannot exceed a held token's own backing independence. `tokenization_mode` controls reconciliation: `fully_tokenized` uses supply×NAV; `tranche_of_registered_fund` uses regulated structure + NAV integrity.

Evidence sources: `chainlink` (oracle PoR), `onchain-holdings` (reconstruction; registry empty for flagships), `edgar` (SEC N-MFP for registered MMFs), `attestation` (auditor/administrator PDF — Lane C, human-gated registry, capped at `auto`). EDGAR is the only `verified`-green path in the flagship set (BENJI); attestations extend coverage at a visibly lesser tier. The EDGAR registry maps asset → `(cik, seriesId)`; the adapter re-checks `seriesId` before emitting.

Do not reshape contracts casually. Add fields additively; never repurpose. The LLM belongs only in ingestion.
