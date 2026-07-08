// ---------------------------------------------------------------------------
// Cross-cutting honesty invariants for the v1.2 dimensions
// ---------------------------------------------------------------------------
// The single place that locks "never fake a green, unknown is valid" for
// yield_source + market_risk, the way confidence-cap / attestation invariants
// lock backing. Each block flips ONE input on an otherwise-green fixture and
// asserts the guard fires. Canary: deliberately breaking a rule in the source
// makes exactly the matching block fail.
// ---------------------------------------------------------------------------

import { assessYieldSource } from "@/lib/computation/yield-source";
import { assessMarketRisk } from "@/lib/computation/market-risk";
import type { Confidence, DimensionRead, Flag, MarketRiskData, NormalizedAssetRecord, YieldSourceData } from "@/lib/contracts";
import { rec, daysAgo } from "./helpers";

function num(value: number | null, confidence: Confidence = "verified", as_of = new Date().toISOString()): DimensionRead<number> {
    return { value, source: "aave:v3:pool", method: "onchain_read", confidence, as_of };
}
function bool(value: boolean | null, as_of = new Date().toISOString()): DimensionRead<boolean> {
    return { value, source: "aave:v3:pool", method: "onchain_read", confidence: "verified", as_of };
}
function str(value: string | null): DimensionRead<string> {
    return { value, source: "aave:oracle", method: "onchain_read", confidence: "verified", as_of: new Date().toISOString() };
}

/** A yield fixture that, unmodified, scores organic-green. */
function ys(overrides: Partial<YieldSourceData> = {}): YieldSourceData {
    return { organic_apy: num(3.0), reward_apy: num(0), kind: "lending_interest", underlying_symbol: "USDC", ...overrides };
}
/** A market-risk fixture that, unmodified, scores green. */
function mrd(overrides: Partial<MarketRiskData> = {}): MarketRiskData {
    return {
        utilization: num(0.5), available_liquidity: num(1e9), total_supplied: num(2e9), total_borrowed: num(1e9),
        supply_cap: num(0), borrow_cap: num(0), ltv: num(0.75), liquidation_threshold: num(0.8), reserve_factor: num(0.1),
        is_active: bool(true), is_frozen: bool(false), is_paused: bool(false), oracle_price: num(1), oracle_source: str("0xoracle"),
        deficit: num(0), underlying_symbol: "USDC", ...overrides,
    };
}
const withYs = (d: YieldSourceData, fields = {}): NormalizedAssetRecord => ({ ...rec(fields), yield_source_data: d });
const withMr = (d: MarketRiskData): NormalizedAssetRecord => ({ ...rec(), market_risk_data: d });

describe("invariant (baseline): the unmodified fixtures ARE green", () => {
    it("so every 'not green' assertion below is meaningful", () => {
        expect(assessYieldSource(withYs(ys())).flag).toBe("green");
        expect(assessMarketRisk(withMr(mrd())).flag).toBe("green");
    });
});

describe("(a) no yield_source green without a verified on-chain organic read", () => {
    it("a non-verified organic read is never green", () => {
        for (const confidence of ["auto", "unverifiable"] as Confidence[]) {
            expect(assessYieldSource(withYs(ys({ organic_apy: num(3.0, confidence) }))).flag).not.toBe("green");
        }
    });
    it("a null organic read is never green (nothing verified to rest on)", () => {
        expect(assessYieldSource(withYs(ys({ organic_apy: num(null) }))).flag).not.toBe("green");
    });
    it("an auto reward figure can never lift a green", () => {
        expect(assessYieldSource(withYs(ys({ reward_apy: num(0.1, "auto") }))).flag).not.toBe("green");
    });
});

describe("(b) no market_risk green while any critical or blocking-unknown signal is present", () => {
    const criticals: Array<[string, Partial<MarketRiskData>]> = [
        ["frozen", { is_frozen: bool(true) }],
        ["inactive", { is_active: bool(false) }],
        ["paused", { is_paused: bool(true) }],
        ["utilization > 95%", { utilization: num(0.97) }],
        ["material bad debt", { deficit: num(40_000_000) }],
        ["zero oracle price", { oracle_price: num(0) }],
    ];
    it.each(criticals)("critical signal (%s) forces not-green", (_label, override) => {
        expect(assessMarketRisk(withMr(mrd(override))).flag).not.toBe("green");
    });

    const blockingUnknowns: Array<[string, Partial<MarketRiskData>]> = [
        ["deficit unreadable", { deficit: num(null) }],
        ["oracle price unreadable", { oracle_price: num(null) }],
        ["utilization unreadable", { utilization: num(null) }],
    ];
    it.each(blockingUnknowns)("blocking unknown (%s) forces not-green", (_label, override) => {
        expect(assessMarketRisk(withMr(mrd(override))).flag).not.toBe("green");
    });
});

describe("(c) an emissions-dominated pool never reads organic-green", () => {
    it.each([
        [0.5, 12],
        [1, 20],
        [2, 8],
    ])("organic ~%s%% vs reward ~%s%% -> not green", (organic, reward) => {
        const r = assessYieldSource(withYs(ys({ organic_apy: num(organic), reward_apy: num(reward), kind: "emissions" })));
        expect(r.flag).not.toBe("green");
    });
});

describe("(d) a frozen reserve is always red", () => {
    it.each([
        ["otherwise healthy", {}],
        ["with high utilization", { utilization: num(0.85) }],
        ["with a thin buffer", { ltv: num(0.79), liquidation_threshold: num(0.8) }],
    ])("frozen + %s -> red", (_label, extra) => {
        expect(assessMarketRisk(withMr(mrd({ is_frozen: bool(true), ...extra }))).flag).toBe("red");
    });
});

describe("(e) both dimensions honor freshness demotion", () => {
    it("a stale yield read demotes the green and marks freshness stale", () => {
        const r = assessYieldSource(withYs(ys({ organic_apy: num(3, "verified", daysAgo(2.5)), reward_apy: num(0, "verified", daysAgo(2.5)) })));
        expect(r.flag).not.toBe("green");
        expect(r.freshness).toBe("stale");
    });
    it("a stale market-risk read demotes the green and marks freshness stale", () => {
        const r = assessMarketRisk(withMr(mrd({ utilization: num(0.5, "verified", daysAgo(2.5)) })));
        expect(r.flag).not.toBe("green");
        expect(r.freshness).toBe("stale");
    });
});

describe("(f) anti-laundering ceiling holds when the underlying is unverified", () => {
    it.each(["amber", "red", "unknown"] as Flag[])("a %s underlying ceiling caps a would-be green on both dimensions", (ceiling) => {
        const y = assessYieldSource(withYs(ys({ underlying_ceiling: ceiling })));
        const m = assessMarketRisk(withMr(mrd({ underlying_ceiling: ceiling })));
        expect(y.flag).not.toBe("green");
        expect(m.flag).not.toBe("green");
    });
});
