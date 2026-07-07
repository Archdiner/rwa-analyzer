import { reconcileFields } from "@/lib/ingestion/reconcile";
import type { FieldObject } from "@/lib/contracts";

function num(value: number, confidence: FieldObject["confidence"], source: string): FieldObject<number> {
    return { value, source, method: "reference_api", confidence, as_of: "2026-07-07T00:00:00Z", citation: null };
}

describe("reconcile demote-only invariant", () => {
    it("keeps a single contribution untouched", () => {
        const { fields, conflicts } = reconcileFields([{ fields: { aum: num(100, "verified", "a") } }]);
        expect(conflicts).toHaveLength(0);
        expect(fields.aum!.confidence).toBe("verified");
    });

    it("agreeing values keep the most-confident copy, no conflict", () => {
        const { fields, conflicts } = reconcileFields([
            { fields: { aum: num(100, "auto", "a") } },
            { fields: { aum: num(100.2, "verified", "b") } }, // within 0.5%
        ]);
        expect(conflicts).toHaveLength(0);
        expect(fields.aum!.confidence).toBe("verified");
    });

    it("disagreeing values record a conflict AND demote the survivor", () => {
        const { fields, conflicts } = reconcileFields([
            { fields: { aum: num(100, "verified", "a") } },
            { fields: { aum: num(140, "verified", "b") } }, // >0.5% apart
        ]);
        expect(conflicts).toHaveLength(1);
        expect(conflicts[0].sources).toEqual(["a", "b"]);
        // survivor demoted verified -> auto, never promoted
        expect(fields.aum!.confidence).toBe("auto");
    });

    it("never promotes: an auto survivor demotes to unverifiable on conflict", () => {
        const { fields } = reconcileFields([
            { fields: { aum: num(100, "auto", "a") } },
            { fields: { aum: num(200, "auto", "b") } },
        ]);
        expect(fields.aum!.confidence).toBe("unverifiable");
    });
});
