// Guards the exact bug that made BENJI a false red: a seed field silently
// dropped between the seed registry and ingest(). seedIngestOptions is the one
// place that mapping lives; this asserts it forwards every verdict-affecting
// field.
import { getSeed, allSeeds, seedIngestOptions } from "@/lib/seed/assets";

const BENJI = "1:0x3ddc84940ab509c11b20b76b466933f40b750dc9";

describe("seedIngestOptions - no verdict-affecting field is dropped", () => {
    it("forwards tokenizationMode (the field whose drop made BENJI a false red)", () => {
        const seed = getSeed(BENJI);
        expect(seed).toBeDefined();
        expect(seed!.tokenizationMode).toBe("tranche_of_registered_fund");
        expect(seedIngestOptions(seed!).tokenizationMode).toBe("tranche_of_registered_fund");
    });

    it("forwards defillamaPool for the DeFi seeds that carry it", () => {
        const withPool = allSeeds().filter(({ seed }) => seed.defillamaPool);
        expect(withPool.length).toBeGreaterThan(0);
        for (const { seed } of withPool) {
            expect(seedIngestOptions(seed).defillamaPool).toBe(seed.defillamaPool);
        }
    });

    it("forwards every field each seed actually sets", () => {
        for (const { seed } of allSeeds()) {
            const opts = seedIngestOptions(seed);
            expect(opts.identifiers).toBe(seed.identifiers);
            expect(opts.seedFields).toBe(seed.seedFields);
            if (seed.disclosureUrl) expect(opts.disclosureUrl).toBe(seed.disclosureUrl);
            if (seed.tokenizationMode) expect(opts.tokenizationMode).toBe(seed.tokenizationMode);
            if (seed.defillamaPool) expect(opts.defillamaPool).toBe(seed.defillamaPool);
        }
    });
});
