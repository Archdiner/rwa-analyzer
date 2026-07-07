import { assessRedemption } from "@/lib/computation/redemption";
import { f } from "./helpers";

const llm = { method: "llm_extracted" as const, confidence: "auto" as const, source: "llm:terms" };

describe("assessRedemption", () => {
    it("unknown when speed is missing", () => {
        expect(assessRedemption({}).flag).toBe("unknown");
    });

    it("green for instant", () => {
        expect(assessRedemption({ redemption_speed: f("instant", llm) }).flag).toBe("green");
    });

    it("amber for instant_capped and surfaces the cap", () => {
        const r = assessRedemption({
            redemption_speed: f("instant_capped", llm),
            redemption_cap: f("50000000_per_24h", llm),
        });
        expect(r.flag).toBe("amber");
        expect(r.reason).toMatch(/\$50M per 24h/);
    });

    it("amber for daily", () => {
        expect(assessRedemption({ redemption_speed: f("daily", llm) }).flag).toBe("amber");
    });

    it("amber for t_plus_n", () => {
        expect(assessRedemption({ redemption_speed: f("t_plus_n", llm) }).flag).toBe("amber");
    });

    it("red for none", () => {
        expect(assessRedemption({ redemption_speed: f("none", llm) }).flag).toBe("red");
    });

    it("carries auto confidence + label when the input is llm-extracted", () => {
        const r = assessRedemption({ redemption_speed: f("instant", llm) });
        expect(r.confidence).toBe("auto");
        expect(r.reason).toMatch(/Based on auto-extracted data\./);
    });
});
