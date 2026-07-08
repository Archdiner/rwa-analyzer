import {
    rayRateToApy,
    utilizationOf,
    bpsToFraction,
    decodeReserveConfig,
    classifyYieldKind,
    buildYieldSourceData,
    buildMarketRiskData,
    shapeAaveReserve,
    type RawReserveReads,
} from "@/lib/ingestion/aave";
import usdcFixture from "./fixtures/aave-usdc-reserve.json";

const RAW = usdcFixture as unknown as RawReserveReads;

describe("aave pure shaping", () => {
    describe("rayRateToApy", () => {
        it("converts the fixture liquidityRate to ~3.0% APY (matches Aave's compounding)", () => {
            const apy = rayRateToApy(RAW.liquidityRate);
            expect(apy).toBeGreaterThan(3.0);
            expect(apy).toBeLessThan(3.1);
        });
        it("a zero rate is 0% (no div/pow blowups)", () => {
            expect(rayRateToApy("0")).toBe(0);
        });
        it("accepts a bigint", () => {
            expect(rayRateToApy(29908268661607149123306704n)).toBeCloseTo(3.036, 1);
        });
    });

    describe("utilizationOf", () => {
        it("is borrowed / supplied", () => {
            expect(utilizationOf(50, 100)).toBeCloseTo(0.5, 6);
        });
        it("0-supply -> 0, never div-by-zero", () => {
            expect(utilizationOf(0, 0)).toBe(0);
            expect(utilizationOf(10, 0)).toBe(0);
        });
    });

    it("bpsToFraction converts basis points to a 0-1 fraction", () => {
        expect(bpsToFraction(7500)).toBe(0.75);
    });

    it("decodeReserveConfig normalizes bps to fractions and passes flags through", () => {
        const d = decodeReserveConfig(RAW.config);
        expect(d.ltv).toBe(0.75);
        expect(d.liquidationThreshold).toBe(0.78);
        expect(d.reserveFactor).toBe(0.1);
        expect(d.isActive).toBe(true);
        expect(d.isFrozen).toBe(false);
    });

    describe("classifyYieldKind", () => {
        it("organic-only -> lending_interest", () => {
            expect(classifyYieldKind(3.0, 0)).toBe("lending_interest");
        });
        it("reward-dominated -> emissions", () => {
            expect(classifyYieldKind(0.5, 12)).toBe("emissions");
        });
        it("both material -> mixed", () => {
            expect(classifyYieldKind(4, 6)).toBe("mixed");
        });
        it("reward unknown but organic present -> lending_interest (base kind)", () => {
            expect(classifyYieldKind(3.0, null)).toBe("lending_interest");
        });
        it("nothing readable -> unknown", () => {
            expect(classifyYieldKind(null, null)).toBe("unknown");
        });
    });

    describe("buildYieldSourceData", () => {
        it("organic is a verified on-chain read; reward=0 verified (RewardsController confirmed empty)", () => {
            const y = buildYieldSourceData(RAW);
            expect(y.organic_apy.value).toBeGreaterThan(3);
            expect(y.organic_apy.confidence).toBe("verified");
            expect(y.organic_apy.method).toBe("onchain_read");
            expect(y.reward_apy.value).toBe(0);
            expect(y.reward_apy.confidence).toBe("verified");
            expect(y.kind).toBe("lending_interest");
            expect(y.underlying_symbol).toBe("USDC");
        });
        it("a DeFiLlama reward cross-ref is auto, never verified", () => {
            const y = buildYieldSourceData({ ...RAW, rewardApy: 9, rewardConfidence: "auto", rewardSource: "defillama:aave-v3" });
            expect(y.reward_apy.confidence).toBe("auto");
            expect(y.reward_apy.method).toBe("aggregator");
            expect(y.kind).toBe("mixed");
        });
        it("null reward stays null (unknown), never coerced to 0", () => {
            const y = buildYieldSourceData({ ...RAW, rewardApy: null, rewardConfidence: "auto", rewardSource: "defillama:aave-v3" });
            expect(y.reward_apy.value).toBeNull();
        });
    });

    describe("buildMarketRiskData", () => {
        it("computes utilization, available liquidity, and USD oracle price from raw reads", () => {
            const m = buildMarketRiskData(RAW);
            expect(m.utilization.value).toBeGreaterThan(0.85); // real reserve ~87%
            expect(m.utilization.value).toBeLessThan(0.9);
            expect(m.total_supplied.value).toBeGreaterThan(2_000_000_000);
            expect(m.available_liquidity.value).toBeGreaterThan(0);
            expect(m.oracle_price.value).toBeCloseTo(0.9997, 3);
            expect(m.ltv.value).toBe(0.75);
            expect(m.is_frozen.value).toBe(false);
            expect(m.oracle_source.value).toMatch(/^0x/);
            expect(m.oracle_source.confidence).toBe("verified");
        });
        it("a null deficit accessor stays null (unknown), never 0", () => {
            const m = buildMarketRiskData({ ...RAW, deficit: null });
            expect(m.deficit.value).toBeNull();
        });
        it("a present deficit is scaled into underlying units", () => {
            const m = buildMarketRiskData(RAW);
            expect(m.deficit.value).toBeCloseTo(1.551621, 4);
        });
    });

    it("shapeAaveReserve returns both payloads from one raw read", () => {
        const { yield_source_data, market_risk_data } = shapeAaveReserve(RAW);
        expect(yield_source_data.organic_apy.value).toBeGreaterThan(3);
        expect(market_risk_data.utilization.value).toBeGreaterThan(0.85);
    });
});
