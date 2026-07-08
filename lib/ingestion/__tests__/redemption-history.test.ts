import {
    buildRedemptionHistoryData,
    mergeFeeEvents,
    hasAssessmentBasis,
} from "@/lib/ingestion/redemption-history";
import { REDEMPTION_INCIDENTS, lookupRedemptionIncidents } from "@/lib/ingestion/adapters/redemption-registry";
import type { FeeEvent, RedemptionIncident } from "@/lib/contracts";

const incident = (over: Partial<RedemptionIncident> = {}): RedemptionIncident => ({
    as_of: "2025-11-04T00:00:00Z",
    kind: "suspension",
    regime: "onchain_contract",
    source: "post-mortem",
    citation: { url: "https://x", text_span: "redemptions suspended" },
    ...over,
});

const fee = (over: Partial<FeeEvent> = {}): FeeEvent => ({
    as_of: "2024-09-01T00:00:00Z",
    kind: "liquidity_fee",
    mandatory: true,
    amount_pct: 0.5,
    source: "SEC EDGAR N-MFP",
    citation: { url: "https://sec", text_span: "liquidity fee" },
    ...over,
});

describe("redemption-registry", () => {
    it("is empty by default (no unverified incident ships)", () => {
        expect(Object.keys(REDEMPTION_INCIDENTS).length).toBe(0);
    });
    it("lookup returns an empty array for an unknown asset", () => {
        expect(lookupRedemptionIncidents("1:0x000000000000000000000000000000000000dead")).toEqual([]);
    });
    it("every seeded entry (if any) carries full provenance + regime", () => {
        for (const entries of Object.values(REDEMPTION_INCIDENTS)) {
            for (const e of entries) {
                expect(e.kind).toBeTruthy();
                expect(e.regime).toBeTruthy();
                expect(e.as_of).toMatch(/^\d{4}-\d{2}-\d{2}/);
                expect(e.source.length).toBeGreaterThan(0);
                expect(e.verified_at).toMatch(/^\d{4}-\d{2}-\d{2}$/);
                expect(e.verified_against.length).toBeGreaterThan(10);
            }
        }
    });
});

describe("buildRedemptionHistoryData", () => {
    it("live pause read is verified; incidents are preserved verbatim (regime intact)", () => {
        const d = buildRedemptionHistoryData({
            currentPaused: false,
            currentFrozen: null,
            incidents: [incident({ regime: "non_traded_reit", kind: "repurchase_cap" })],
            asOf: "2026-07-09T00:00:00Z",
        });
        expect(d.current_paused.value).toBe(false);
        expect(d.current_paused.confidence).toBe("verified");
        expect(d.incidents[0].regime).toBe("non_traded_reit");
        expect(d.incidents[0].kind).toBe("repurchase_cap");
        expect(d.fee_events).toEqual([]);
    });

    it("a null pause read stays null (unknown), never coerced to false", () => {
        const d = buildRedemptionHistoryData({ currentPaused: null, currentFrozen: null, incidents: [], asOf: "2026-07-09T00:00:00Z" });
        expect(d.current_paused.value).toBeNull();
    });
});

describe("mergeFeeEvents", () => {
    it("merges fee events into an existing base without touching other signals", () => {
        const base = buildRedemptionHistoryData({ currentPaused: false, currentFrozen: null, incidents: [], asOf: "t" });
        const merged = mergeFeeEvents(base, [fee()], "t");
        expect(merged.current_paused.value).toBe(false);
        expect(merged.fee_events).toHaveLength(1);
        expect(merged.fee_events[0].kind).toBe("liquidity_fee");
    });
    it("synthesizes a payload when only fee events exist (fund with no on-chain pause)", () => {
        const merged = mergeFeeEvents(undefined, [fee()], "t");
        expect(merged.current_paused.value).toBeNull();
        expect(merged.fee_events).toHaveLength(1);
    });
});

describe("hasAssessmentBasis", () => {
    it("true when a live pause state is readable", () => {
        expect(hasAssessmentBasis(buildRedemptionHistoryData({ currentPaused: false, currentFrozen: null, incidents: [], asOf: "t" }))).toBe(true);
    });
    it("true when a curated incident exists", () => {
        expect(hasAssessmentBasis(buildRedemptionHistoryData({ currentPaused: null, currentFrozen: null, incidents: [incident()], asOf: "t" }))).toBe(true);
    });
    it("true when a fee event exists", () => {
        expect(hasAssessmentBasis(mergeFeeEvents(undefined, [fee()], "t"))).toBe(true);
    });
    it("false when there is no basis at all (long-tail token) -> dimension stays unknown", () => {
        expect(hasAssessmentBasis(buildRedemptionHistoryData({ currentPaused: null, currentFrozen: null, incidents: [], asOf: "t" }))).toBe(false);
    });
});
