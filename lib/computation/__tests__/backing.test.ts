import { assessBacking } from "@/lib/computation/backing";
import type { FieldMap } from "@/lib/contracts";
import { f, daysAgo } from "./helpers";

const fresh = () => new Date().toISOString();

function base(overrides: FieldMap = {}): FieldMap {
    return {
        supply: f(100),
        nav: f(1),
        reserves_value: f(100, { source: "chainlink_por", as_of: fresh() }),
        reserves_method: f("auditor_attested", { source: "chainlink_registry", method: "reference_api" }),
        ...overrides,
    };
}

describe("assessBacking", () => {
    it("unknown when nav is missing (never a false green off 1.00)", () => {
        const { nav: _nav, ...rest } = base();
        void _nav;
        expect(assessBacking(rest).flag).toBe("unknown");
    });

    it("unknown when supply is missing", () => {
        const { supply: _s, ...rest } = base();
        void _s;
        expect(assessBacking(rest).flag).toBe("unknown");
    });

    it("red when there is no reserve data", () => {
        const { reserves_value: _r, reserves_method: _m, ...rest } = base();
        void _r;
        void _m;
        expect(assessBacking(rest).flag).toBe("red");
    });

    it("red when reserves_method is none", () => {
        expect(assessBacking(base({ reserves_method: f("none", { method: "reference_api" }) })).flag).toBe("red");
    });

    it("red when reserves diverge beyond tolerance", () => {
        expect(assessBacking(base({ reserves_value: f(80, { source: "chainlink_por" }) })).flag).toBe("red");
    });

    it("green when auditor-attested, reconciling, and fresh", () => {
        const r = assessBacking(base());
        expect(r.flag).toBe("green");
        expect(r.confidence).toBe("verified");
    });

    it("amber when reserves are self-reported", () => {
        expect(assessBacking(base({ reserves_method: f("self_reported", { method: "reference_api" }) })).flag).toBe("amber");
    });

    it("amber with 'unconfirmed' wording when method is unknown", () => {
        const r = assessBacking(base({ reserves_method: f("unknown", { method: "reference_api" }) }));
        expect(r.flag).toBe("amber");
        expect(r.reason).toMatch(/unconfirmed/i);
    });

    it("downgrades green to amber when reserve data is stale", () => {
        const r = assessBacking(base({ reserves_value: f(100, { source: "chainlink_por", as_of: daysAgo(10) }) }));
        expect(r.flag).toBe("amber");
        expect(r.reason).toMatch(/stale/i);
    });

    it("treats an unverifiable reserve field as missing (red)", () => {
        const r = assessBacking(base({ reserves_value: f(100, { source: "chainlink_por", confidence: "unverifiable" }) }));
        expect(r.flag).toBe("red");
    });
});
