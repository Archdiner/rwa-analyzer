// ---------------------------------------------------------------------------
// Lookup resolution
// ---------------------------------------------------------------------------
// Turns a user's search/paste into a canonical asset_id, a disambiguation list,
// or nothing. Address input resolves directly; ticker/name resolves only for
// seeded/indexed assets (long-tail is address-only in v1).
// ---------------------------------------------------------------------------

import { isAddress } from "viem";
import { formatAssetId } from "@/lib/chains";
import { searchIndex, type SearchHit } from "@/lib/store";
import { allSeeds } from "@/lib/seed/assets";

const CHAIN_PREFIXES: Record<string, number> = {
    eth: 1,
    ethereum: 1,
    base: 8453,
    avax: 43114,
    avalanche: 43114,
};

const ASSET_ID_RE = /^(\d+):(0x[0-9a-fA-F]{40})$/;

export type ResolveResult =
    | { kind: "asset_id"; assetId: string }
    | { kind: "candidates"; hits: SearchHit[] }
    | { kind: "none" };

/** In-memory ticker/name search over seeds (works even without Supabase). */
function searchSeeds(query: string): SearchHit[] {
    const q = query.trim().toLowerCase();
    return allSeeds()
        .filter(
            ({ seed }) =>
                seed.identifiers.symbol.toLowerCase().includes(q) ||
                seed.identifiers.name.toLowerCase().includes(q),
        )
        .map(({ assetId, seed }) => ({
            asset_id: assetId,
            symbol: seed.identifiers.symbol,
            name: seed.identifiers.name,
            issuer_name: seed.identifiers.issuer_name ?? null,
        }));
}

export async function resolveInput(input: string): Promise<ResolveResult> {
    const raw = input.trim();
    if (!raw) return { kind: "none" };

    // Already a canonical asset_id.
    const idMatch = raw.match(ASSET_ID_RE);
    if (idMatch) {
        return { kind: "asset_id", assetId: formatAssetId(Number(idMatch[1]), idMatch[2]) };
    }

    // "chain:0x..." with a named chain prefix.
    if (raw.includes(":")) {
        const [prefix, addr] = raw.split(":");
        const chainId = CHAIN_PREFIXES[prefix.trim().toLowerCase()];
        if (chainId && isAddress(addr.trim())) {
            return { kind: "asset_id", assetId: formatAssetId(chainId, addr.trim()) };
        }
    }

    // Bare address -> default to Ethereum mainnet (documented behavior).
    if (isAddress(raw)) {
        return { kind: "asset_id", assetId: formatAssetId(1, raw) };
    }

    // Ticker / name -> seeded + indexed only.
    const seedHits = searchSeeds(raw);
    const dbHits = await searchIndex(raw).catch(() => []);
    const merged = new Map<string, SearchHit>();
    for (const h of [...seedHits, ...dbHits]) merged.set(h.asset_id, h);
    const hits = [...merged.values()];

    if (hits.length === 1) return { kind: "asset_id", assetId: hits[0].asset_id };
    if (hits.length > 1) return { kind: "candidates", hits };
    return { kind: "none" };
}
