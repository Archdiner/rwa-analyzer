import { assessAccess } from "@/lib/computation/access";
import { f } from "./helpers";

const llm = { method: "llm_extracted" as const, confidence: "auto" as const, source: "llm:terms" };

describe("assessAccess", () => {
    it("unknown when nothing is known", () => {
        expect(assessAccess({}).flag).toBe("unknown");
    });

    it("green for permissionless", () => {
        expect(assessAccess({ jurisdiction: f("permissionless", llm) }).flag).toBe("green");
    });

    it("green for us_retail with a low minimum", () => {
        expect(
            assessAccess({ jurisdiction: f("us_retail", llm), min_investment_usd: f(100, { method: "reference_api" }) }).flag,
        ).toBe("green");
    });

    it("amber for us_retail with a high minimum", () => {
        expect(
            assessAccess({ jurisdiction: f("us_retail", llm), min_investment_usd: f(50000, { method: "reference_api" }) }).flag,
        ).toBe("amber");
    });

    it("amber for non_us_only", () => {
        expect(assessAccess({ jurisdiction: f("non_us_only", llm) }).flag).toBe("amber");
    });

    it("red for us_qualified_purchaser", () => {
        expect(assessAccess({ jurisdiction: f("us_qualified_purchaser", llm) }).flag).toBe("red");
    });

    it("access red reads as eligibility, not danger", () => {
        const r = assessAccess({ jurisdiction: f("us_accredited", llm) });
        expect(r.flag).toBe("red");
        expect(r.reason).toMatch(/eligibility restriction \(not a risk warning\)/i);
    });

    it("amber when only KYC is known", () => {
        expect(assessAccess({ kyc_required: f(true) }).flag).toBe("amber");
    });
});
