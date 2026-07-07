#!/usr/bin/env tsx
// ---------------------------------------------------------------------------
// RWA backing-verification MCP server — the primary artifact
// ---------------------------------------------------------------------------
// Exposes the honest backing-verifiability engine as tools an agent can call
// BEFORE it commits money to a tokenized real-world asset. It is a thin client
// of /api/verify and /api/universe (set RWA_API_BASE; defaults to the deployed
// API), so it needs no secrets and always speaks the same contract as the site.
//
// Scope is deliberately tight: "is this asset's backing real?" — one capability,
// not an agent trust/reputation protocol. The response is engineered so the
// caveat is load-bearing: no boolean, two axes (tier + confidence), and the tool
// TEXT leads with `meaning`, `trust_boundary`, and `caveats` so an agent cannot
// collapse a nuanced verdict into safe/unsafe.
// ---------------------------------------------------------------------------

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import type { AgentVerdict } from "@/lib/agent/verdict";

const BASE = process.env.RWA_API_BASE || "https://rwa-analyzer.vercel.app";

async function apiGet<T>(path: string): Promise<T> {
    const res = await fetch(`${BASE}${path}`, { headers: { accept: "application/json" } });
    const json = (await res.json()) as { success?: boolean; data?: T; error?: string };
    if (!res.ok || json.success === false) throw new Error(json.error || `HTTP ${res.status}`);
    return json.data as T;
}

/** Human/agent-readable summary that puts the caveat FIRST, not the tier. */
function renderVerdict(v: AgentVerdict): string {
    const b = v.backing;
    const lines = [
        `${v.asset.symbol} (${v.asset.name}) — backing verdict`,
        ``,
        `tier: ${b.tier}   |   confidence: ${b.confidence}`,
        `MEANING: ${b.meaning}`,
    ];
    if (b.trust_boundary) lines.push(`TRUST BOUNDARY: ${b.trust_boundary}`);
    if (b.caveats.length) {
        lines.push(`CAVEATS (do not ignore):`);
        for (const c of b.caveats) lines.push(`  - ${c}`);
    }
    if (v.evidence.length) {
        lines.push(`EVIDENCE:`);
        for (const e of v.evidence) {
            lines.push(
                `  - ${e.source_label}: independence ${e.independence}/5 (${e.independence_label}), ` +
                    `${e.extraction}, ${e.confidence}, as of ${e.as_of.slice(0, 10)}`,
            );
        }
    }
    lines.push(``, v.disclaimer);
    return lines.join("\n");
}

const server = new McpServer({ name: "rwa-backing-verifier", version: "1.0.0" });

server.registerTool(
    "check_asset_backing",
    {
        title: "Check RWA backing verifiability",
        description:
            "Returns an HONEST, machine-readable backing-verifiability read for a tokenized real-world " +
            "asset (money-market funds, tokenized treasuries, yield-bearing stablecoins). Call this before " +
            "committing funds to such an asset. Input is a ticker (e.g. OUSG, BENJI, sDAI) or a canonical " +
            "'{chainId}:{address}'.\n\n" +
            "The result has TWO axes you must read together: `tier` (verified_backed | partially_verified | " +
            "does_not_reconcile | unverifiable — did the backing claim reconcile against an independent source) " +
            "and `confidence` (verified | auto | unverifiable — how the figure was obtained). There is NO " +
            "safe/unsafe boolean, by design. `verified_backed` means the backing reconciled against a named " +
            "independent source; it is NOT a safety guarantee and verifies nothing beyond the stated " +
            "`trust_boundary`. `unverifiable` means evidence to confirm or deny backing does not exist — it is " +
            "NOT a judgment of safety, and absence of a red flag is not a green light. ALWAYS surface `meaning`, " +
            "`trust_boundary`, and `caveats` to the user; never reduce this verdict to a boolean.",
        inputSchema: {
            asset: z
                .string()
                .describe("Asset ticker (OUSG, BENJI, USDY, USYC, BUIDL, sDAI, syrupUSDC) or '{chainId}:{address}'."),
        },
    },
    async ({ asset }) => {
        try {
            const verdict = await apiGet<AgentVerdict>(`/api/verify?asset=${encodeURIComponent(asset)}`);
            return {
                content: [{ type: "text", text: renderVerdict(verdict) }],
                structuredContent: verdict as unknown as Record<string, unknown>,
            };
        } catch (err) {
            return {
                isError: true,
                content: [{ type: "text", text: `Verification failed for "${asset}": ${(err as Error).message}` }],
            };
        }
    },
);

server.registerTool(
    "list_verified_assets",
    {
        title: "List assets the verifier knows",
        description:
            "Lists the tokenized real-world assets this verifier can check by ticker, with each one's current " +
            "backing tier and confidence. Use it to discover what `check_asset_backing` can be called on. Any " +
            "asset can also be checked directly by '{chainId}:{address}'.",
        inputSchema: {},
    },
    async () => {
        try {
            const { universe } = await apiGet<{
                universe: {
                    symbol: string;
                    name: string;
                    backing_flag: string;
                    backing_confidence: string;
                    jurisdiction: string | null;
                }[];
            }>("/api/universe");
            const text = universe
                .map(
                    (a) =>
                        `${a.symbol} — ${a.name}: backing ${a.backing_flag}/${a.backing_confidence}` +
                        (a.jurisdiction ? ` (${a.jurisdiction})` : ""),
                )
                .join("\n");
            return {
                content: [{ type: "text", text }],
                structuredContent: { universe } as Record<string, unknown>,
            };
        } catch (err) {
            return {
                isError: true,
                content: [{ type: "text", text: `Could not list assets: ${(err as Error).message}` }],
            };
        }
    },
);

async function main(): Promise<void> {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error(`[rwa-backing-verifier] MCP server ready (API: ${BASE})`);
}

main().catch((err) => {
    console.error("[rwa-backing-verifier] fatal:", err);
    process.exit(1);
});
