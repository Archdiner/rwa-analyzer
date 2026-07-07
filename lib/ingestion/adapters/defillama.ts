// ---------------------------------------------------------------------------
// DeFiLlama adapter (free REST) — live pool APYs
// ---------------------------------------------------------------------------
// A yield is `auto` (verify yourself) with a timestamp, never verified — and it
// is held to the same integrity bar as everything else: a sanity floor/ceiling
// so a glitched feed can't print "1,400%" straight-faced, and its provenance
// records WHICH kind of number it is (a live DeFi pool APY), because the source
// of a number is part of the number.
//
// Two ways to match: a curated pool id (exact, for seeded DeFi assets) or, for
// the long tail, a pool whose underlying token equals the asset on the same
// chain. Stated fund rates (MMFs) don't live here — they're carried on the seed.
// ---------------------------------------------------------------------------

import { field, type AdapterResult, EMPTY } from "@/lib/ingestion/adapters/base";
import type { ParsedAssetId } from "@/lib/chains";
import { chainName } from "@/lib/chains";

const POOLS_URL = "https://yields.llama.fi/pools";
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 min

// Sanity band: a stable/RWA yield outside this is a glitched feed or a degen
// reward spike, neither of which this tool surfaces. Out of range -> drop the
// number (honest absence) rather than clamp it to a wrong one.
export const YIELD_APY_MIN = 0;
export const YIELD_APY_MAX = 100;

export interface LlamaPool {
    chain: string;
    project: string;
    symbol: string;
    apy: number | null;
    underlyingTokens?: string[] | null;
    pool: string;
}

/** Returns the apy only if it's inside the plausibility band, else null. */
export function sanitizeApy(apy: number | null | undefined): number | null {
    if (apy == null || !Number.isFinite(apy)) return null;
    if (apy < YIELD_APY_MIN || apy > YIELD_APY_MAX) return null;
    return apy;
}

/**
 * Selects the pool for an asset: a curated pool id wins (exact), else the
 * highest-relevance pool whose underlying token is the asset on the same chain.
 */
export function selectPool(
    pools: LlamaPool[],
    opts: { poolId?: string; address: string; chain: string },
): LlamaPool | null {
    if (opts.poolId) {
        return pools.find((p) => p.pool === opts.poolId) ?? null;
    }
    const wantChain = opts.chain.toLowerCase();
    const wantAddr = opts.address.toLowerCase();
    return (
        pools.find(
            (p) =>
                p.apy != null &&
                p.chain?.toLowerCase() === wantChain &&
                (p.underlyingTokens ?? []).some((t) => t?.toLowerCase() === wantAddr),
        ) ?? null
    );
}

let cache: { at: number; pools: LlamaPool[] } | null = null;

async function getPools(): Promise<LlamaPool[]> {
    if (cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.pools;
    const res = await fetch(POOLS_URL, { headers: { accept: "application/json" } });
    if (!res.ok) throw new Error(`defillama ${res.status}`);
    const json = (await res.json()) as { data?: LlamaPool[] };
    const pools = json.data ?? [];
    cache = { at: Date.now(), pools };
    return pools;
}

/**
 * @param poolId optional curated DeFiLlama pool id for this asset's native yield.
 */
export async function defillamaAdapter(asset: ParsedAssetId, poolId?: string): Promise<AdapterResult> {
    try {
        const pools = await getPools();
        const pool = selectPool(pools, { poolId, address: asset.address, chain: chainName(asset.chainId) });
        if (!pool) return EMPTY;

        const apy = sanitizeApy(pool.apy);
        if (apy == null) {
            if (pool.apy != null) {
                console.warn(`[defillama] rejected implausible APY ${pool.apy} for pool ${pool.pool} (${pool.project}).`);
            }
            return EMPTY;
        }

        return {
            fields: {
                yield_apy: field(Number(apy.toFixed(2)), {
                    source: `defillama:${pool.project}`,
                    method: "aggregator",
                    confidence: "auto",
                }),
            },
        };
    } catch (err) {
        console.error("[defillama] lookup failed:", err);
        return EMPTY;
    }
}
