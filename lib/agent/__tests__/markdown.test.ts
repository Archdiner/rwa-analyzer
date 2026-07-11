import { renderVerdictMarkdown } from "@/lib/agent/markdown";
import type { AgentVerdict } from "@/lib/agent/verdict";

function verdict(overrides: Partial<AgentVerdict> = {}): AgentVerdict {
    return {
        asset: { asset_id: "1:0xabc", symbol: "TEST", name: "Test Fund", issuer_name: "Acme" },
        backing: {
            tier: "verified_backed",
            confidence: "verified",
            freshness: "live",
            next_expected_update: null,
            reason: "reconciles",
            meaning: "fully backed and verified",
            trust_boundary: "SEC N-MFP filing",
            caveats: ["watch redemption gates"],
        },
        dimensions: {},
        evidence: [],
        provider_url: null,
        as_of: "2026-07-01T00:00:00Z",
        disclaimer: "Public facts, not financial advice.",
        ...overrides,
    } as unknown as AgentVerdict;
}

describe("renderVerdictMarkdown", () => {
    it("renders the header, axes, meaning, and caveats", () => {
        const md = renderVerdictMarkdown(verdict());
        expect(md).toContain("# TEST - backing verdict");
        expect(md).toContain("Test Fund");
        expect(md).toContain("Acme");
        expect(md).toContain("verified_backed");
        expect(md).toContain("fully backed and verified");
        expect(md).toContain("SEC N-MFP filing");
        expect(md).toContain("watch redemption gates");
        expect(md).toContain("Public facts, not financial advice.");
    });

    it("handles null freshness and no caveats without emitting empty sections", () => {
        const md = renderVerdictMarkdown(
            verdict({
                backing: {
                    tier: "unverifiable",
                    confidence: "unverifiable",
                    freshness: null,
                    next_expected_update: null,
                    reason: "",
                    meaning: "cannot verify",
                    trust_boundary: null,
                    caveats: [],
                },
            } as Partial<AgentVerdict>),
        );
        expect(md).toContain("| freshness | n/a |");
        expect(md).not.toContain("Caveats");
        expect(md).not.toContain("Trust boundary");
    });
});
