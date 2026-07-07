// The agent contract's whole value is that the caveat can't be dropped. These
// test the invariants that make it un-collapsible: no boolean, two axes, and
// caveats that are non-empty unless the verdict is fully verified.
import { toAgentVerdict, type AgentVerdict } from "@/lib/agent/verdict";
import type { Assessment, DimensionAssessment, EvidenceItem, Flag, Confidence, NormalizedAssetRecord } from "@/lib/contracts";

function dim(flag: Flag, confidence: Confidence, reason = "r"): DimensionAssessment {
    return { flag, reason, inputs: [], confidence, sources: [] };
}

function assessment(backing: DimensionAssessment): Assessment {
    return {
        asset_id: "1:0xabc",
        overall_confidence: backing.confidence,
        dimensions: {
            backing,
            redemption: dim("unknown", "unverifiable"),
            access: dim("unknown", "unverifiable"),
            structure: dim("unknown", "unverifiable"),
        },
        computed_at: "2026-07-01T00:00:00Z",
    };
}

function record(evidence: EvidenceItem[] = [], qualitativePending = false): NormalizedAssetRecord {
    return {
        asset_id: "1:0xabc",
        identifiers: { name: "Test Asset", symbol: "TEST", chain_id: 1, contract_address: "0xabc", issuer_name: "Issuer" },
        fields: {},
        backing_evidence: evidence,
        tokenization_mode: "fully_tokenized",
        conflicts: [],
        ingested_at: "2026-07-01T00:00:00Z",
        qualitative_pending: qualitativePending,
    };
}

function ev(source_type: EvidenceItem["source_type"], independence: number, confidence: Confidence): EvidenceItem {
    return {
        source_type,
        independence,
        reserves_value: 100,
        coverage_pct: 100,
        as_of: "2026-07-01T00:00:00Z",
        extraction: "structured",
        confidence,
        parse_confidence: null,
        citation: null,
        source: "test",
    };
}

describe("toAgentVerdict — un-collapsible contract", () => {
    it("never emits a `safe` boolean anywhere in the payload", () => {
        const v = toAgentVerdict(record([ev("regulator_filing", 5, "verified")]), assessment(dim("green", "verified")));
        const json = JSON.stringify(v);
        expect(json).not.toMatch(/"safe"/);
        expect(json).not.toMatch(/"is_safe"/);
    });

    it("exposes both axes: tier AND confidence", () => {
        const v = toAgentVerdict(record([ev("regulator_filing", 5, "verified")]), assessment(dim("green", "auto")));
        expect(v.backing.tier).toBe("verified_backed");
        expect(v.backing.confidence).toBe("auto"); // green + auto is a real, distinct cell
    });

    it("maps every flag to a non-boolean tier", () => {
        const cases: [Flag, AgentVerdict["backing"]["tier"]][] = [
            ["green", "verified_backed"],
            ["amber", "partially_verified"],
            ["red", "does_not_reconcile"],
            ["unknown", "unverifiable"],
        ];
        for (const [flag, tier] of cases) {
            const v = toAgentVerdict(record(), assessment(dim(flag, "verified")));
            expect(v.backing.tier).toBe(tier);
        }
    });

    it("caveats are non-empty for anything short of fully verified", () => {
        expect(toAgentVerdict(record(), assessment(dim("unknown", "unverifiable"))).backing.caveats.length).toBeGreaterThan(0);
        expect(toAgentVerdict(record(), assessment(dim("amber", "verified"))).backing.caveats.length).toBeGreaterThan(0);
        expect(toAgentVerdict(record(), assessment(dim("red", "verified"))).backing.caveats.length).toBeGreaterThan(0);
        // green but only auto confidence must still caveat (check the citation)
        expect(
            toAgentVerdict(record([ev("regulator_filing", 5, "auto")]), assessment(dim("green", "auto"))).backing.caveats
                .length,
        ).toBeGreaterThan(0);
    });

    it("a fully-verified green with no pending fields may have no caveats", () => {
        const v = toAgentVerdict(record([ev("regulator_filing", 5, "verified")]), assessment(dim("green", "verified")));
        expect(v.backing.caveats.length).toBe(0);
    });

    it("names a trust boundary from the strongest evidence, and unknown says absence != safety", () => {
        const green = toAgentVerdict(record([ev("regulator_filing", 5, "verified")]), assessment(dim("green", "verified")));
        expect(green.backing.trust_boundary).toMatch(/regulator-verified fund/i);

        const unknown = toAgentVerdict(record(), assessment(dim("unknown", "unverifiable")));
        expect(unknown.backing.trust_boundary).toBeNull();
        expect(unknown.backing.meaning).toMatch(/not a green light/i);
    });
});
