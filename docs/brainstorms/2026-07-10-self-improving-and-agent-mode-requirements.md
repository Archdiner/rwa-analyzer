# Requirements — Self-Improving Feature Pipeline + Agent-Readable Site

**Date:** 2026-07-10
**Status:** Draft for review
**Scope tier:** Deep (product) — establishes a new capability surface, not just a feature
**Related research:** GitHub "safe outputs" architecture, Copilot coding-agent & Claude-Code-Action gating, Metabase Repro-Bot (triage-only), Dependabot/Renovate (narrow-whitelist), Sakana DGM + Karpathy `autoresearch` (narrow-loop self-improvement), April-2026 GitHub agent-PR crisis (~90% noise, 5 outages, kill switch), Unwrap.ai (semantic feedback clustering), llms.txt low-ROI studies, Vercel/Cloudflare content-negotiation.

---

## 1. Problem & North Star

**North star:** *self-improving software* — the product should be able to take a user's desire, evaluate it like a good engineer, and — for bounded, safe change types — build and propose the change itself, with the maintainer as the merge boundary.

**Problem today:** There is no channel for users (human or agent) to request functionality, no way to see what's in demand, and no leverage that turns demand into shipped change. Separately, the site already exposes a strong agent surface (three-axis `AgentVerdict` via `/api/verify`, an MCP server, a CLI) but agents can't *discover* it and pages aren't served in an agent-friendly shape.

Two threads, one theme: **make the product legible and responsive to the agents and users who want to use and improve it.**

## 2. Users / Actors

- **Requester** — a human or agent who wants functionality (e.g., "verify asset X", "add a redemption-latency dimension"). Submits via a form or an agent-facing endpoint.
- **Maintainer (you)** — the sole trust boundary. Reviews triaged/clustered demand, and merges (or rejects) every PR. Never bypassed.
- **The pipeline agent** — evaluates, clusters, and (for whitelisted change types) builds. Runs with *read-only* authority; never holds a write-capable token.
- **Consuming agent** — an external LLM/agent that reads the site to route a deposit or answer a question. Beneficiary of the agent-readable work.

## 3. Scope — Phased (v1 → full loop)

Decision: **phase it, still reach the full loop.** Each phase is independently shippable and independently valuable. Trust is *earned* between phases, mirroring how every credible system reaches autonomy.

### Phase 0 — Agent-Readable Surface ("agent mode")
Cheapest, safest, no untrusted-input risk. Ships first and makes the later pipeline easier to expose.
- Content negotiation: serve JSON/markdown when an agent sends `Accept: application/json` / `text/markdown` on key pages (asset verdict pages, docs); HTML otherwise. **Header-based, invisible to humans — no clickable "agent mode" toggle** (research: agents fetch, they don't click; a UI toggle is human-facing theater).
- `.well-known/mcp/server-card` (per SEP-2127 direction) advertising the existing MCP server so registries/clients can discover it.
- `robots.txt` explicitly allowlisting `GPTBot`, `ClaudeBot`, `PerplexityBot`, `Google-Extended`; not disallowing `/api/verify` or `/llms.txt`.
- JSON-LD on asset/verdict pages (`dateModified` = the verdict `as_of`, canonical, title/description).
- Minimal `/llms.txt` (curated index only; **no `llms-full.txt`**). Low expected crawler consumption — justified as a dev-tool/IDE-agent affordance, not an SEO play.

### Phase 1 — Feature-Request Intake + Triage (no auto-PR yet)
The Metabase Repro-Bot pattern: agent classifies and stops; a human promotes.
- Public submission form; **GitHub-OAuth-gated** (assumption — see §7) to kill anonymous spam/cost-DoS and give a stable identity for dedup.
- Submission is persisted (new Supabase table), then an agent triages it: category, affected module (ingestion / computation / app), a merit evaluation ("is this good, does it fit the frozen contracts, is it worth doing"), an architecture-fit check against `lib/contracts.ts` invariants, and a duplicate check.
- Output is a **structured record + optionally a GitHub issue** — never a code change. Rate-limited and credit-capped so a spike can't run up the bill.

### Phase 2 — Demand Consolidation
- Semantic clustering of requests (Unwrap.ai-style: group by meaning, not keywords) so recurring desire is visible as a theme, with a count.
- A public/maintainer-facing view of clustered demand ("what people want, ranked"). This is the "consolidate patterns, and if enough interest is demonstrated…" layer.
- **Demand is a signal to the maintainer, not an automatic build trigger** (research: threshold-triggered building is gameable and ignores maintenance cost; popularity ≠ good engineering). Crossing a threshold *surfaces and scopes*, the maintainer (or Phase 3) decides.

### Phase 3 — Whitelisted Autonomous Build → PR
The "all the way" tier, bounded like Dependabot/Renovate.
- **First and only initial whitelist: "add a tokenized asset"** — append a schema-validated entry to the seed/registry (`lib/seed/assets.ts` or a human-gated registry), CI-gated. Single-file, bounded blast radius, on-brand with the existing EDGAR/attestation registries.
- The agent proposes the change through a **deterministic "safe outputs" gate** (see §4). It builds against a branch; it does not merge.
- Every PR is maintainer-reviewed and maintainer-merged. New whitelist entries are added one at a time, only after the prior one is proven.

## 4. Key Architectural Decision — the Safe-Outputs Gate (non-negotiable)

This is the load-bearing safety property and is in-scope for the brainstorm because it is *the* design that makes an untrusted-input→code loop survivable. From GitHub's own agentic-workflow security architecture:

- The LLM-holding process gets **read-only** authority. It never holds a write-capable `GITHUB_TOKEN`.
- All proposed writes (open PR, comment, label) are **buffered** and pass through a separate **deterministic** analyzer before becoming real mutations: secret-strip, diff-shape validation (is the change confined to the whitelisted file(s) and schema?), volume caps (max N PRs/run), moderation.
- This mirrors the repo's existing discipline: *the LLM belongs only in ingestion; green backing rests only on arithmetic guards, never on model confidence.* The gate is the same principle applied to code output.

Untrusted request text is treated as data, never as instructions to the build agent. Prompt injection is assumed, not hoped against.

## 5. Success Criteria

- **Phase 0:** an agent hitting `/api/verify` or an asset page with a JSON/markdown `Accept` header gets structured data; the MCP server is discoverable via `.well-known`; robots/JSON-LD/llms.txt present and valid. Verified by request tests + a manual agent fetch.
- **Phase 1:** a submitted request produces a correctly-classified, merit-evaluated, dedup-checked structured record within rate/credit caps; spam/injection attempts do not escalate to any write action. Verified by tests incl. adversarial (injection) fixtures.
- **Phase 2:** near-duplicate requests cluster into one theme with an accurate count; the maintainer can see ranked demand.
- **Phase 3:** a valid "add asset X" request yields a CI-passing PR that touches *only* the whitelisted file in the expected schema; an out-of-bounds attempt is rejected by the gate, not by the model. The maintainer merges with a normal review. Zero cases where the build agent held write authority.

## 6. Scope Boundaries

**Deferred (later phases / later whitelists):**
- Auto-build for anything beyond "add a tokenized asset" (adapters, dimensions, UI) — added one whitelist at a time.
- Automatic demand-threshold → build triggers (kept as maintainer-surfaced signal in v1).
- `llms-full.txt`, richer structured-data vocabularies beyond the verdict entity.

**Outside this product's identity (won't build):**
- A human-facing "agent mode" UI toggle — rejected as theater.
- Letting the agent merge, or hold a write-capable token — violates the trust boundary permanently, not just in v1.
- A general "build any feature the crowd upvotes" machine — popularity is not the merge gate; engineering merit + maintainer judgment is.

## 7. Assumptions & Open Decisions (confirm at review)

- **[ASSUMPTION] Form access = GitHub OAuth.** The Form-access question was left unanswered; adopting the recommended option because dedup and demand-counting require a stable identity and it's consistent with the other two choices. Override if you want email+captcha or anonymous.
- **[ASSUMPTION] Pipeline agent runs GitHub-native** (GitHub Actions via Copilot coding agent / `anthropics/claude-code-action`) rather than a custom in-app endpoint — this gives the safe-outputs sandbox, firewall, and credit caps for free. To be confirmed in planning (§HOW).
- **[ASSUMPTION] Storage = the existing Supabase instance** (new `feature_requests` + clustering tables), consistent with current `assets`/`assessments` tables.
- Demand-clustering approach (hosted embedding vs. self-hosted) is a planning-time technical decision.

## 8. Dependencies

- Existing agent surface: `lib/agent/verdict.ts`, `app/api/verify/route.ts`, `mcp/server.ts`, `bin/rwa-verify.ts`.
- Existing storage: Supabase (`lib/supabase.ts`, `supabase/schema.sql`).
- Existing human-gated registry precedent: `lib/ingestion/adapters/edgar-registry.ts`, `attestation-registry.ts`.
- CI: `.github/workflows/ci.yml` (lint/test/build) — the CI gate the whitelisted PR must pass.
- Frozen contracts: `lib/contracts.ts` — additions are additive; the merit-evaluation step checks proposals against these invariants.
