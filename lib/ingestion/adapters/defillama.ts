// ---------------------------------------------------------------------------
// DeFiLlama adapter (free REST)
// ---------------------------------------------------------------------------
// Best-effort yield lookup. DeFiLlama's /pools feed lists pools with an APY and
// (often) their underlying token addresses. We match a pool whose underlying
// token equals the asset address on the same chain and report its APY as `auto`
// (aggregator-derived, unconfirmed). No match -> contribute nothing.
// ---------------------------------------------------------------------------

import { field, type AdapterResult, EMPTY } from "@/lib/ingestion/adapters/base";
import type { ParsedAssetId } from "@/lib/chains";
import { chainName } from "@/lib/chains";

const POOLS_URL = "https://yields.llama.fi/pools";
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 min

interface LlamaPool {
    chain: string;
    project: string;
    symbol: string;
    apy: number | null;
    underlyingTokens?: string[] | null;
    pool: string;
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

/** DeFiLlama uses chain display names ("Ethereum", "Base", "Avalanche"). */
function llamaChainName(chainId: number): string {
    return chainName(chainId);
}

export async function defillamaAdapter(asset: ParsedAssetId): Promise<AdapterResult> {
    try {
        const pools = await getPools();
        const wantChain = llamaChainName(asset.chainId).toLowerCase();
        const wantAddr = asset.address.toLowerCase();

        const match = pools.find(
            (p) =>
                p.apy != null &&
                p.chain?.toLowerCase() === wantChain &&
                (p.underlyingTokens ?? []).some((t) => t?.toLowerCase() === wantAddr),
        );

        if (!match || match.apy == null) return EMPTY;

        return {
            fields: {
                yield_apy: field(Number(match.apy.toFixed(2)), {
                    source: "defillama",
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
