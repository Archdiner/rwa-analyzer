import { governanceAdapter } from "@/lib/ingestion/adapters/governance";
import { EMPTY } from "@/lib/ingestion/adapters/base";

describe("governanceAdapter (network shell)", () => {
    it("returns EMPTY for an unsupported chain with no network call", async () => {
        const result = await governanceAdapter({ chainId: 999, address: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48" });
        expect(result).toBe(EMPTY);
        expect(result.governance_data).toBeUndefined();
    });
});
