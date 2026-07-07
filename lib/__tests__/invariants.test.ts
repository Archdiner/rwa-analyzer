import { minConfidence, demoteConfidence, coverageTier, CONFIDENCE_RANK } from "@/lib/contracts";

describe("minConfidence (verdict confidence cap, rule 2)", () => {
    it("an auto input caps a verified-heavy verdict at auto", () => {
        expect(minConfidence("verified", "verified", "auto")).toBe("auto");
    });

    it("any unverifiable input caps at unverifiable", () => {
        expect(minConfidence("verified", "auto", "unverifiable")).toBe("unverifiable");
    });

    it("all-verified stays verified", () => {
        expect(minConfidence("verified", "verified")).toBe("verified");
    });

    it("empty input list is unverifiable (nothing to trust)", () => {
        expect(minConfidence()).toBe("unverifiable");
    });

    it("respects the trust ordering unverifiable < auto < verified", () => {
        expect(CONFIDENCE_RANK.unverifiable).toBeLessThan(CONFIDENCE_RANK.auto);
        expect(CONFIDENCE_RANK.auto).toBeLessThan(CONFIDENCE_RANK.verified);
    });
});

describe("demoteConfidence (reconcile only ever steps down)", () => {
    it("verified -> auto", () => {
        expect(demoteConfidence("verified")).toBe("auto");
    });

    it("auto -> unverifiable", () => {
        expect(demoteConfidence("auto")).toBe("unverifiable");
    });

    it("unverifiable stays at the floor", () => {
        expect(demoteConfidence("unverifiable")).toBe("unverifiable");
    });
});

describe("coverageTier", () => {
    it("maps confidence to the user-facing tier", () => {
        expect(coverageTier("verified")).toBe("Verified");
        expect(coverageTier("auto")).toBe("Auto");
        expect(coverageTier("unverifiable")).toBe("Unverifiable");
    });
});
