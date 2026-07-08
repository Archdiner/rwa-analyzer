import { aaveAdapter } from "@/lib/ingestion/adapters/aave";
import { EMPTY } from "@/lib/ingestion/adapters/base";

describe("aaveAdapter (network shell)", () => {
    it("returns EMPTY for an unregistered asset with no network call", async () => {
        // An unregistered asset short-circuits at the registry lookup, before any
        // RPC client is resolved — so this needs no network and never flakes.
        const result = await aaveAdapter({ chainId: 1, address: "0x000000000000000000000000000000000000dead" });
        expect(result).toBe(EMPTY);
        expect(result.yield_source_data).toBeUndefined();
        expect(result.market_risk_data).toBeUndefined();
    });

    it("returns EMPTY for an unsupported chain even if some registry entry matched by address", async () => {
        // Chain 999 is unsupported -> getClient returns null -> EMPTY (registry
        // keys are chain-scoped, so this is doubly safe).
        const result = await aaveAdapter({ chainId: 999, address: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48" });
        expect(result).toBe(EMPTY);
    });
});
