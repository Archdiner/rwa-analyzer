// ---------------------------------------------------------------------------
// Supported chains + asset_id helpers
// ---------------------------------------------------------------------------
// v1 supports the EVM three: Ethereum, Base, Avalanche C-Chain. The canonical
// key for an asset is "{chainId}:{contractAddress}" with a lowercased address.
// ---------------------------------------------------------------------------

import { createPublicClient, http, isAddress, type PublicClient } from "viem";
import { mainnet, base, avalanche } from "viem/chains";
import { rpcUrl } from "@/lib/env";

const CHAINS = {
    1: { chain: mainnet, name: "Ethereum" },
    8453: { chain: base, name: "Base" },
    43114: { chain: avalanche, name: "Avalanche" },
} as const;

export type SupportedChainId = keyof typeof CHAINS;

export function isSupportedChain(chainId: number): chainId is SupportedChainId {
    return chainId in CHAINS;
}

export function chainName(chainId: number): string {
    return isSupportedChain(chainId) ? CHAINS[chainId].name : `Chain ${chainId}`;
}

export function supportedChainIds(): SupportedChainId[] {
    return Object.keys(CHAINS).map(Number) as SupportedChainId[];
}

// ── asset_id ─────────────────────────────────────────────────────────────────

export interface ParsedAssetId {
    chainId: number;
    address: string; // lowercased
}

/** Builds the canonical "{chainId}:{address}" key. Throws on a bad address. */
export function formatAssetId(chainId: number, address: string): string {
    if (!isAddress(address)) {
        throw new Error(`Invalid contract address: ${address}`);
    }
    return `${chainId}:${address.toLowerCase()}`;
}

/** Parses a canonical asset_id. Returns null if malformed. */
export function parseAssetId(assetId: string): ParsedAssetId | null {
    const [chainPart, address] = assetId.split(":");
    const chainId = Number(chainPart);
    if (!Number.isInteger(chainId) || !address || !isAddress(address)) {
        return null;
    }
    return { chainId, address: address.toLowerCase() };
}

// ── viem clients ─────────────────────────────────────────────────────────────

const clientCache = new Map<number, PublicClient>();

/**
 * Returns a viem public client for the chain, or null if the chain is
 * unsupported or its RPC URL is not configured (adapters skip gracefully).
 */
export function getClient(chainId: number): PublicClient | null {
    if (!isSupportedChain(chainId)) return null;

    const cached = clientCache.get(chainId);
    if (cached) return cached;

    const url = rpcUrl(chainId);
    if (!url) return null;

    const client = createPublicClient({
        chain: CHAINS[chainId].chain,
        // Bound each RPC call so a slow/unresponsive provider cannot hang a
        // serverless invocation (and run up billed execution time).
        transport: http(url, { timeout: 10_000 }),
    }) as PublicClient;

    clientCache.set(chainId, client);
    return client;
}
