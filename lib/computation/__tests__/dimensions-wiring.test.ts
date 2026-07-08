// End-to-end wiring of the v1.2 dimensions: the two new dimensions flow through
// computeAssessment and toAgentVerdict, and a non-lending asset is unchanged
// except for two additive `unknown` dimensions (regression guard).
import { computeAssessment } from "@/lib/computation";
import { toAgentVerdict } from "@/lib/agent/verdict";
import { shapeAaveReserve, type RawReserveReads } from "@/lib/ingestion/aave";
import type { NormalizedAssetRecord } from "@/lib/contracts";
import { f, ev, rec } from "./helpers";
import usdcFixture from "@/lib/ingestion/__tests__/fixtures/aave-usdc-reserve.json";

function lendingRecord(): NormalizedAssetRecord {
    const { yield_source_data, market_risk_data } = shapeAaveReserve(usdcFixture as unknown as RawReserveReads);
    return { ...rec(), yield_source_data, market_risk_data };
}

describe("v1.2 dimensions - assessment wiring", () => {
    it("a lending asset gains non-unknown yield_source and market_risk dimensions", () => {
        const a = computeAssessment(lendingRecord());
        expect(a.dimensions.yield_source).toBeDefined();
        expect(a.dimensions.market_risk).toBeDefined();
        expect(a.dimensions.yield_source.flag).not.toBe("unknown");
        expect(a.dimensions.market_risk.flag).not.toBe("unknown");
        // Real USDC fixture: organic-only -> yield green; ~87% util -> risk amber.
        expect(a.dimensions.yield_source.flag).toBe("green");
        expect(a.dimensions.market_risk.flag).toBe("amber");
    });

    it("toAgentVerdict exposes both new dimensions (never collapsed to a boolean)", () => {
        const record = lendingRecord();
        const verdict = toAgentVerdict(record, computeAssessment(record));
        expect(verdict.dimensions.yield_source).toBeDefined();
        expect(verdict.dimensions.market_risk).toBeDefined();
        expect(verdict.dimensions.yield_source.flag).toBe("green");
        expect(verdict.dimensions.market_risk.reason).toMatch(/Off-chain risks/);
        // The verdict has no boolean safe flag - the three-axis contract holds.
        expect((verdict as unknown as { safe?: boolean }).safe).toBeUndefined();
    });
});

describe("v1.2 dimensions - non-lending regression", () => {
    // A fully-verified backing asset with NO on-chain yield/risk data.
    function nonLending(): NormalizedAssetRecord {
        return rec({ supply: f(100), nav: f(1) }, [ev({ independence: 4, reserves_value: 100, source: "chainlink_por" })]);
    }

    it("keeps the original four dimensions and adds exactly two unknown ones", () => {
        const a = computeAssessment(nonLending());
        expect(Object.keys(a.dimensions).sort()).toEqual(
            ["access", "backing", "market_risk", "redemption", "structure", "yield_source"].sort(),
        );
        expect(a.dimensions.backing.flag).toBe("green");
        expect(a.dimensions.yield_source.flag).toBe("unknown");
        expect(a.dimensions.market_risk.flag).toBe("unknown");
    });

    it("overall_confidence is unchanged: the two unknown dimensions are excluded", () => {
        const a = computeAssessment(nonLending());
        // backing verified; the unknown yield/risk dims do not drag it down.
        expect(a.overall_confidence).toBe("verified");
    });
});
