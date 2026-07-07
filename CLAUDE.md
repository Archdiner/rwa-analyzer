# CLAUDE.md

Guidance for AI assistants working in this repo.

## Git

- No `Co-Authored-By` lines in commit messages. Never add them.

## Commands

```bash
npm run dev    # dev server (http://localhost:3000)
npm run build  # production build
npm run lint   # eslint
npm run test   # jest
npm run seed   # ingest + store flagship assets
```

## Architecture

Three modules behind two FROZEN contracts in `lib/contracts.ts`:

1. **Ingestion** (`lib/ingestion/`) — source adapters + OpenAI extractor + reconciliation → `NormalizedAssetRecord` (Contract A).
2. **Computation** (`lib/computation/`) — deterministic rule modules → `Assessment` (Contract B). No LLM, no composite grade.
3. **App** (`app/`, `components/`) — lookup + risk card.

### Non-negotiable invariants (tested in `**/__tests__/`)

- Confidence is per FIELD, never per asset.
- A verdict's confidence is capped at the min confidence of its inputs (`finalize` in `lib/computation/util.ts`).
- Every `llm_extracted` field's citation must be a verbatim substring of the source doc, or it drops to `unverifiable` (`lib/ingestion/citations.ts`).
- Reconciliation only ever DEMOTES confidence on source conflict, never promotes.
- **A yield is held to the same bar as everything else.** It is `auto` with an as-of stamp, never `verified`; it passes a sanity band (`sanitizeApy`, 0–100%) so a glitched feed can't print "1,400%"; and its KIND is part of the number — a live DeFi pool APY (`aggregator` source, curated `defillamaPool` id) is labeled distinctly from a fund's stated rate (seeded, `manual`). See `lib/ingestion/adapters/defillama.ts` and `yieldKind` in `lib/service.ts`.
- **Green rests only on guards the model cannot argue with.** A green backing verdict may rest only on arithmetic/string-equality checks — the verbatim-substring citation match and the supply×NAV reconciliation. `parse_confidence` (the model grading its own homework) is a FLOOR (a low score can block a green) but NEVER a GATE (a high score can never earn one). Do not promote `parse_confidence` to a gate. See the principle block in `lib/contracts.ts`.

### Backing is two-axis (v1.1)

Backing reads `NormalizedAssetRecord.backing_evidence[]`, not a single reserves field. Each `EvidenceItem` carries an INDEPENDENCE (who wrote it → ceiling color) and an EXTRACTION method (how we read it → confidence label). On-chain reconstruction of a held token cannot exceed that token's own backing independence (anti-laundering ceiling). `tokenization_mode` decides how reserves reconcile: `fully_tokenized` reconciles against supply×NAV; `tranche_of_registered_fund` gets green via regulated structure + NAV integrity, not total-pool matching.

Evidence sources today: `chainlink` (oracle PoR, none for flagships), `onchain-holdings` (reconstruction; registry empty because no flagship publishes an attributable reserve wallet — see `reserves-registry.ts`), and `edgar` (SEC N-MFP for registered '40-Act MMFs). EDGAR is the only realized green path in the flagship set — it produces BENJI's green. Its scope is narrow (registered funds only; useless for 3(c)(7)/non-US notes) and its registry maps asset → `(cik, seriesId)`; the adapter re-checks the fetched filing's `seriesId` before emitting, so it can never attribute another fund's filing.

Do not reshape the contracts casually. Add fields additively; never repurpose one. The LLM belongs only in ingestion.
