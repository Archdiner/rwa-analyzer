# Product roadmap

Last updated: 2026-07-08

This document is the honest product plan: who would actually pay attention, whether “verifiable” is the right wedge, what’s wrong with the UI today, and what’s doable vs hard across the five strategic tiers.

---

## 1. Who in crypto would genuinely care (no BS)

### Would use or integrate (realistic)

| Company / category | Why they’d care | What they’d use | Honest likelihood |
|---|---|---|---|
| **Wallet apps with “Earn” tabs** (Rainbow, Rabby-style builders, Safe + earn modules) | They surface yield but don’t want liability for backing claims. A pre-deposit verify hook is cheap due diligence. | `GET /api/verify`, MCP before routing to provider | **Medium** — if integration is 1 API call + caveats in UI |
| **Agent / treasury tooling** (OpenClaw-style agents, DAO treasury bots, custodial automation) | Agents need structured gating, not prose. “Block if `tier === does_not_reconcile`” is actionable. | MCP, CLI, webhooks (future) | **Medium-high** — best fit *today* |
| **RWA issuers / tokenizers** (Ondo, Franklin digital, Securitize-adjacent teams) | They’re tired of “on-chain = verified” narratives. A third-party read that names the trust boundary helps their compliance story. | Public asset page + EDGAR/attestation evidence trail | **Low-medium** — only if you’re neutral and they don’t control the registry |
| **DeFi protocols listing RWA collateral** (Morpho, Maple, Pendle wrappers) | Collateral listing requires “what can we prove about the asset?” not “what’s the APY?” | Verify API + evidence JSON for risk committees | **Medium** — one asset at a time, not portfolio |
| **Crypto-native funds / allocators** (small funds, family offices with crypto desks) | First-pass filter before issuer DD. Saves analyst time on “is there *any* independent backing path?” | Decision explorer + full read | **Low** until coverage > ~20 assets with real evidence |
| **Security / research firms** (Trail of Bits-adjacent, independent researchers) | Reproducible rules + open source = citeable methodology | Fork computation layer, seed registries | **Low volume, high credibility** |

### Probably won’t care (don’t pitch them)

| Category | Why not |
|---|---|
| **Retail yield aggregators** (DeFiLlama, Zapper-style) | They optimize for APY and TVL, not backing epistemology |
| **Most L1/L2 chains** | They want RWA *narrative*, not a tool that says “unknown” for 6/7 flagships |
| **Rating agencies / Big 4** | Wrong regulatory box; you’re not an NRSRO |
| **Exchanges (listing teams)** | They have internal legal + issuer attestations; your unknowns don’t help listings |
| **Generic “AI crypto” startups** | They want chat UX, not deterministic rules |

### Best near-term wedge customer

**Builders who move money programmatically** — wallets with earn, agents, treasury bots, collateral listing committees.

Not “every RWA investor.” Not “the RWA industry.”

---

## 2. Is “what’s verifiable” the right angle?

**Yes — but only if you rename it for humans.**

“Verifiable” is the correct *engineering* wedge. It is not the correct *headline* wedge.

| Audience | Lead with | Not with |
|---|---|---|
| **Retail / allocator** | “Where does the proof stop?” / “What can you actually check before you deposit?” | “Machine-readable backing verification” |
| **Builders / agents** | “Pre-deposit backing check — structured verdict, no boolean safe flag” | “RWA reliability analyzer” |
| **Issuers / researchers** | “Case study: one real green (BENJI) vs honest unknown (OUSG)” | “We rate assets” |

**Positioning sentence (external):**

> Before you deposit into tokenized yield, see what’s independently provable — and where you’re trusting the issuer.

**Positioning sentence (developer):**

> Structured backing verdict (`tier`, `confidence`, `freshness`, `caveats`) for agents and apps — open source, deterministic scoring.

“Verifiable” is the mechanism. **“Where proof stops”** is the value.

---

## 3. UX / UI: what’s wrong today vs dryft.ai DNA

The current UI tried to reject generic AI gloss but replaced it with **generic “terminal cosplay”** — another LLM shortcut.

### What reads as AI-generated / vibe-coded

- `[ VERIFIED ]`, `[ INSPECT ]`, `> We rate assets` — bracket theater, not design
- `SYS.VER: 1.0.0`, `// SYSTEM.READ_EVIDENCE()` — decoration pretending to be depth
- Hard drop shadows on every box — visual noise, not dryft’s restraint
- Monospace everywhere — data should be mono; prose should not
- Orange as “accent on everything” — dryft uses one strong color *sparingly*
- Visible CSS grid on the whole page — blueprint *motif*, not blueprint *craft*
- Legend box at the bottom — docs content masquerading as UI

### What dryft actually does (steal this, not the tokens)

1. **One strong typographic voice** — large, calm sans headline; mono only for labels/data
2. **Restraint** — lots of whitespace, thin rules, almost no shadows
3. **Schematic as illustration** — line art / diagram carries the “breaking things down” idea; UI stays quiet
4. **Plain English first** — technical detail is progressive disclosure, not the hero
5. **Single CTA hierarchy** — one primary action per screen

### Is the current information architecture right?

**Partially.**

| Keep | Change |
|---|---|
| Jurisdiction + amount → filtered list | Lead with **one question**: “What can I reach, and how far does proof go?” |
| Safety before yield ranking | Show **one comparison row** (BENJI vs OUSG) above the fold as the thesis |
| Asset detail as dimension breakdown | Collapse dimensions; **lead with backing + trust boundary**; tuck access/redemption under “Can I use it?” |
| Raw evidence | Expose as **“Source log”** expandable — clean table, not fake terminal |
| Search by address | Secondary; primary path is **decision explorer** for humans, **verify API** for machines |

### Target UI direction (orange blueprint, dryft craft)

- **Paper background**, no full-page grid — grid only inside schematic hero art (SVG)
- **Orange** for: logo mark, primary CTA, active states, verified backing indicator — not every badge
- **Typography**: Geist Sans for UI copy; Geist Mono for tickers, addresses, yields, timestamps
- **Components**: 1px borders, 0–2px radius max, no chunky shadows
- **Hero**: schematic pipeline diagram (Contract → EDGAR / chain → verdict) + 2 sentences of plain English
- **Asset rows**: ledger lines, not cards-with-shadows

---

## 4. Strategic tiers — hard vs doable

### Tier 1 — Engine as product (API / MCP / docs)

| Item | Doable? | Effort | Notes |
|---|---|---|---|
| Methodology page (BENJI vs OUSG case study) | **Easy** | 1–2 days | Highest leverage marketing asset |
| MCP + verify API docs with copy-paste examples | **Easy** | 1 day | Already built; needs docs |
| 3 integration snippets (JS guard, MCP config, curl) | **Easy** | 1 day | |
| npm package wrapper around verify | **Medium** | 3–5 days | Nice-to-have |
| SLA / hosted API keys / billing | **Hard** | Weeks | Not needed until someone asks |

**Verdict:** Do all of Tier 1 in the first 2 weeks. Low cost, defines category.

---

### Tier 2 — Expand coverage where proof is possible

| Item | Doable? | Effort | Notes |
|---|---|---|---|
| Fix seed script parity (`tokenizationMode`, `defillamaPool`) | **Done** | — | Critical integrity |
| OUSG attestation registry + PDF parse | **Medium** | 1–2 weeks | Human-gated URL; capped at `auto` |
| 2–3 more EDGAR registered-fund tranches | **Medium** | Per asset | CIK/series mapping is manual |
| On-chain holdings for 1 asset with published wallet | **Hard** | Per asset | Registry + attribution research |
| 50 assets via LLM + web search | **Easy but wrong** | — | Inflates count, not proof |

**Verdict:** Add **quality assets**, not asset count. Target +5 assets with a real evidence path in 90 days, not +50 unknowns.

---

### Tier 3 — Recurring use (alerts, watchlist, diffs)

| Item | Doable? | Effort | Notes |
|---|---|---|---|
| Cron diff: log when backing tier / freshness changes | **Medium** | 1 week | Store previous assessment hash |
| Email/webhook on change | **Medium** | 1 week | Needs auth + subscriber model |
| User watchlists | **Medium** | 2 weeks | Needs accounts or anonymous tokens |
| Historical charts | **Hard** | Weeks | Out of scope; storage + UX |

**Verdict:** Ship **server-side diff + RSS/JSON feed** before user accounts. Agents can poll; humans subscribe in Feedly.

---

### Tier 4 — Community loop

| Item | Doable? | Effort | Notes |
|---|---|---|---|
| CONTRIBUTING.md (add asset checklist) | **Easy** | 1 day | |
| Public “request an asset” GitHub template | **Easy** | Hours | |
| Verdict changelog per asset (git or DB) | **Medium** | 1 week | |
| Bounty program | **Hard** | Ongoing | Needs funding + review capacity |
| Decentralized registry | **Hard** | Wrong stage | |

**Verdict:** Docs + templates first; bounties only when maintainers can review PRs in <48h.

---

### Tier 5 — Decision UI as the human product

| Item | Doable? | Effort | Notes |
|---|---|---|---|
| Redesign hero + ledger (dryft craft) | **Medium** | 1–2 weeks | Design before code |
| BENJI vs OUSG comparison module | **Easy** | 2–3 days | Teaching moment |
| “Why closed to you” inline on closed rows | **Easy** | 1 day | |
| Portfolio / compare side-by-side | **Medium** | 2 weeks | |
| Mobile polish | **Medium** | 1 week | |

**Verdict:** UI redesign is **not** Tier 5 priority order — it should be **Phase 0** if we want humans to trust the thesis.

---

## 5. Concrete roadmap (90 days)

### Phase 0 — Design DNA reset (weeks 1–2)

**Goal:** Look like a tool built by someone who cares, not a prompt.

- [x] Design brief: orange blueprint, dryft restraint — codified in `app/globals.css` (warm paper, hairline panels, one considered orange, mono only for data/labels)
- [x] Strip terminal cosplay: removed brackets, fake `SYS.VER`/`INSPECTION_REPORT` labels, and the full-page grid (grid now contained to the hero schematic only)
- [x] New hero: plain-English headline (“See where the proof stops before you deposit.”) + schematic (inputs → reconcile → verdict)
- [x] Ledger rows for asset list (`OptionRow`); mono confined to data columns (ticker, yield, timestamps)
- [x] Asset page: backing + trust boundary lead; access/redemption/structure grouped under “Can you use it?”; “Show sources” is a clean record log, not a fake terminal
- [x] Fixed placeholder GitHub URL → real repo via `lib/site.ts` (`Archdiner/rwa-analyzer`)

**Exit criteria:** A designer-friend wouldn’t call it “AI slop.” BENJI/OUSG story visible without scrolling on desktop.

> **Status (2026-07-08):** Phase 0 shipped. Full-surface redesign — layout, hero + live BENJI/OUSG thesis, decision explorer, ledger rows, search, and the asset RiskCard/source log — rebuilt on a restrained design system. Build green; verified in-browser on home + asset pages.

> **Status (2026-07-08, visual DNA pass):** Second design pass to shed the "harsh terminal cosplay" read. Introduced a three-voice type system (Fraunces serif display for headlines, Geist sans for prose, mono for data only), warmer near-black + softer borders/rounding, and a hand-drawn blueprint line-art library (`components/marketing/Blueprints.tsx`: circuit traces, node-flow, concentric vault, emission steps, converging radial graph). Added a "one engine for wherever yield comes from" identity section (`YieldSourceGrid`) that surfaces the yield-source-category expansion (RWA backing → lending → staking → emissions) with honest Live/Researching/Planned status. Rebuilt the decision explorer selectors ("Where are you" / "How much") as calm pill segmented controls and the routes list as spacious verdict rows. Removed all em dashes from the UI surface.

---

### Phase 1 — Infrastructure wedge (weeks 2–4)

**Goal:** First integrator can go live in an afternoon.

- [ ] `docs/METHODOLOGY.md` — BENJI green path, OUSG unknown path, anti-fake-green rules
- [ ] `docs/INTEGRATIONS.md` — MCP, verify API, example agent guard
- [ ] OpenAPI or typed schema export for `AgentVerdict`
- [ ] README reposition: developer headline + human subhead
- [ ] Confirm Vercel env: Supabase + RPC on production; re-seed with fixed script

**Exit criteria:** One external builder can call verify and explain what came back without asking you.

---

### Phase 2 — Coverage with proof (weeks 4–8)

**Goal:** Universe grows; unknown ratio doesn’t.

- [ ] OUSG attestation lane (registry entry + parse + `auto` tier)
- [ ] 2 additional EDGAR or attestation assets (research-driven, not scraped)
- [ ] Improve OUSG backing copy: “NAV unavailable” not “supply unavailable”
- [ ] `docs/ASSETS.md` — per-flagship evidence map and known gaps

**Exit criteria:** ≥3 assets with non-unknown backing *or* explicit attestation path documented.

---

### Phase 3 — Recurring signal (weeks 8–10)

**Goal:** Reason to come back without accounts.

- [ ] Assessment diff in cron refresh (store `previous_tier`, `previous_freshness`)
- [ ] Public `GET /api/changelog` or RSS for tier/freshness changes
- [ ] Staleness visible on card: “EDGAR filing aging — next N-MFP ~date”

**Exit criteria:** BENJI filing age triggers visible stale/aging state; feed emits entry.

---

### Phase 4 — Community (weeks 10–12)

**Goal:** Others can extend the registry safely.

- [ ] `CONTRIBUTING.md` — add asset / EDGAR / attestation registry
- [ ] GitHub issue template: “Request asset verification”
- [ ] CI check: seed options parity test (already exists — document it)

**Exit criteria:** One contributor could PR a new attestation registry entry from docs alone.

---

## 6. Metrics that matter (not vanity)

| Metric | Why |
|---|---|
| **Verify API calls / week** | Integrator traction |
| **MCP tool invocations** | Agent adoption |
| **Assets with independent backing evidence** | Quality coverage |
| **% universe that is honest unknown** | Should drop as registries fill, not by faking green |
| **Time-to-verdict on cold lookup** | UX for builders |
| **GitHub forks / PRs to registries** | Community loop |

Ignore: total pageviews, total assets listed, “average APY displayed.”

---

## 7. What we explicitly will not do (v1–v2)

- Boolean “safe to invest” score
- Custody, routing, or deposit execution
- Paid rwa.xyz dependency
- Scraping issuer sites as “verification”
- 100-asset leaderboard without evidence paths
- Dark-mode-glow-crypto aesthetic (# rejected)

---

## 8. Decision log

| Date | Decision |
|---|---|
| 2026-07-08 | Primary GTM: **agent/builder pre-deposit check**, not retail yield aggregator |
| 2026-07-08 | Headline wedge: **“where proof stops”**, not “verifiable backing” |
| 2026-07-08 | UI: **dryft restraint + orange blueprint schematic**, not terminal cosplay |
| 2026-07-08 | Coverage strategy: **quality registries**, not asset count |

---

## 9. Immediate next actions (this week)

1. **Phase 0 design pass** — schematic hero SVG + component kit (border, type scale, orange usage rules)
2. **Write `docs/METHODOLOGY.md`** — ship the BENJI/OUSG teaching page
3. **Rewrite landing copy** — remove terminal tropes; lead with “where proof stops”
4. **Fix production seed** — ensure `tokenizationMode` on all flagships in prod DB
5. **Real GitHub URL** in layout/footer/hero

---

## Appendix: one-liner pitches by audience

| Audience | Pitch |
|---|---|
| Wallet engineer | “One API call before you show an Earn tile — structured backing verdict with caveats.” |
| Agent author | “MCP tool that returns `tier` + `caveats` so your agent can refuse bad RWAs.” |
| Retail user | “See what you can actually access — and how far anyone can prove the backing.” |
| Issuer | “Neutral third-party read that separates on-chain presence from reserve proof.” |
| Contributor | “Open registries + deterministic rules — add evidence paths, not opinions.” |

---

## Expansion — from backing to yield-source provenance

The real thesis isn't "RWA backing verifier." That's the first, hardest instance (the proof is an SEC filing the issuer can't edit). The general case: for ANY yield, decompose what's independently provable from what you're trusting, and name where proof stops. Same three-axis engine, bigger surface.

Coverage is by yield-source **category, not by token**: one lending adapter covers every Aave/Morpho market; one staking adapter covers every LST. ~8-10 categories, finite. Never a per-token leaderboard. And the on-chain-native sources are *easier* to verify than the RWA we started with (the data is fully on-chain) — we built the hardest case first.

| Source | Proof lives | Difficulty | Verify |
|---|---|---|---|
| Lending (Aave/Morpho) | on-chain | easy-med | utilization → organic APY, bad debt |
| Staking / LSTs | on-chain | easy | pooled ETH vs token supply |
| Restaking / LRTs | partly opaque | hard | AVS / slashing exposure |
| AMM fees | on-chain | med | realized fees; IL is forward risk |
| Perp funding | on-chain | med | funding history, vault PnL |
| Delta-neutral (USDe) | partly off-chain | hard | position / custody attestation |
| Emissions / points | on-chain schedule | easy | % emissions + end date |
| Pendle PT/YT | wrapper | med | recurse into underlying |

Two novel capabilities fall out: (1) a **composability / rehypothecation graph** ("your 12% is 3% T-bill + 9% recursive leverage") extending the anti-laundering ceiling; (2) **organic-vs-emissions decomposition**. Discipline: depth before breadth; `unknown` stays a valid answer.

**Adopter framing:** this is a free, open-source primitive. Read "who would use it" as *adopters* (agents, risk teams, wallet builders, researchers), never *customers*. No billing, no GTM — capability, not monetization.
