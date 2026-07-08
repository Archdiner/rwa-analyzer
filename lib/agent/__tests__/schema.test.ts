// Drift guard: the published JSON Schema must match the actual AgentVerdict the
// engine emits. If a field is added to the verdict but not the schema (or vice
// versa), this fails - so integrators are never handed a stale contract.
import { AGENT_VERDICT_SCHEMA } from "@/lib/agent/schema";
import { toAgentVerdict } from "@/lib/agent/verdict";
import { computeAssessment } from "@/lib/computation";
import { f, ev, rec } from "@/lib/computation/__tests__/helpers";

function sampleVerdict() {
    const record = rec(
        { supply: f(100), nav: f(1) },
        [ev({ source_type: "regulator_filing", independence: 5, reserves_value: 100, extraction: "structured" })],
        "fully_tokenized",
    );
    return toAgentVerdict(record, computeAssessment(record));
}

describe("AgentVerdict JSON schema stays in sync with the contract", () => {
    it("top-level keys match the schema's properties exactly", () => {
        const v = sampleVerdict();
        expect(Object.keys(v).sort()).toEqual(Object.keys(AGENT_VERDICT_SCHEMA.properties).sort());
    });

    it("backing keys match the schema's backing properties exactly", () => {
        const v = sampleVerdict();
        expect(Object.keys(v.backing).sort()).toEqual(
            Object.keys(AGENT_VERDICT_SCHEMA.properties.backing.properties).sort(),
        );
    });

    it("an emitted evidence item declares only schema-known keys", () => {
        const v = sampleVerdict();
        const known = new Set(Object.keys(AGENT_VERDICT_SCHEMA.properties.evidence.items.properties));
        for (const item of v.evidence) {
            for (const key of Object.keys(item)) expect(known.has(key)).toBe(true);
        }
    });

    it("declares the un-collapsible tier + confidence enums", () => {
        expect(AGENT_VERDICT_SCHEMA.properties.backing.properties.tier.enum).toContain("verified_backed");
        expect(AGENT_VERDICT_SCHEMA.properties.backing.properties.confidence.enum).toContain("auto");
        // the whole point: there is no boolean safe field in the contract
        expect(JSON.stringify(AGENT_VERDICT_SCHEMA)).not.toMatch(/"safe"|"is_safe"/);
    });
});
