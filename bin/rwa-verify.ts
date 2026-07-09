// ---------------------------------------------------------------------------
// rwa-verify - human handle for the backing verification primitive
// ---------------------------------------------------------------------------
// A thin client over /api/verify. Points at the deployed API by default; set
// RWA_API_BASE to target a local server. The tier is printed, never encoded in
// the exit code - a caller must read the verdict, not branch on 0/1.
//
//   npm run verify -- ousg
//   RWA_API_BASE=http://localhost:3000 npm run verify -- 1:0x7712...
// ---------------------------------------------------------------------------

import type { AgentVerdict, AgentBackingTier } from "@/lib/agent/verdict";

const BASE = process.env.RWA_API_BASE || "https://rwa-analyzer.vercel.app";
const useColor = process.stdout.isTTY;

const C = {
    reset: "\x1b[0m",
    bold: "\x1b[1m",
    dim: "\x1b[2m",
    green: "\x1b[32m",
    amber: "\x1b[33m",
    red: "\x1b[31m",
    gray: "\x1b[90m",
    cyan: "\x1b[36m",
};
function paint(s: string, code: string): string {
    return useColor ? `${code}${s}${C.reset}` : s;
}

const TIER_COLOR: Record<AgentBackingTier, string> = {
    verified_backed: C.green,
    partially_verified: C.amber,
    does_not_reconcile: C.red,
    unverifiable: C.gray,
};

const FRESH_COLOR: Record<string, string> = { live: C.green, aging: C.amber, stale: C.red };

async function get<T>(path: string): Promise<T> {
    const res = await fetch(`${BASE}${path}`, { headers: { accept: "application/json" } });
    const json = (await res.json()) as { success?: boolean; data?: T; error?: string };
    if (!res.ok || json.success === false) {
        throw new Error(json.error || `HTTP ${res.status}`);
    }
    return json.data as T;
}

async function listUniverse(): Promise<void> {
    try {
        const { universe } = await get<{ universe: { symbol: string; name: string }[] }>("/api/universe");
        console.log(paint("\nKnown assets you can verify by symbol:", C.bold));
        for (const a of universe) console.log(`  ${a.symbol.padEnd(12)} ${paint(a.name, C.dim)}`);
    } catch {
        /* best-effort */
    }
}

function printVerdict(v: AgentVerdict): void {
    const b = v.backing;
    const tierColor = TIER_COLOR[b.tier];
    const issuer = v.asset.issuer_name ? ` ${paint(`(${v.asset.issuer_name})`, C.dim)}` : "";

    console.log("");
    console.log(`${paint(v.asset.symbol, C.bold)} - ${v.asset.name}${issuer}`);
    const freshPart = b.freshness
        ? `   ${paint(`freshness: ${b.freshness}`, FRESH_COLOR[b.freshness] ?? C.gray)}` +
          (b.next_expected_update ? paint(` (updates ~${b.next_expected_update.slice(0, 10)})`, C.dim) : "")
        : "";
    console.log(
        `${paint("BACKING:", C.bold)} ${paint(b.tier.toUpperCase(), tierColor + C.bold)}` +
            `   ${paint(`confidence: ${b.confidence}`, C.cyan)}${freshPart}`,
    );
    console.log(`  ${b.meaning}`);

    if (b.trust_boundary) {
        console.log(`\n${paint("Trust boundary:", C.bold)} ${paint(b.trust_boundary, C.dim)}`);
    }

    if (b.caveats.length > 0) {
        console.log(`\n${paint("Caveats:", C.bold)}`);
        for (const c of b.caveats) console.log(`  ${paint("•", C.amber)} ${c}`);
    }

    if (v.evidence.length > 0) {
        console.log(`\n${paint("Evidence:", C.bold)}`);
        for (const e of v.evidence) {
            console.log(
                `  [${paint(e.source_label, C.cyan)}] independence ${e.independence}/5 ` +
                    `(${e.independence_label}) · ${e.extraction} · ${e.confidence} · ` +
                    `${paint(e.freshness, FRESH_COLOR[e.freshness] ?? C.gray)} · as of ${e.as_of.slice(0, 10)}`,
            );
            console.log(paint(`      ${e.trust_boundary}`, C.dim));
        }
    }

    const dims = Object.entries(v.dimensions)
        .map(([k, d]) => `${k} ${d.flag}/${d.confidence}`)
        .join("  ·  ");
    console.log(`\n${paint("Dimensions:", C.bold)} ${dims}`);
    if (v.provider_url) console.log(`${paint("Provider:", C.bold)} ${v.provider_url}`);
    console.log(paint(`\n${v.disclaimer}`, C.gray));
}

async function main(): Promise<void> {
    const query = process.argv[2];
    if (!query || query === "-h" || query === "--help") {
        console.log("Usage: rwa-verify <symbol | chainId:address>");
        console.log(`API:   ${BASE}   (override with RWA_API_BASE)`);
        await listUniverse();
        process.exit(query ? 0 : 1);
    }

    try {
        const verdict = await get<AgentVerdict>(`/api/verify?asset=${encodeURIComponent(query)}`);
        printVerdict(verdict);
    } catch (err) {
        console.error(paint(`\nCould not verify "${query}": ${(err as Error).message}`, C.red));
        await listUniverse();
        process.exit(1);
    }
}

main();
