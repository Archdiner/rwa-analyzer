// Freshness axis: gradient (not a cliff), per-source cadence, demote-only, and
// the BENJI canary (tranche + fresh regulator filing => green) that guards the
// whole flagship path.
import { freshnessOf, applyFreshness, nextExpectedUpdate } from "@/lib/computation/freshness";
import { assessBacking } from "@/lib/computation/backing";
import { f, ev, rec, daysAgo } from "./helpers";

describe("freshnessOf - age relative to cadence", () => {
    it("live within cadence, aging at 1-2x, stale beyond 2x", () => {
        // regulator_filing cadence = 35 days.
        expect(freshnessOf(ev({ source_type: "regulator_filing", independence: 5, reserves_value: 1, as_of: daysAgo(10) })).level).toBe("live");
        expect(freshnessOf(ev({ source_type: "regulator_filing", independence: 5, reserves_value: 1, as_of: daysAgo(50) })).level).toBe("aging");
        expect(freshnessOf(ev({ source_type: "regulator_filing", independence: 5, reserves_value: 1, as_of: daysAgo(90) })).level).toBe("stale");
    });

    it("is per-cadence: 20-day-old oracle feed is stale, 20-day-old filing is live", () => {
        expect(freshnessOf(ev({ source_type: "oracle_por", independence: 4, reserves_value: 1, as_of: daysAgo(20) })).level).toBe("stale");
        expect(freshnessOf(ev({ source_type: "regulator_filing", independence: 5, reserves_value: 1, as_of: daysAgo(20) })).level).toBe("live");
    });

    it("honors a per-item cadence_ms override (N-CSR ~183d)", () => {
        const semiannual = ev({ source_type: "regulator_filing", independence: 5, reserves_value: 1, as_of: daysAgo(100) });
        semiannual.cadence_ms = 183 * 24 * 60 * 60 * 1000;
        expect(freshnessOf(semiannual).level).toBe("live");
    });

    it("next_expected is clock-independent (as_of + cadence)", () => {
        const item = ev({ source_type: "regulator_filing", independence: 5, reserves_value: 1, as_of: "2026-06-30T00:00:00Z" });
        // 2026-06-30 + 35 days = 2026-08-04
        expect(nextExpectedUpdate(item).slice(0, 10)).toBe("2026-08-04");
    });
});

describe("applyFreshness - demote only, never promote", () => {
    it("live is a no-op", () => {
        const r = applyFreshness("green", "ok", ev({ source_type: "regulator_filing", independence: 5, reserves_value: 1, as_of: daysAgo(1) }));
        expect(r).toEqual({ flag: "green", reason: "ok", freshness: "live" });
    });

    it("aging adds a note but does not downgrade", () => {
        const r = applyFreshness("green", "ok", ev({ source_type: "oracle_por", independence: 4, reserves_value: 1, as_of: daysAgo(1.5) }));
        expect(r.flag).toBe("green");
        expect(r.freshness).toBe("aging");
        expect(r.reason).toMatch(/aging/i);
    });

    it("stale (2-3x) downgrades exactly one notch", () => {
        const r = applyFreshness("green", "ok", ev({ source_type: "oracle_por", independence: 4, reserves_value: 1, as_of: daysAgo(2.5) }));
        expect(r.flag).toBe("amber");
        expect(r.freshness).toBe("stale");
    });

    it("very stale (>3x) drops to unknown", () => {
        const r = applyFreshness("green", "ok", ev({ source_type: "oracle_por", independence: 4, reserves_value: 1, as_of: daysAgo(10) }));
        expect(r.flag).toBe("unknown");
    });

    it("never promotes: an amber stays at best amber", () => {
        const r = applyFreshness("amber", "ok", ev({ source_type: "oracle_por", independence: 2, reserves_value: 1, as_of: daysAgo(0) }));
        expect(r.flag).toBe("amber");
    });
});

describe("assessBacking - freshness end-to-end", () => {
    const fresh = () => new Date().toISOString();
    const reg = (as_of: string) =>
        ev({ source_type: "regulator_filing", independence: 5, reserves_value: 753_000_000, extraction: "structured", as_of });

    it("BENJI canary: tranche + fresh regulator filing + NAV $1 => green/verified/live", () => {
        const record = rec({ nav: f(1) }, [reg(fresh())], "tranche_of_registered_fund");
        const r = assessBacking(record);
        expect(r.flag).toBe("green");
        expect(r.confidence).toBe("verified");
        expect(r.freshness).toBe("live");
    });

    it("BENJI stays green while the filing is within monthly cadence", () => {
        const record = rec({ nav: f(1) }, [reg(daysAgo(20))], "tranche_of_registered_fund");
        expect(assessBacking(record).flag).toBe("green");
    });

    it("BENJI green ages (note) then goes stale as filings lapse", () => {
        const aging = assessBacking(rec({ nav: f(1) }, [reg(daysAgo(50))], "tranche_of_registered_fund"));
        expect(aging.flag).toBe("green");
        expect(aging.freshness).toBe("aging");

        const stale = assessBacking(rec({ nav: f(1) }, [reg(daysAgo(80))], "tranche_of_registered_fund"));
        expect(stale.flag).toBe("amber");
        expect(stale.freshness).toBe("stale");
    });
});
