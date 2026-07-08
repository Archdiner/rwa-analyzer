import { assessMarketRisk } from "@/lib/computation/market-risk";
import type { Confidence, DimensionRead, MarketRiskData, NormalizedAssetRecord } from "@/lib/contracts";
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

/** Healthy reserve; override any signal to exercise a band. */
function mrd(overrides: Partial<MarketRiskData> = {}): MarketRiskData {
    return {
        utilization: num(0.5),
        available_liquidity: num(1_000_000_000),
        total_supplied: num(2_000_000_000),
        total_borrowed: num(1_000_000_000),
        supply_cap: num(0),
        borrow_cap: num(0),
        ltv: num(0.75),
        liquidation_threshold: num(0.8),
        reserve_factor: num(0.1),
        is_active: bool(true),
        is_frozen: bool(false),
        is_paused: bool(false),
        oracle_price: num(1.0),
        oracle_source: str("0x54586bE62E3c3580375aE3723C145253060Ca0C2"),
        deficit: num(0),
        underlying_symbol: "USDC",
        ...overrides,
    };
}

function recWithMr(data: MarketRiskData, fields = {}): NormalizedAssetRecord {
    return { ...rec(fields), market_risk_data: data };
}

describe("assessMarketRisk", () => {
    it("healthy reserve (low util, active, oracle present, no deficit) -> green/verified", () => {
        const r = assessMarketRisk(recWithMr(mrd()));
        expect(r.flag).toBe("green");
        expect(r.confidence).toBe("verified");
        expect(r.reason).toMatch(/Low on-chain risk/);
        expect(r.reason).toMatch(/Off-chain risks/); // deferred-signal scope caveat always present
    });

    it("frozen reserve -> red, reason names the freeze", () => {
        const r = assessMarketRisk(recWithMr(mrd({ is_frozen: bool(true) })));
        expect(r.flag).toBe("red");
        expect(r.reason).toMatch(/frozen/);
    });

    it("inactive reserve -> red", () => {
        const r = assessMarketRisk(recWithMr(mrd({ is_active: bool(false) })));
        expect(r.flag).toBe("red");
        expect(r.reason).toMatch(/inactive/);
    });

    it("paused reserve -> red", () => {
        const r = assessMarketRisk(recWithMr(mrd({ is_paused: bool(true) })));
        expect(r.flag).toBe("red");
        expect(r.reason).toMatch(/paused/);
    });

    it("utilization 97% -> red (liquidity crunch)", () => {
        const r = assessMarketRisk(recWithMr(mrd({ utilization: num(0.97) })));
        expect(r.flag).toBe("red");
        expect(r.reason).toMatch(/liquidity crunch/);
    });

    it("utilization 85% -> amber (withdrawal risk)", () => {
        const r = assessMarketRisk(recWithMr(mrd({ utilization: num(0.85) })));
        expect(r.flag).toBe("amber");
        expect(r.reason).toMatch(/withdrawal risk/);
    });

    it("material deficit (>=1% of supply) -> red", () => {
        const r = assessMarketRisk(recWithMr(mrd({ deficit: num(40_000_000) }))); // 2% of 2B
        expect(r.flag).toBe("red");
        expect(r.reason).toMatch(/bad debt/);
    });

    it("non-trivial deficit (0.1-1% of supply) -> amber (caution)", () => {
        const r = assessMarketRisk(recWithMr(mrd({ deficit: num(6_000_000) }))); // 0.3% of 2B
        expect(r.flag).toBe("amber");
        expect(r.reason).toMatch(/bad debt is/i);
    });

    it("dust deficit (< 0.1% of supply) stays green", () => {
        const r = assessMarketRisk(recWithMr(mrd({ deficit: num(1.55) }))); // ~0% of 2B
        expect(r.flag).toBe("green");
    });

    it("unreadable deficit contributes unknown -> overall not green", () => {
        const r = assessMarketRisk(recWithMr(mrd({ deficit: num(null) })));
        expect(r.flag).not.toBe("green");
        expect(r.reason).toMatch(/deficit could not be read/);
    });

    it("zero oracle price -> red; reason names the oracle", () => {
        const r = assessMarketRisk(recWithMr(mrd({ oracle_price: num(0) })));
        expect(r.flag).toBe("red");
        expect(r.reason).toMatch(/oracle/);
    });

    it("unreadable oracle price -> not green (unknown signal)", () => {
        const r = assessMarketRisk(recWithMr(mrd({ oracle_price: num(null) })));
        expect(r.flag).not.toBe("green");
        expect(r.reason).toMatch(/oracle price could not be read/);
    });

    it("thin collateral buffer -> amber with the reserve-level caveat", () => {
        const r = assessMarketRisk(recWithMr(mrd({ ltv: num(0.79), liquidation_threshold: num(0.8) })));
        expect(r.flag).toBe("amber");
        expect(r.reason).toMatch(/thin collateral buffer/i);
    });

    it("near supply cap -> amber", () => {
        const r = assessMarketRisk(recWithMr(mrd({ total_supplied: num(2_480_000_000), supply_cap: num(2_500_000_000) })));
        expect(r.flag).toBe("amber");
        expect(r.reason).toMatch(/supply cap/);
    });

    it("all-unknown inputs -> unknown dimension (not a false green)", () => {
        const r = assessMarketRisk(
            recWithMr(
                mrd({
                    utilization: num(null),
                    available_liquidity: num(null),
                    total_supplied: num(null),
                    total_borrowed: num(null),
                    supply_cap: num(null),
                    borrow_cap: num(null),
                    ltv: num(null),
                    liquidation_threshold: num(null),
                    reserve_factor: num(null),
                    is_active: bool(null),
                    is_frozen: bool(null),
                    is_paused: bool(null),
                    oracle_price: num(null),
                    oracle_source: str(null),
                    deficit: num(null),
                }),
            ),
        );
        expect(r.flag).toBe("unknown");
    });

    it("a present deficit that cannot be sized (supply unreadable) -> not red (unknown, no false red)", () => {
        const r = assessMarketRisk(recWithMr(mrd({ deficit: num(1.55), total_supplied: num(null) })));
        expect(r.flag).not.toBe("red");
        expect(r.reason).toMatch(/cannot be sized/);
    });

    it("a NaN read collapses to unknown, never a benign 'ok' (no false green)", () => {
        const r = assessMarketRisk(recWithMr(mrd({ utilization: num(NaN) })));
        expect(r.flag).not.toBe("green");
    });

    it("a NaN read never manufactures a false critical either", () => {
        const r = assessMarketRisk(recWithMr(mrd({ deficit: num(NaN) })));
        expect(r.flag).not.toBe("red");
    });

    it("lt=0 with ltv>0 is a misconfiguration -> caution, not a clean ok", () => {
        const r = assessMarketRisk(recWithMr(mrd({ ltv: num(0.5), liquidation_threshold: num(0) })));
        expect(r.flag).toBe("amber");
        expect(r.reason).toMatch(/misconfigured collateral/);
    });

    it("ltv=0 and lt=0 (not collateral) stays green", () => {
        const r = assessMarketRisk(recWithMr(mrd({ ltv: num(0), liquidation_threshold: num(0) })));
        expect(r.flag).toBe("green");
    });

    it("a stale oracle read demotes even when utilization is fresh (freshness uses oldest driving read)", () => {
        const r = assessMarketRisk(recWithMr(mrd({ oracle_price: num(1.0, "verified", daysAgo(2.5)) })));
        expect(r.flag).not.toBe("green");
        expect(r.freshness).toBe("stale");
    });

    it("a null-driven verdict does not carry a 'verified' confidence label", () => {
        const r = assessMarketRisk(recWithMr(mrd({ deficit: num(null) })));
        expect(r.confidence).not.toBe("verified"); // couldn't read deficit -> not verified
    });

    it("no market_risk_data at all -> unknown (non-lending asset)", () => {
        const r = assessMarketRisk(rec());
        expect(r.flag).toBe("unknown");
        expect(r.confidence).toBe("unverifiable");
    });

    it("critical outranks caution: frozen + high utilization -> red", () => {
        const r = assessMarketRisk(recWithMr(mrd({ is_frozen: bool(true), utilization: num(0.85) })));
        expect(r.flag).toBe("red");
    });

    it("stale read demotes a green one notch and carries a stale caveat", () => {
        const r = assessMarketRisk(recWithMr(mrd({ utilization: num(0.5, "verified", daysAgo(2.5)) })));
        expect(r.flag).toBe("amber");
        expect(r.freshness).toBe("stale");
        expect(r.reason).toMatch(/stale/i);
    });

    it("anti-laundering: an unverified underlying caps a would-be green", () => {
        const r = assessMarketRisk(recWithMr(mrd({ underlying_ceiling: "amber" })));
        expect(r.flag).toBe("amber");
        expect(r.reason).toMatch(/cannot be safer/);
    });
});
