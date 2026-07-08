import { assessYieldSource } from "@/lib/computation/yield-source";
import type { Confidence, DimensionRead, Flag, NormalizedAssetRecord, YieldSourceData } from "@/lib/contracts";
import { f, rec, daysAgo } from "./helpers";

/** Concise DimensionRead builder for yield tests. */
function rd(value: number | null, confidence: Confidence = "verified", as_of = new Date().toISOString()): DimensionRead<number> {
    return { value, source: "aave:v3:pool", method: "onchain_read", confidence, as_of };
}

function ys(overrides: Partial<YieldSourceData> = {}): YieldSourceData {
    return {
        organic_apy: rd(3.0),
        reward_apy: rd(0),
        kind: "lending_interest",
        underlying_symbol: "USDC",
        ...overrides,
    };
}

function recWithYs(data: YieldSourceData, fields = {}): NormalizedAssetRecord {
    return { ...rec(fields), yield_source_data: data };
}

describe("assessYieldSource", () => {
    it("organic-dominated with verified reward=0 -> green/verified, reason states the split", () => {
        const r = assessYieldSource(recWithYs(ys()));
        expect(r.flag).toBe("green");
        expect(r.confidence).toBe("verified");
        expect(r.reason).toMatch(/organic borrow interest/);
        expect(r.freshness).toBe("live");
    });

    it("organic dominant with a small verified emissions share still greens and names the split", () => {
        const r = assessYieldSource(recWithYs(ys({ organic_apy: rd(9.5), reward_apy: rd(0.3), kind: "lending_interest" })));
        expect(r.flag).toBe("green");
        expect(r.reason).toMatch(/emissions/);
    });

    it("emissions-dominated -> amber, not green", () => {
        const r = assessYieldSource(recWithYs(ys({ organic_apy: rd(0.5), reward_apy: rd(12), kind: "emissions" })));
        expect(r.flag).toBe("amber");
        expect(r.reason).toMatch(/emissions-dominated/);
    });

    it("reward is an aggregator (auto) estimate -> amber even if organic dominates, capped at auto", () => {
        const r = assessYieldSource(recWithYs(ys({ organic_apy: rd(4), reward_apy: rd(0.2, "auto"), kind: "mixed" })));
        expect(r.flag).toBe("amber");
        expect(r.confidence).toBe("auto");
        expect(r.reason).toMatch(/aggregator estimate/);
    });

    it("reward data unavailable -> organic reported, emissions unknown, not green", () => {
        const r = assessYieldSource(recWithYs(ys({ organic_apy: rd(3), reward_apy: rd(null) })));
        expect(r.flag).toBe("amber");
        expect(r.reason).toMatch(/emissions could not be read/);
        expect(r.confidence).toBe("verified"); // organic alone is verified
    });

    it("organic reads 0 with a nonzero aggregator headline -> red (data-integrity contradiction)", () => {
        const r = assessYieldSource(recWithYs(ys({ organic_apy: rd(0), reward_apy: rd(0) }), { yield_apy: f(6.2, { method: "aggregator", confidence: "auto", source: "defillama" }) }));
        expect(r.flag).toBe("red");
        expect(r.reason).toMatch(/do not reconcile/);
    });

    it("no readable rates -> unknown (not green, not red)", () => {
        const r = assessYieldSource(recWithYs(ys({ organic_apy: rd(null), reward_apy: rd(null) })));
        expect(r.flag).toBe("unknown");
    });

    it("no yield_source_data at all -> unknown (non-lending asset)", () => {
        const r = assessYieldSource(rec());
        expect(r.flag).toBe("unknown");
        expect(r.confidence).toBe("unverifiable");
    });

    it("stale read demotes a green one notch and carries a stale caveat", () => {
        const r = assessYieldSource(recWithYs(ys({ organic_apy: rd(3, "verified", daysAgo(2.5)), reward_apy: rd(0, "verified", daysAgo(2.5)) })));
        expect(r.flag).toBe("amber");
        expect(r.freshness).toBe("stale");
        expect(r.reason).toMatch(/stale/i);
    });

    it("very stale read (>3x cadence) drops to unknown", () => {
        const r = assessYieldSource(recWithYs(ys({ organic_apy: rd(3, "verified", daysAgo(5)), reward_apy: rd(0, "verified", daysAgo(5)) })));
        expect(r.flag).toBe("unknown");
    });

    it("anti-laundering: an unverified underlying caps a would-be green at the ceiling", () => {
        const r = assessYieldSource(recWithYs(ys({ underlying_ceiling: "amber" })));
        expect(r.flag).toBe("amber");
        expect(r.reason).toMatch(/cannot be safer/);
    });

    it("the ceiling never promotes: a red underlying ceiling leaves an amber verdict unchanged in rank", () => {
        // organic-only auto reward -> amber; ceiling green would NOT lift it.
        const r = assessYieldSource(recWithYs(ys({ organic_apy: rd(4), reward_apy: rd(0.2, "auto"), kind: "mixed", underlying_ceiling: "green" })));
        expect(r.flag).toBe("amber");
    });
});
