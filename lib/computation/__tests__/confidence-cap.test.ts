// The confidence cap (contract rule 2) is code-enforced and easy to break
// subtly, so it is tested directly, at the dimension level.
import { assessStructure } from "@/lib/computation/structure";
import { computeAssessment } from "@/lib/computation";
import type { NormalizedAssetRecord } from "@/lib/contracts";
import { f } from "./helpers";

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
        const record: NormalizedAssetRecord = {
            asset_id: "1:0x0000000000000000000000000000000000000001",
            identifiers: { name: "T", symbol: "T", chain_id: 1, contract_address: "0x0000000000000000000000000000000000000001" },
            fields: {
                // backing: fully verified -> green/verified
                supply: f(100),
                nav: f(1),
                reserves_value: f(100, { source: "chainlink_por" }),
                reserves_method: f("auditor_attested", { method: "reference_api" }),
                // structure: llm auto -> caps overall at auto
                wrapper_type: f("private_fund", { method: "llm_extracted", confidence: "auto", source: "llm:prospectus" }),
            },
            conflicts: [],
            ingested_at: new Date().toISOString(),
        };
        const assessment = computeAssessment(record);
        expect(assessment.dimensions.backing.confidence).toBe("verified");
        expect(assessment.overall_confidence).toBe("auto");
    });
});
