// The live-yield guards: a glitched feed can't print an implausible APY, and an
// asset resolves to its curated pool (exact) or the right underlying-token pool.
// Pure, so the guards are tested without touching the network.
import {
    sanitizeApy,
    selectPool,
    YIELD_APY_MAX,
    type LlamaPool,
} from "@/lib/ingestion/adapters/defillama";

const POOLS: LlamaPool[] = [
    {
        chain: "Ethereum",
        project: "sky-lending",
        symbol: "SDAI",
        apy: 1.25,
        underlyingTokens: ["0x6B175474E89094C44Da98b954EedeAC495271d0F"],
        pool: "c8a24fee-ec00-4f38-86c0-9f6daebc4225",
    },
    {
        chain: "Ethereum",
        project: "maple",
        symbol: "USDC",
        apy: 4.99,
        underlyingTokens: ["0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48"],
        pool: "43641cf5-a92e-416b-bce9-27113d3c0db6",
    },
];

describe("sanitizeApy — sanity floor/ceiling", () => {
    it("passes a normal yield through unchanged", () => {
        expect(sanitizeApy(4.99)).toBe(4.99);
        expect(sanitizeApy(0)).toBe(0);
    });

    it("drops an implausible glitched feed rather than printing it", () => {
        expect(sanitizeApy(1400)).toBeNull(); // the "1,400%" case
        expect(sanitizeApy(YIELD_APY_MAX + 0.01)).toBeNull();
    });

    it("drops a negative or non-finite value", () => {
        expect(sanitizeApy(-1)).toBeNull();
        expect(sanitizeApy(NaN)).toBeNull();
        expect(sanitizeApy(null)).toBeNull();
        expect(sanitizeApy(undefined)).toBeNull();
    });
});

describe("selectPool", () => {
    it("matches a curated pool id exactly", () => {
        const p = selectPool(POOLS, {
            poolId: "43641cf5-a92e-416b-bce9-27113d3c0db6",
            address: "0xdoesnotmatter",
            chain: "Ethereum",
        });
        expect(p?.project).toBe("maple");
    });

    it("falls back to underlying-token match on the right chain", () => {
        const p = selectPool(POOLS, {
            address: "0x6b175474e89094c44da98b954eedeac495271d0f", // DAI, lowercased
            chain: "ethereum",
        });
        expect(p?.pool).toBe("c8a24fee-ec00-4f38-86c0-9f6daebc4225");
    });

    it("returns null when nothing matches", () => {
        expect(selectPool(POOLS, { address: "0xabc", chain: "Base" })).toBeNull();
    });
});
