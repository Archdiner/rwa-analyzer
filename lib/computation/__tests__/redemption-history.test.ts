import { assessRedemptionHistory } from "@/lib/computation/redemption-history";
import type { Confidence, DimensionRead, FeeEvent, NormalizedAssetRecord, RedemptionHistoryData, RedemptionIncident } from "@/lib/contracts";
import { rec, daysAgo } from "./helpers";

function bread(value: boolean | null, confidence: Confidence = "verified", as_of = new Date().toISOString()): DimensionRead<boolean> {
    return { value, source: "onchain:pause", method: "onchain_read", confidence, as_of };
}
function feeRead(value: boolean | null, as_of = new Date().toISOString()): DimensionRead<boolean> {
    return { value, source: "SEC EDGAR N-MFP", method: "reference_api", confidence: "verified", as_of };
}
const incident = (over: Partial<RedemptionIncident> = {}): RedemptionIncident => ({
    as_of: "2025-11-04T00:00:00Z",
    kind: "suspension",
    regime: "onchain_contract",
    source: "post-mortem",
    citation: null,
    ...over,
});
const fee = (): FeeEvent => ({ as_of: "2024-09-01T00:00:00Z", kind: "liquidity_fee", mandatory: true, amount_pct: 0.5, source: "SEC EDGAR N-MFP", citation: null });

function rh(over: Partial<RedemptionHistoryData> = {}): RedemptionHistoryData {
    return {
        current_paused: bread(false),
        current_frozen: bread(false),
        latest_fee_flag: feeRead(null),
        fee_events: [],
        incidents: [],
        ...over,
    };
}
function recWith(data: RedemptionHistoryData): NormalizedAssetRecord {
    return { ...rec(), redemption_history_data: data };
}

describe("assessRedemptionHistory", () => {
    it("not currently restricted + nothing on record -> green, absence-scoped (as of date)", () => {
        const r = assessRedemptionHistory(recWith(rh()));
        expect(r.flag).toBe("green");
        expect(r.confidence).toBe("verified");
        expect(r.reason).toMatch(/no redemption restriction on record as of \d{4}-\d{2}-\d{2}/);
        expect(r.reason).not.toMatch(/never/i); // never claims "provably never"
    });

    it("currently paused on-chain -> red (verified, strongest signal)", () => {
        const r = assessRedemptionHistory(recWith(rh({ current_paused: bread(true) })));
        expect(r.flag).toBe("red");
        expect(r.confidence).toBe("verified");
        expect(r.reason).toMatch(/currently restricted on-chain/);
    });

    it("a registered MMF with no fee applied -> green + the gates-are-dead note", () => {
        const r = assessRedemptionHistory(recWith(rh({ current_paused: bread(null), current_frozen: bread(null), latest_fee_flag: feeRead(false) })));
        expect(r.flag).toBe("green");
        expect(r.confidence).toBe("verified"); // rests on the verified fee flag, not dragged by null pause reads
        expect(r.reason).toMatch(/gates are structurally unavailable/i);
    });

    it("a liquidity fee applied -> amber (verified structured), names the fee", () => {
        const r = assessRedemptionHistory(recWith(rh({ latest_fee_flag: feeRead(true), fee_events: [fee()] })));
        expect(r.flag).toBe("amber");
        expect(r.confidence).toBe("verified");
        expect(r.reason).toMatch(/liquidity fee was applied/);
    });

    it("an active curated incident -> red but AUTO confidence (curated never mints verified)", () => {
        const r = assessRedemptionHistory(recWith(rh({ incidents: [incident({ regime: "non_traded_reit", kind: "repurchase_cap" })] })));
        expect(r.flag).toBe("red");
        expect(r.confidence).toBe("auto");
        expect(r.reason).toMatch(/repurchase cap \(non traded reit\)/); // regime preserved, never rewritten as 40-Act
    });

    it("a resolved past incident -> amber, names kind/regime/resolution", () => {
        const r = assessRedemptionHistory(recWith(rh({ incidents: [incident({ resolved_at: "2026-01-10T00:00:00Z" })] })));
        expect(r.flag).toBe("amber");
        expect(r.confidence).toBe("auto");
        expect(r.reason).toMatch(/resolved 2026-01-10/);
    });

    it("never conflates: a live pause AND a fee both surface distinctly (pause wins the flag)", () => {
        const r = assessRedemptionHistory(recWith(rh({ current_paused: bread(true), latest_fee_flag: feeRead(true), fee_events: [fee()] })));
        expect(r.flag).toBe("red"); // the verified on-chain pause drives it
        expect(r.reason).toMatch(/on-chain/);
    });

    it("no basis at all -> unknown (never a blind green)", () => {
        const r = assessRedemptionHistory(recWith(rh({ current_paused: bread(null), current_frozen: bread(null), latest_fee_flag: feeRead(null) })));
        expect(r.flag).toBe("unknown");
    });

    it("no redemption_history_data -> unknown", () => {
        expect(assessRedemptionHistory(rec()).flag).toBe("unknown");
    });

    it("stale reads demote a green + carry a stale caveat", () => {
        const r = assessRedemptionHistory(recWith(rh({ current_paused: bread(false, "verified", daysAgo(4)), current_frozen: bread(false, "verified", daysAgo(4)), latest_fee_flag: feeRead(false, daysAgo(4)) })));
        expect(r.flag).not.toBe("green");
        expect(r.freshness).toBe("stale");
    });

    it("anti-laundering: an unverified underlying caps a would-be green", () => {
        const r = assessRedemptionHistory(recWith(rh({ underlying_ceiling: "amber" })));
        expect(r.flag).toBe("amber");
    });

    it("a month-old N-MFP fee flag stays green — monthly cadence, not the daily on-chain one", () => {
        // Registered MMF: no on-chain pause, fee flag from a filing ~20 days old.
        // Against a 24h cadence this would wrongly go stale/unknown; against the
        // monthly cadence a 20-day-old filing is live.
        const r = assessRedemptionHistory(
            recWith(rh({ current_paused: bread(null), current_frozen: bread(null), latest_fee_flag: feeRead(false, daysAgo(20)) })),
        );
        expect(r.flag).toBe("green");
        expect(r.freshness).toBe("live");
    });
});
