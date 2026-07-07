// The confidence cap (contract rule 2) is code-enforced and easy to break
// subtly, so it is tested directly, at the dimension level.
import { assessStructure } from "@/lib/computation/structure";
import { computeAssessment } from "@/lib/computation";
import { f, ev, rec } from "./helpers";

describe("confidence cap invariant", () => {
    it("an auto (llm) input caps the dimension at auto and appends the label", () => {
        const r = assessStructure({
            wrapper_type: f("private_fund", { method: "llm_extracted", confidence: "auto", source: "llm:prospectus" }),
        });
        expect(r.confidence).toBe("auto");
        expect(r.reason).toMatch(/Based on auto-extracted data\./);
    });

    it("a verified (seeded) input keeps the dimension verified with no label", () => {
        const r = assessStructure({
            wrapper_type: f("registered_fund_40act", { method: "manual", confidence: "verified", source: "seed" }),
        });
        expect(r.confidence).toBe("verified");
        expect(r.reason).not.toMatch(/auto-extracted/);
    });

    it("an unverifiable input is treated as missing -> unknown", () => {
        const r = assessStructure({
            wrapper_type: f("mirror_token", { method: "llm_extracted", confidence: "unverifiable", source: "llm:prospectus" }),
        });
        expect(r.flag).toBe("unknown");
    });

    it("overall_confidence is the lowest dimension confidence used", () => {
        const record = rec(
            {
                // backing: fully verified -> green/verified
                supply: f(100),
                nav: f(1),
                // structure: llm auto -> caps overall at auto
                wrapper_type: f("private_fund", { method: "llm_extracted", confidence: "auto", source: "llm:prospectus" }),
            },
            // backing evidence: auditor-grade, on-chain read -> verified
            [ev({ independence: 4, reserves_value: 100, source: "chainlink_por" })],
        );
        const assessment = computeAssessment(record);
        expect(assessment.dimensions.backing.confidence).toBe("verified");
        expect(assessment.overall_confidence).toBe("auto");
    });
});
