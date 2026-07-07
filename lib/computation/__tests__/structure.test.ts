import { assessStructure } from "@/lib/computation/structure";
import { f } from "./helpers";

const llm = { method: "llm_extracted" as const, confidence: "auto" as const, source: "llm:prospectus" };

describe("assessStructure", () => {
    it("unknown when wrapper is missing", () => {
        expect(assessStructure({}).flag).toBe("unknown");
    });

    it("green for a registered fund", () => {
        expect(assessStructure({ wrapper_type: f("registered_fund_40act", llm) }).flag).toBe("green");
    });

    it("amber for a private fund and includes the custodian", () => {
        const r = assessStructure({
            wrapper_type: f("private_fund", llm),
            custodian: f("BNY Mellon", llm),
        });
        expect(r.flag).toBe("amber");
        expect(r.reason).toMatch(/BNY Mellon/);
    });

    it("red for a mirror token", () => {
        expect(assessStructure({ wrapper_type: f("mirror_token", llm) }).flag).toBe("red");
    });

    it("red for unbacked", () => {
        expect(assessStructure({ wrapper_type: f("unbacked", llm) }).flag).toBe("red");
    });
});
