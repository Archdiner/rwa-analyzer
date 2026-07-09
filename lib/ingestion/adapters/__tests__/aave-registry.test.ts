import { AAVE_MARKETS, lookupAaveMarket } from "@/lib/ingestion/adapters/aave-registry";

// USDC reserve on Aave v3 Ethereum (verified on-chain — see the registry).
const USDC = "1:0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48";
const A_USDC = "1:0x98c23e9d8f34fefb1b7bd6a91b7ff122f4e16f5c";
const WETH = "1:0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2";

describe("aave-registry", () => {
    it("resolves the same reserve from both the underlying and its aToken", () => {
        const fromUnderlying = lookupAaveMarket(USDC);
        const fromAToken = lookupAaveMarket(A_USDC);
        expect(fromUnderlying).toBeDefined();
        expect(fromAToken).toBeDefined();
        expect(fromAToken).toBe(fromUnderlying); // identical entry object
        expect(fromUnderlying!.label).toMatch(/USDC/);
    });

    it("is case-insensitive on the asset_id", () => {
        expect(lookupAaveMarket(USDC.toUpperCase())).toBeDefined();
    });

    it("returns undefined for an unregistered asset", () => {
        expect(lookupAaveMarket("1:0x000000000000000000000000000000000000dead")).toBeUndefined();
    });

    it("every entry carries full provenance (no half-filled rows)", () => {
        const entries = Object.values(AAVE_MARKETS);
        expect(entries.length).toBeGreaterThan(0);
        for (const e of entries) {
            expect(e.poolAddressesProvider).toMatch(/^0x[a-fA-F0-9]{40}$/);
            expect(e.underlying).toMatch(/^0x[a-fA-F0-9]{40}$/);
            expect(e.aToken).toMatch(/^0x[a-fA-F0-9]{40}$/);
            expect(e.chainId).toBe(1);
            expect(e.verified_at).toMatch(/^\d{4}-\d{2}-\d{2}$/);
            expect(e.verified_against.length).toBeGreaterThan(10);
            expect(e.label.length).toBeGreaterThan(0);
        }
    });

    it("maps distinct reserves to distinct entries", () => {
        expect(lookupAaveMarket(WETH)).toBeDefined();
        expect(lookupAaveMarket(WETH)).not.toBe(lookupAaveMarket(USDC));
    });

    it("covers the expanded reserve set (DAI, USDT, wstETH) resolvable by underlying", () => {
        const DAI = "1:0x6b175474e89094c44da98b954eedeac495271d0f";
        const USDT = "1:0xdac17f958d2ee523a2206206994597c13d831ec7";
        const WSTETH = "1:0x7f39c581f595b53c5cb19bd0b3f8da6c935e2ca0";
        expect(lookupAaveMarket(DAI)?.label).toMatch(/DAI/);
        expect(lookupAaveMarket(USDT)?.label).toMatch(/USDT/);
        expect(lookupAaveMarket(WSTETH)?.label).toMatch(/wstETH/);
        // 5 reserves x (underlying + aToken) = 10 keys.
        expect(Object.keys(AAVE_MARKETS).length).toBe(10);
    });
});
