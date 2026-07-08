// Attestation lane (Part B): coverage without diluting the SEC moat.
// The pure builder holds the citation/confidence logic; the invariants are
// checked end-to-end through the real resolver + agent verdict.
import { buildAttestationContribution, type AttestationExtraction } from "@/lib/ingestion/adapters/attestation";
import type { AttestationEntry } from "@/lib/ingestion/adapters/attestation-registry";
import { assessBacking } from "@/lib/computation/backing";
import { computeAssessment } from "@/lib/computation";
import { toAgentVerdict } from "@/lib/agent/verdict";
import { f, rec } from "@/lib/computation/__tests__/helpers";

const DAY = 24 * 60 * 60 * 1000;
const freshIso = () => new Date(Date.now() - DAY).toISOString();

const ENTRY: AttestationEntry = {
    doc_url: "https://example.test/ousg-attestation.pdf",
    administrator_name: "Ankura Trust",
    cadence_ms: 35 * DAY,
    verified_at: "2026-07-08",
    verified_against: "https://ondo.finance/ousg",
};

// A realistic attestation body the spans must quote verbatim.
const DOC =
    "Independent Attestation. As of the reporting date, the Fund's total net assets " +
    "were $625,000,000. The net asset value per share was $109.00. Prepared by Ankura Trust.";

function extraction(over: Partial<AttestationExtraction> = {}): AttestationExtraction {
    return {
        found: true,
        total_net_assets_usd: 625_000_000,
        total_net_assets_span: "total net assets were $625,000,000",
        nav_per_share_usd: 109,
        nav_per_share_span: "net asset value per share was $109.00",
        as_of_date: freshIso(),
        parse_confidence: 0.95,
        ...over,
    };
}

// supply x $109 ~ $625M, so the on-chain float reconciles with the attestation.
const RECONCILING_SUPPLY = 5_733_945; // * 109 = 625,000,005

describe("buildAttestationContribution (pure)", () => {
    it("emits an auditor_attestation evidence item at auto confidence with a citation", () => {
        const r = buildAttestationContribution(extraction(), DOC, ENTRY);
        const item = r.backing_evidence![0];
        expect(item.source_type).toBe("auditor_attestation");
        expect(item.independence).toBe(4);
        expect(item.extraction).toBe("llm_extracted");
        expect(item.confidence).toBe("auto"); // llm => never verified
        expect(item.citation?.text_span).toMatch(/625,000,000/);
        expect(item.cadence_ms).toBe(35 * DAY);
        expect(r.fields.nav?.value).toBe(109);
        expect(r.fields.nav?.confidence).toBe("auto");
    });

    it("demotes a non-verbatim reserves citation to unverifiable (never a false green)", () => {
        const r = buildAttestationContribution(
            extraction({ total_net_assets_span: "total net assets were $999,999,999" }),
            DOC,
            ENTRY,
        );
        expect(r.backing_evidence![0].confidence).toBe("unverifiable");
    });

    it("omits NAV when the document does not state a per-share value", () => {
        const r = buildAttestationContribution(
            extraction({ nav_per_share_usd: 0, nav_per_share_span: "" }),
            DOC,
            ENTRY,
        );
        expect(r.fields.nav).toBeUndefined();
    });

    it("returns EMPTY when no total is found", () => {
        const r = buildAttestationContribution(extraction({ found: false }), DOC, ENTRY);
        expect(r.backing_evidence).toBeUndefined();
    });
});

describe("attestation reconciliation through the resolver", () => {
    function record(over: Partial<AttestationExtraction> = {}) {
        const c = buildAttestationContribution(extraction(over), DOC, ENTRY);
        return rec({ supply: f(RECONCILING_SUPPLY), nav: c.fields.nav! }, c.backing_evidence, "fully_tokenized");
    }

    it("verified on-chain supply x attested NAV reconciles => verified_backed / auto", () => {
        const r = assessBacking(record());
        expect(r.flag).toBe("green");
        expect(r.confidence).toBe("auto"); // capped by the llm-extracted inputs
        expect(r.freshness).toBe("live");
    });

    it("parse_confidence below the floor blocks the green (floor, not gate)", () => {
        const r = assessBacking(record({ parse_confidence: 0.8 }));
        expect(r.flag).toBe("amber");
        expect(r.reason).toMatch(/parsed with low confidence/i);
    });
});

describe("anti-dilution: attestation green is visibly lesser than a regulator green", () => {
    function greenRecord() {
        const c = buildAttestationContribution(extraction(), DOC, ENTRY);
        return rec({ supply: f(RECONCILING_SUPPLY), nav: c.fields.nav! }, c.backing_evidence, "fully_tokenized");
    }

    it("an attestation-only backing NEVER emits confidence: verified", () => {
        const record = greenRecord();
        const v = toAgentVerdict(record, computeAssessment(record));
        expect(v.backing.tier).toBe("verified_backed");
        expect(v.backing.confidence).not.toBe("verified");
        expect(v.backing.confidence).toBe("auto");
    });

    it("the meaning names the attesting firm boundary, not the SEC", () => {
        const record = greenRecord();
        const v = toAgentVerdict(record, computeAssessment(record));
        expect(v.backing.meaning).toMatch(/attesting firm|auditor/i);
        expect(v.backing.meaning).not.toMatch(/\bSEC\b/);
    });
});
