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
    // Pin the clock to just after the fixture's on-chain timestamp. The Aave
    // fixture stamps `as_of` from its fixed `lastUpdateTimestamp`, so on real time
    // the yield-source freshness rule eventually demotes green -> amber once the
    // fixture ages past the staleness window (a time-bomb). Pinning keeps the read
    // fresh, testing the classification logic - not the calendar.
    beforeAll(() => {
        jest.useFakeTimers();
        jest.setSystemTime(new Date((usdcFixture as { lastUpdateTimestamp: number }).lastUpdateTimestamp * 1000 + 60_000));
    });
    afterAll(() => jest.useRealTimers());

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

    it("keeps the original four dimensions and adds the additive v1.2/v1.3 ones", () => {
        const a = computeAssessment(nonLending());
        expect(Object.keys(a.dimensions).sort()).toEqual(
            ["access", "backing", "governance", "market_risk", "redemption", "redemption_history", "structure", "yield_source"].sort(),
        );
        expect(a.dimensions.backing.flag).toBe("green");
        // No on-chain/coverage data on this record → the additive dims are unknown.
        expect(a.dimensions.yield_source.flag).toBe("unknown");
        expect(a.dimensions.market_risk.flag).toBe("unknown");
        expect(a.dimensions.governance.flag).toBe("unknown");
        expect(a.dimensions.redemption_history.flag).toBe("unknown");
    });

    it("overall_confidence is unchanged: the additive unknown dimensions are excluded", () => {
        const a = computeAssessment(nonLending());
        // backing verified; the unknown additive dims do not drag it down.
        expect(a.overall_confidence).toBe("verified");
    });
});

describe("v1.3 dimensions - assessment wiring", () => {
    it("a record with governance + redemption data gets non-unknown dimensions via computeAssessment", () => {
        const asOf = new Date().toISOString();
        const record: NormalizedAssetRecord = {
            ...rec(),
            governance_data: {
                proxy_pattern: { value: "transparent", source: "onchain:governance", method: "onchain_read", confidence: "verified", as_of: asOf },
                is_upgradeable: { value: true, source: "onchain:governance", method: "onchain_read", confidence: "verified", as_of: asOf },
                admin_type: { value: "eoa", source: "onchain:governance", method: "onchain_read", confidence: "verified", as_of: asOf },
                admin_address: { value: "0xabc", source: "onchain:governance", method: "onchain_read", confidence: "verified", as_of: asOf },
                multisig_threshold: { value: null, source: "onchain:governance", method: "onchain_read", confidence: "verified", as_of: asOf },
                multisig_owner_count: { value: null, source: "onchain:governance", method: "onchain_read", confidence: "verified", as_of: asOf },
                timelock_delay_seconds: { value: null, source: "onchain:governance", method: "onchain_read", confidence: "verified", as_of: asOf },
                pause_power: { value: false, source: "onchain:governance", method: "onchain_read", confidence: "verified", as_of: asOf },
            },
            redemption_history_data: {
                current_paused: { value: false, source: "onchain:pause", method: "onchain_read", confidence: "verified", as_of: asOf },
                current_frozen: { value: false, source: "onchain:freeze", method: "onchain_read", confidence: "verified", as_of: asOf },
                latest_fee_flag: { value: null, source: "onchain:pause", method: "onchain_read", confidence: "verified", as_of: asOf },
                fee_events: [],
                incidents: [],
            },
        };
        const a = computeAssessment(record);
        expect(a.dimensions.governance.flag).toBe("red"); // EOA over an upgradeable proxy
        expect(a.dimensions.redemption_history.flag).toBe("green"); // not paused, none on record
    });
});
