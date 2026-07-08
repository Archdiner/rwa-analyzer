# Integrations

Wire the backing verifier into an agent, a wallet, or a script in a few minutes. Every surface speaks one contract — the `AgentVerdict` — so the CLI, the MCP tool, and the HTTP API can never disagree.

The golden rule for every integration: **do not reduce the verdict to a boolean.** Read `tier` + `confidence` + `freshness` together and surface `caveats`. There is deliberately no `safe` field.

---

## HTTP API

```
GET /api/verify?asset={symbol | chainId:address}
GET /api/universe        # list known assets + current tier/confidence
GET /api/schema          # JSON Schema for the AgentVerdict response
```

Response is wrapped as `{ "success": true, "data": <AgentVerdict> }`. Rate limited per IP.

```bash
curl "$BASE/api/verify?asset=BENJI"
```

```jsonc
{
  "success": true,
  "data": {
    "asset": { "asset_id": "1:0x3ddc...", "symbol": "BENJI", "name": "...", "issuer_name": "Franklin Templeton" },
    "backing": {
      "tier": "verified_backed",          // independence axis
      "confidence": "verified",           // extraction axis
      "freshness": "live",                // age-vs-cadence axis (null if nothing to age)
      "next_expected_update": "2026-08-04T00:00:00.000Z",
      "reason": "Regulated 1940-Act fund: ...",
      "meaning": "Backing is independently verified via regulator filing: ...",
      "trust_boundary": "Confirms a redeemable share of a regulator-verified fund. ...",
      "caveats": []                       // non-empty unless verified_backed + verified + live
    },
    "dimensions": { "backing": {"flag":"green","confidence":"verified",...}, "redemption": {...}, "access": {...}, "structure": {...} },
    "evidence": [ { "source_type":"regulator_filing","independence":5,"extraction":"structured","confidence":"verified","freshness":"live","citation":null, ... } ],
    "provider_url": "https://digitalassets.franklintempleton.com/",
    "as_of": "...",
    "disclaimer": "Verifiability read of asset BACKING only. Not investment advice..."
  }
}
```

The full response shape is published as a JSON Schema at `GET /api/schema` (draft-07). Validate against it or codegen types from it; a test keeps it in sync with what the engine actually emits.

### The two/three axes (do not collapse)

- **`tier`** — did the claim reconcile? `verified_backed | partially_verified | does_not_reconcile | unverifiable`.
- **`confidence`** — how was the number read? `verified | auto | unverifiable`.
- **`freshness`** — how current is the evidence for its source? `live | aging | stale | null`.

`verified_backed` is not a safety guarantee. `unverifiable` is not a danger flag — it means the evidence to confirm or deny does not exist or is not machine-readable. See `docs/METHODOLOGY.md`.

---

## Agent guard (JavaScript)

A pre-deposit check an agent can run before routing capital. It refuses on a failed reconciliation and forces the caveat into the reasoning path — it never branches on a boolean.

```js
async function checkBacking(asset, base = process.env.RWA_API_BASE) {
  const res = await fetch(`${base}/api/verify?asset=${encodeURIComponent(asset)}`);
  const { data } = await res.json();
  const { tier, confidence, freshness, caveats, meaning } = data.backing;

  // Hard stop: the backing claim actively fails to reconcile.
  if (tier === "does_not_reconcile") {
    return { allow: false, reason: `Backing does not reconcile. ${meaning}` };
  }
  // Proceed, but the caveats MUST travel with the decision.
  return {
    allow: true,
    tier, confidence, freshness,
    caveats,                       // surface these to the user / log them
    reverify_after: data.backing.next_expected_update,
  };
}
```

Policy is the caller's: some agents allow only `verified_backed`; others allow `unverifiable` for a small position but never `does_not_reconcile`. The tool gives you the honest read; you set the threshold.

---

## MCP (agents)

A stdio server exposing two tools: `check_asset_backing` and `list_verified_assets`. Register it with any MCP client (Claude, Cursor, etc.):

```jsonc
{
  "mcpServers": {
    "rwa-backing-verifier": {
      "command": "npx",
      "args": ["tsx", "mcp/server.ts"],
      "cwd": "/absolute/path/to/rwa-analyzer",
      "env": { "RWA_API_BASE": "https://<your-deployment>" }
    }
  }
}
```

The MCP tool returns both a human-readable summary (caveat first) and `structuredContent` (the full `AgentVerdict`) so the agent can reason over the axes directly.

---

## CLI

```bash
RWA_API_BASE=https://<your-deployment> npm run verify -- benji
```

Prints the tier, confidence, freshness (with next update), meaning, trust boundary, caveats, and the evidence trail. The tier is printed, never encoded in the exit code — a caller reads the verdict, it doesn't branch on `0/1`.

---

## Notes

- **Discovery:** `GET /api/universe` lists what can be checked by ticker; any asset can also be checked by `{chainId}:{address}`.
- **Rate limits:** `/api/verify` is rate limited per IP; back off on `429`.
- **Cold lookups:** an unseeded asset resolves on demand (on-chain + optional LLM extraction) and may fill qualitative fields on a later call (`freshness`/`caveats` reflect this).
- **What it is not:** a verifiability read of asset backing only — not investment advice, not a safety or solvency guarantee, not a read on the app/wrapper used to access the asset.
