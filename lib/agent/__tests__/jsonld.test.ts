import { assetJsonLd } from "@/lib/agent/jsonld";
import type { Assessment, NormalizedAssetRecord } from "@/lib/contracts";

function makeRecord(issuer?: string): NormalizedAssetRecord {
    return {
        identifiers: { name: "Test Fund", symbol: "TEST", chain_id: 1, contract_address: "0xabc", issuer_name: issuer },
    } as unknown as NormalizedAssetRecord;
}

function makeAssessment(): Assessment {
    return {
        computed_at: "2026-07-01T00:00:00Z",
        dimensions: { backing: { flag: "green", confidence: "verified", freshness: "live" } },
    } as unknown as Assessment;
}

describe("assetJsonLd", () => {
    it("sets dateModified to the assessment computed_at and core fields", () => {
        const out = assetJsonLd(makeRecord("Acme"), makeAssessment(), "https://x/a/1%3A0xabc");
        expect(out["@type"]).toBe("FinancialProduct");
        expect(out.name).toBe("Test Fund");
        expect(out.identifier).toBe("TEST");
        expect(out.url).toBe("https://x/a/1%3A0xabc");
        expect(out.dateModified).toBe("2026-07-01T00:00:00Z");
    });

    it("exposes backing tier/confidence/freshness as properties", () => {
        const out = assetJsonLd(makeRecord("Acme"), makeAssessment(), "u") as {
            additionalProperty: Array<{ name: string; value: string }>;
        };
        const byName = Object.fromEntries(out.additionalProperty.map((p) => [p.name, p.value]));
        expect(byName.backing_tier).toBe("green");
        expect(byName.backing_confidence).toBe("verified");
        expect(byName.backing_freshness).toBe("live");
    });

    it("emits provider only when the issuer is known", () => {
        const withIssuer = assetJsonLd(makeRecord("Acme"), makeAssessment(), "u");
        expect(withIssuer.provider).toEqual({ "@type": "Organization", name: "Acme" });

        const without = assetJsonLd(makeRecord(undefined), makeAssessment(), "u");
        expect(without.provider).toBeUndefined();
    });
});
