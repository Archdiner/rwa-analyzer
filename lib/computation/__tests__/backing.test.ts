import { assessBacking } from "@/lib/computation/backing";
import type { EvidenceItem, FieldMap } from "@/lib/contracts";
import { f, ev, rec, daysAgo } from "./helpers";

const fresh = () => new Date().toISOString();

// A fully-backed, auditor-grade (independence 4) evidence set that reconciles.
function base(fieldOverrides: FieldMap = {}, evidence?: EvidenceItem[]) {
    const fields: FieldMap = { supply: f(100), nav: f(1), ...fieldOverrides };
    const backing = evidence ?? [ev({ independence: 4, reserves_value: 100, source: "chainlink_por", as_of: fresh() })];
    return rec(fields, backing);
}

describe("assessBacking", () => {
    it("unknown when nav is missing (never a false green off 1.00)", () => {
        expect(assessBacking(base({ nav: undefined })).flag).toBe("unknown");
    });

    it("unknown when supply is missing", () => {
        expect(assessBacking(base({ supply: undefined })).flag).toBe("unknown");
    });

    it("red when there is no usable reserve evidence", () => {
        expect(assessBacking(base({}, [])).flag).toBe("red");
    });

    it("red when reserves diverge beyond tolerance", () => {
        expect(assessBacking(base({}, [ev({ independence: 4, reserves_value: 80 })])).flag).toBe("red");
    });

    it("green when independent, reconciling, and fresh", () => {
        const r = assessBacking(base());
        expect(r.flag).toBe("green");
        expect(r.confidence).toBe("verified");
    });

    it("amber when reserves are self-reported (independence 1)", () => {
        expect(assessBacking(base({}, [ev({ independence: 1, reserves_value: 100 })])).flag).toBe("amber");
    });

    it("amber with 'unconfirmed' wording when method is unclassified (independence 2)", () => {
        const r = assessBacking(base({}, [ev({ independence: 2, reserves_value: 100 })]));
        expect(r.flag).toBe("amber");
        expect(r.reason).toMatch(/unconfirmed/i);
    });

    it("downgrades green to amber when reserve data is stale", () => {
        const r = assessBacking(base({}, [ev({ independence: 4, reserves_value: 100, as_of: daysAgo(10) })]));
        expect(r.flag).toBe("amber");
        expect(r.reason).toMatch(/stale/i);
    });

    it("treats an unverifiable evidence item as missing (red)", () => {
        const r = assessBacking(base({}, [ev({ independence: 4, reserves_value: 100, confidence: "unverifiable" })]));
        expect(r.flag).toBe("red");
    });

    it("parse-confidence FLOOR: a low-confidence parsed figure cannot carry a green", () => {
        const r = assessBacking(
            base({}, [
                ev({
                    independence: 4,
                    reserves_value: 100,
                    extraction: "llm_extracted",
                    confidence: "auto",
                    parse_confidence: 0.5,
                    citation: { url: "https://x", text_span: "reserves $100" },
                }),
            ]),
        );
        expect(r.flag).toBe("amber");
    });
});
