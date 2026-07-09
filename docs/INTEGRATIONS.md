# Integrations

The engine's verdict is served identically to agents and humans through one pure
function, `toAgentVerdict` (`lib/agent/verdict.ts`), exposed over three surfaces:

| Surface | Entry point |
| --- | --- |
| HTTP | `GET /api/verify?asset_id={chainId}:{address}` |
| CLI | `bin/rwa-verify.ts` (`npm run verify -- {asset_id}`) |
| MCP | `mcp/server.ts` (tool `verify_backing`) |

The contract has **no boolean `safe` flag**. Every read is multi-axis and
un-collapsible: `tier` × `confidence` × `freshness` for backing, plus a generic
`dimensions` map that agents can reason over.

## Dimensions

`AgentVerdict.dimensions` is a map keyed by `DimensionKey`. Each entry carries
`{ flag, confidence, reason, sources }`. `flag` is one of `green | amber | red |
unknown`; `unknown` is a first-class outcome, never an error.

| Key | What it reads | Notes |
| --- | --- | --- |
| `backing` | Reserve evidence vs. supply×NAV | The original green path (EDGAR, attestation, oracle PoR). |
| `redemption` | Exit speed / caps | From issuer docs. |
| `access` | KYC / eligibility gating | On-chain restriction + jurisdiction. |
| `structure` | Legal wrapper / issuer | From issuer docs. |
| `yield_source` | **On-chain yield decomposition (v1.2)** | Organic borrow interest vs. reward emissions; source kind; trust boundary. |
| `market_risk` | **On-chain reserve risk (v1.2)** | Bad debt, utilization, collateralization buffer, caps, reserve state, oracle. |
| `governance` | **On-chain control (v1.3)** | Upgradeability + who controls it (EOA / multisig / timelock). "Who can change or seize this?" |
| `redemption_history` | **Redemption-restriction track record (v1.3)** | Live pause state, N-MFP liquidity-fee history, curated incident registry. "Has getting out ever been blocked?" |

### v1.2: `yield_source` and `market_risk`

Both are computed deterministically from **on-chain reads** (Aave v3 reserves
today; the shape generalizes to other lending markets). They are **additive**:

- **`unknown` for any non-lending asset.** An asset with no on-chain yield/risk
  data (every current RWA flagship) reports `unknown` for both, and because
  `overall_confidence` excludes `unknown` dimensions, existing verdicts do not
  change. The web card renders these two rows **only** when data is present.
- **Green rests only on an on-chain read**, never a safety guarantee. For
  `yield_source`, green means the organic (borrow-interest) rate is a `verified`
  on-chain read and the dominant share of the yield; an aggregator-sourced
  reward figure is `auto` and can never lift a green. For `market_risk`, green
  means no critical signal and no unreadable material signal — a read of the
  reserve's state, **not** a per-borrower solvency proof.
- **Honest `unknown` is preserved.** A signal that cannot be derived (e.g. a
  bad-debt accessor absent on the running contract version, or reward emissions
  that cannot be quantified) is `unknown`, never assumed benign.
- **Off-chain risk is explicitly deferred.** Audit coverage, exploit history,
  and governance/admin-key/upgradeability risk require off-chain sources and are
  surfaced as a scope caveat in `market_risk.reason`, not silently omitted. A
  green `market_risk` is scoped to **on-chain** risk only.
- **Freshness and anti-laundering compose.** A stale on-chain read demotes the
  flag; an unverified underlying caps the flag at its own verification ceiling
  ("you cannot be safer than the asset you lent").

Coverage is gated by a human-verified registry (`aave-registry.ts`), mirroring
the EDGAR/attestation discipline: no reserve is read until its addresses are
confirmed on-chain and recorded with provenance.

### v1.3: `governance` and `redemption_history`

- **`governance` is registry-*optional*.** It reads the asset's own contract
  (EIP-1967 proxy slots + standard proxy selectors) and classifies the upgrade
  authority (EOA / Gnosis Safe m-of-n / `TimelockController`), so it reaches the
  long tail. An optional label registry only enriches `admin_label`. A green
  rests on *positively-detected* safe control (immutable, or upgradeable behind a
  timelock / healthy multisig); a single EOA that can upgrade is red. Crucially,
  **absence of proxy markers is not proof of immutability** — upgradeability then
  reads `unknown`, never a false "immutable" green.
- **`redemption_history` is three honestly-tiered signals, never conflated:**
  a live on-chain pause read (`verified`), the registered-MMF N-MFP liquidity-fee
  flag/events (`verified` structured — regulatory redemption *gates* are
  structurally dead for MMFs post-Oct-2023, so this tracks *fees*), and a curated
  incident registry (`auto` + citation, regime-tagged so a non-traded-REIT
  repurchase cap is never shown as a '40-Act suspension). A green is an **absence
  claim, freshness-scoped** ("no restriction on record as of {date}"), resting
  only on verified reads; curated incidents only ever demote. Off coverage
  (no pause mechanism, filing, or incident) the dimension is `unknown`, never a
  blind green. The web card renders both rows only when determined.
