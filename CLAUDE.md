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

Do not reshape the contracts casually. Add fields additively; never repurpose one. The LLM belongs only in ingestion.
