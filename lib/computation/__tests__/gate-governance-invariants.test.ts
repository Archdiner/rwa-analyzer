// ---------------------------------------------------------------------------
// Cross-cutting honesty invariants for the v1.3 dimensions
// ---------------------------------------------------------------------------
// The single place that locks "never fake a green, never conflate, unknown is
// valid" for governance + redemption_history, the way yield-risk-invariants.ts
// locks the v1.2 dimensions. Property-style; canary-verified (breaking a rule in
// the source fails exactly its block).
// ---------------------------------------------------------------------------

import { assessGovernance } from "@/lib/computation/governance";
import { assessRedemptionHistory } from "@/lib/computation/redemption-history";
import type { Confidence, DimensionRead, Flag, GovernanceData, NormalizedAssetRecord, RedemptionHistoryData, RedemptionIncident } from "@/lib/contracts";
import { rec, daysAgo } from "./helpers";

function r<T extends number | boolean | string>(value: T | null, confidence: Confidence = "verified", as_of = new Date().toISOString()): DimensionRead<T> {
    return { value, source: "onchain", method: "onchain_read", confidence, as_of };
}

/** Governance fixture that scores green unmodified (timelock, 48h). */
function gov(o: Partial<GovernanceData> = {}): GovernanceData {
    return {
        proxy_pattern: r<string>("transparent"),
        is_upgradeable: r<boolean>(true),
        admin_type: r<string>("timelock"),
        admin_address: r<string>("0xad"),
        multisig_threshold: r<number>(null),
        multisig_owner_count: r<number>(null),
        timelock_delay_seconds: r<number>(172800),
        pause_power: r<boolean>(false),
        ...o,
    };
}
const withGov = (d: GovernanceData): NormalizedAssetRecord => ({ ...rec(), governance_data: d });

/** Redemption fixture that scores green unmodified (not paused, none on record). */
function rh(o: Partial<RedemptionHistoryData> = {}): RedemptionHistoryData {
    return {
        current_paused: r<boolean>(false),
        current_frozen: r<boolean>(false),
        latest_fee_flag: { value: false, source: "SEC EDGAR N-MFP", method: "reference_api", confidence: "verified", as_of: new Date().toISOString() },
        fee_events: [],
        incidents: [],
        ...o,
    };
}
const withRh = (d: RedemptionHistoryData): NormalizedAssetRecord => ({ ...rec(), redemption_history_data: d });
const incident = (o: Partial<RedemptionIncident> = {}): RedemptionIncident => ({ as_of: "2025-11-04T00:00:00Z", kind: "suspension", regime: "onchain_contract", source: "post-mortem", citation: null, ...o });

describe("baseline: the unmodified fixtures ARE green", () => {
    it("so every 'not green' assertion is meaningful", () => {
        expect(assessGovernance(withGov(gov())).flag).toBe("green");
        expect(assessRedemptionHistory(withRh(rh())).flag).toBe("green");
    });
});

describe("(a) no governance green without a verified control read", () => {
    it("undetermined upgradeability (no markers) is unknown, never a false immutable green", () => {
        expect(assessGovernance(withGov(gov({ is_upgradeable: r<boolean>(null), admin_type: r<string>("unknown") }))).flag).toBe("unknown");
    });
    it("upgradeable with an unclassifiable admin is never green", () => {
        expect(assessGovernance(withGov(gov({ admin_type: r<string>("contract_unknown"), timelock_delay_seconds: r<number>(null) }))).flag).not.toBe("green");
    });
});

describe("(b) an EOA over an upgradeable proxy is always red", () => {
    it.each([
        ["with a pause power", { pause_power: r<boolean>(true) }],
        ["uups pattern", { proxy_pattern: r<string>("uups") }],
        ["with a stale read", { is_upgradeable: r<boolean>(true, "verified", daysAgo(1)) }],
    ])("EOA admin %s -> red", (_l, extra) => {
        expect(assessGovernance(withGov(gov({ admin_type: r<string>("eoa"), timelock_delay_seconds: r<number>(null), ...extra }))).flag).toBe("red");
    });
});

describe("(c) no redemption_history green while currently paused/frozen", () => {
    it.each([
        ["paused", { current_paused: r<boolean>(true) }],
        ["frozen", { current_frozen: r<boolean>(true) }],
    ])("currently %s -> not green (red)", (_l, over) => {
        const f = assessRedemptionHistory(withRh(rh(over))).flag;
        expect(f).toBe("red");
    });
});

describe("(d) a redemption_history green is absence-scoped and never rests on a curated signal", () => {
    it("green wording is 'as of {date}', never an absolute 'never'", () => {
        const v = assessRedemptionHistory(withRh(rh()));
        expect(v.flag).toBe("green");
        expect(v.reason).toMatch(/as of \d{4}-\d{2}-\d{2}/);
        expect(v.reason).not.toMatch(/never/i);
    });
    it("a curated incident never produces a green (it only demotes), and never a verified confidence", () => {
        const v = assessRedemptionHistory(withRh(rh({ incidents: [incident()] })));
        expect(v.flag).not.toBe("green");
        expect(v.confidence).toBe("auto"); // curated → capped at auto, never verified
    });
});

describe("(e) the three redemption signals never conflate", () => {
    it("a live pause and a curated incident do not merge into one flag — the verified pause drives red", () => {
        const v = assessRedemptionHistory(withRh(rh({ current_paused: r<boolean>(true), incidents: [incident()] })));
        expect(v.flag).toBe("red");
        expect(v.confidence).toBe("verified"); // driven by the verified on-chain read, not the curated incident
        expect(v.reason).toMatch(/on-chain/);
    });
});

describe("(f) regime is never rewritten", () => {
    it("a non-traded-REIT repurchase cap is surfaced as its own regime, never as a 40-Act suspension", () => {
        const v = assessRedemptionHistory(withRh(rh({ incidents: [incident({ kind: "repurchase_cap", regime: "non_traded_reit" })] })));
        expect(v.reason).toMatch(/non traded reit/);
        expect(v.reason).not.toMatch(/40-act|ic40|money market/i);
    });
});

describe("(g) both dimensions honor freshness + the anti-laundering ceiling", () => {
    it("a stale governance read demotes its green", () => {
        const v = assessGovernance(withGov(gov({ is_upgradeable: r<boolean>(true, "verified", daysAgo(4)), admin_type: r<string>("timelock", "verified", daysAgo(4)) })));
        expect(v.flag).not.toBe("green");
        expect(v.freshness).toBe("stale");
    });
    it("a stale redemption read demotes its green", () => {
        const v = assessRedemptionHistory(withRh(rh({ current_paused: r<boolean>(false, "verified", daysAgo(4)), current_frozen: r<boolean>(false, "verified", daysAgo(4)), latest_fee_flag: { value: false, source: "SEC EDGAR N-MFP", method: "reference_api", confidence: "verified", as_of: daysAgo(4) } })));
        expect(v.flag).not.toBe("green");
        expect(v.freshness).toBe("stale");
    });
    it.each(["amber", "red", "unknown"] as Flag[])("an underlying ceiling of %s caps a would-be green on both dimensions", (ceiling) => {
        expect(assessGovernance(withGov(gov({ underlying_ceiling: ceiling }))).flag).not.toBe("green");
        expect(assessRedemptionHistory(withRh(rh({ underlying_ceiling: ceiling }))).flag).not.toBe("green");
    });
});
