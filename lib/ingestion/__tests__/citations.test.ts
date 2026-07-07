import { validateCitation, enforceCitation, normalizeWhitespace } from "@/lib/ingestion/citations";
import type { FieldObject } from "@/lib/contracts";

const DOC = `
The Fund is offered only to qualified purchasers as defined under the
Investment Company Act. Redemptions may be processed on a daily basis,
subject to a cap of $50,000,000 per rolling 24-hour period.
`;

function llmField(textSpan: string | null, url = "https://issuer.example/prospectus.pdf"): FieldObject<string> {
    return {
        value: "us_qualified_purchaser",
        source: "llm:prospectus",
        method: "llm_extracted",
        confidence: "auto",
        as_of: "2026-07-07T00:00:00Z",
        citation: textSpan === null ? null : { url, text_span: textSpan },
    };
}

describe("normalizeWhitespace", () => {
    it("collapses newlines and repeated spaces", () => {
        expect(normalizeWhitespace("a  \n b\t c")).toBe("a b c");
    });
});

describe("validateCitation", () => {
    it("accepts a verbatim span present in the document", () => {
        expect(validateCitation(DOC, { url: "u", text_span: "offered only to qualified purchasers" })).toBe(true);
    });

    it("accepts a span that differs only in whitespace/newlines", () => {
        expect(
            validateCitation(DOC, { url: "u", text_span: "qualified purchasers as defined under the Investment Company Act" }),
        ).toBe(true);
    });

    it("rejects a hallucinated span not in the document", () => {
        expect(
            validateCitation(DOC, { url: "u", text_span: "backed one-to-one by physical gold in a Swiss vault" }),
        ).toBe(false);
    });

    it("rejects a missing citation", () => {
        expect(validateCitation(DOC, null)).toBe(false);
    });

    it("rejects a trivially short span", () => {
        expect(validateCitation(DOC, { url: "u", text_span: "the" })).toBe(false);
    });

    it("rejects a citation missing its url", () => {
        expect(validateCitation(DOC, { url: "", text_span: "offered only to qualified purchasers" })).toBe(false);
    });
});

describe("enforceCitation", () => {
    it("keeps an llm field whose citation validates", () => {
        const field = llmField("offered only to qualified purchasers");
        expect(enforceCitation(field, DOC).confidence).toBe("auto");
    });

    it("demotes an llm field with a hallucinated citation to unverifiable", () => {
        const field = llmField("guaranteed 20% APY with no risk");
        expect(enforceCitation(field, DOC).confidence).toBe("unverifiable");
    });

    it("demotes an llm field with no citation to unverifiable", () => {
        expect(enforceCitation(llmField(null), DOC).confidence).toBe("unverifiable");
    });

    it("demotes when there is no source text at all", () => {
        const field = llmField("offered only to qualified purchasers");
        expect(enforceCitation(field, null).confidence).toBe("unverifiable");
    });

    it("leaves non-llm fields untouched even with no source text", () => {
        const onchain: FieldObject<number> = {
            value: 2_510_000_000,
            source: "onchain",
            method: "onchain_read",
            confidence: "verified",
            as_of: "2026-07-07T00:00:00Z",
            citation: null,
        };
        expect(enforceCitation(onchain, null).confidence).toBe("verified");
    });
});
