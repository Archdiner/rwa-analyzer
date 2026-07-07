// EDGAR N-MFP parsing, tested against a REAL filing fixture:
//   Franklin OnChain U.S. Government Money Fund (FOBXX / BENJI), series
//   S000067043, N-MFP3 for report date 2026-06-30 (SEC accession
//   0002071691-26-015662). Copied verbatim from EDGAR into fixtures/.
import { readFileSync } from "fs";
import { join } from "path";
import {
    parseNmfp,
    navFromFiling,
    isAllGovernment,
    buildRegulatorEvidence,
} from "@/lib/ingestion/edgar";
import { assessBacking } from "@/lib/computation/backing";
import { f, rec } from "@/lib/computation/__tests__/helpers";

const XML = readFileSync(join(__dirname, "fixtures/benji-nmfp3.xml"), "utf8");

describe("parseNmfp — real BENJI/FOBXX N-MFP3 filing", () => {
    const data = parseNmfp(XML)!;

    it("parses the correct fund series", () => {
        expect(data).not.toBeNull();
        expect(data.seriesId).toBe("S000067043");
        expect(data.seriesName).toMatch(/Franklin OnChain U\.S\. Government Money Fund/i);
    });

    it("reads whole-fund net assets (~$753M), far above the on-chain slice", () => {
        expect(data.netAssets).toBeGreaterThan(700_000_000);
        expect(data.netAssets).toBeLessThan(800_000_000);
    });

    it("reports a market-based (shadow) NAV pegged at $1.0000", () => {
        expect(navFromFiling(data)).toBeCloseTo(1, 4);
        expect(data.marketNav).toBeCloseTo(1, 4);
    });

    it("is a Government MMF holding only government securities", () => {
        expect(data.category).toBe("Government");
        expect(isAllGovernment(data)).toBe(true);
    });
});

describe("buildRegulatorEvidence", () => {
    const ev = buildRegulatorEvidence(parseNmfp(XML)!, "SEC EDGAR N-MFP (S000067043)");

    it("is regulator-grade, structured, verified — no parse_confidence or citation", () => {
        expect(ev.source_type).toBe("regulator_filing");
        expect(ev.independence).toBe(5);
        expect(ev.extraction).toBe("structured");
        expect(ev.confidence).toBe("verified");
        expect(ev.parse_confidence).toBeNull();
        expect(ev.citation).toBeNull();
    });
});

describe("tranche resolver on the real filing", () => {
    it("renders GREEN via regulated structure + NAV integrity (no supply x NAV)", () => {
        const data = parseNmfp(XML)!;
        const ev = buildRegulatorEvidence(data, "SEC EDGAR N-MFP (S000067043)");
        // Use a fresh as_of so this end-to-end assertion is not staleness-flaky
        // as the fixture ages; freshness itself is covered elsewhere.
        ev.as_of = new Date().toISOString();

        const r = assessBacking(
            rec({ nav: f(navFromFiling(data)!) }, [ev], "tranche_of_registered_fund"),
        );
        expect(r.flag).toBe("green");
        expect(r.confidence).toBe("verified");
        expect(r.reason).toMatch(/regulator-filed/i);
    });
});
