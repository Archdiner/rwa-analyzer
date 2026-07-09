// ---------------------------------------------------------------------------
// Environment access
// ---------------------------------------------------------------------------
// Central, lazily-read accessors. Nothing here throws at import time: adapters
// and the extractor degrade gracefully when their key is absent (that is the
// coverage-tier honesty mechanism, not an error). Only the store and cron
// require their keys, checked at call sites.
// ---------------------------------------------------------------------------

if (typeof window !== "undefined" && process.env.NODE_ENV !== "test") {
    throw new Error("lib/env.ts must only be imported on the server");
}

/** Per-chain RPC URL, keyed by chain id. Undefined = chain not configured. */
export function rpcUrl(chainId: number): string | undefined {
    switch (chainId) {
        case 1:
            return process.env.ETHEREUM_RPC_URL;
        case 8453:
            return process.env.BASE_RPC_URL;
        case 43114:
            return process.env.AVALANCHE_RPC_URL;
        default:
            return undefined;
    }
}

export function openAiKey(): string | undefined {
    return process.env.OPENAI_API_KEY || undefined;
}

export function rwaXyzKey(): string | undefined {
    return process.env.RWA_XYZ_API_KEY || undefined;
}

/** Optional web-search key used only for issuer-doc discovery on cold lookups. */
export function webSearchKey(): string | undefined {
    return process.env.WEB_SEARCH_API_KEY || undefined;
}

export function cronSecret(): string | undefined {
    return process.env.CRON_SECRET || undefined;
}

/**
 * SEC EDGAR requires a descriptive User-Agent with a contact. Overridable via
 * SEC_USER_AGENT; the default is honest about what the tool is. EDGAR is a free
 * public API - no key needed, only the UA courtesy header.
 */
export function secUserAgent(): string {
    return process.env.SEC_USER_AGENT || "RWA-Reliability-Analyzer research contact@rwa-analyzer.dev";
}

export function appUrl(): string {
    if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL;
    if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
    return "http://localhost:3000";
}
