// The two v1.1 correctness fixes, tested at the resolver level:
//   - on-chain reconstruction cannot launder trust (held-token ceiling)
//   - partial reconstruction reads as "X% verified", not a false green
//   - independent sources that disagree -> red
//   - slice-funds (tranche) get green via regulator filing + NAV integrity,
//     NOT supply x NAV reconciliation
import { assessBacking } from "@/lib/computation/backing";
import { f, ev, rec } from "./helpers";

describe("backing resolver - anti-laundering (on-chain reconstruction)", () => {
    it("holding an amber token (independence 1) is amber, not green, even reconciling", () => {
        const r = assessBacking(
            rec({ supply: f(100), nav: f(1) }, [
                ev({
                    source_type: "onchain_holdings",
                    independence: 1,
                    reserves_value: 100,
                    coverage_pct: 100,
                    source: "onchain_reserves",
                    note: "Composition verified on-chain (BUIDL (indep 1)); underlying not independently proven.",
                }),
            ]),
        );
        expect(r.flag).toBe("amber");
    });

    it("reaches green only when the reconstructed leaf is itself independently proven", () => {
        const r = assessBacking(
            rec({ supply: f(100), nav: f(1) }, [
                ev({ source_type: "onchain_holdings", independence: 5, reserves_value: 100, coverage_pct: 100 }),
            ]),
        );
        expect(r.flag).toBe("green");
    });

    it("partial reconstruction reads as 'X% verified', remainder unverified (amber)", () => {
        const r = assessBacking(
            rec({ supply: f(100), nav: f(1) }, [
                ev({ source_type: "onchain_holdings", independence: 5, reserves_value: 88, coverage_pct: 88 }),
            ]),
        );
        expect(r.flag).toBe("amber");
        expect(r.reason).toMatch(/88%/);
        expect(r.reason).toMatch(/not independently verified/i);
    });
});

describe("backing resolver - cross-source conflict", () => {
    it("two independent sources disagreeing on reserves is a red", () => {
        const r = assessBacking(
            rec({ supply: f(100), nav: f(1) }, [
                ev({ source_type: "auditor_attestation", independence: 4, reserves_value: 100, coverage_pct: 100, source: "auditorA" }),
                ev({ source_type: "regulator_filing", independence: 5, reserves_value: 70, coverage_pct: 100, source: "edgar" }),
            ]),
        );
        expect(r.flag).toBe("red");
        expect(r.reason).toMatch(/disagree/i);
    });

    it("two independent sources that agree confirm a green", () => {
        const r = assessBacking(
            rec({ supply: f(100), nav: f(1) }, [
                ev({ source_type: "auditor_attestation", independence: 4, reserves_value: 100, coverage_pct: 100, source: "auditorA" }),
                ev({ source_type: "regulator_filing", independence: 5, reserves_value: 100, coverage_pct: 100, source: "edgar" }),
            ]),
        );
        expect(r.flag).toBe("green");
    });
});

describe("backing resolver - tranche of a registered fund (slice-fund)", () => {
    it("green via regulator filing + NAV integrity, skipping supply x NAV reconciliation", () => {
        // On-chain supply x NAV would be ~$47M vs a ~$400M fund - reconciliation
        // is category-inapplicable. No supply provided on purpose.
        const r = assessBacking(
            rec(
                { nav: f(1) },
                [
                    ev({
                        source_type: "regulator_filing",
                        independence: 5,
                        reserves_value: 400_000_000,
                        coverage_pct: 100,
                        extraction: "structured",
                        source: "edgar_nmfp",
                    }),
                ],
                "tranche_of_registered_fund",
            ),
        );
        expect(r.flag).toBe("green");
        expect(r.reason).toMatch(/regulator-filed/i);
    });

    it("unknown (pending) when the regulator filing has not been retrieved yet", () => {
        const r = assessBacking(rec({ nav: f(1) }, [], "tranche_of_registered_fund"));
        expect(r.flag).toBe("unknown");
        expect(r.reason).toMatch(/EDGAR pending/i);
    });

    it("amber when NAV has drifted from the $1.00 peg", () => {
        const r = assessBacking(
            rec({ nav: f(0.95) }, [
                ev({ source_type: "regulator_filing", independence: 5, reserves_value: 400_000_000, coverage_pct: 100, extraction: "structured", source: "edgar_nmfp" }),
            ], "tranche_of_registered_fund"),
        );
        expect(r.flag).toBe("amber");
    });

    it("unknown when NAV is unavailable", () => {
        const r = assessBacking(
            rec({}, [
                ev({ source_type: "regulator_filing", independence: 5, reserves_value: 400_000_000, coverage_pct: 100, extraction: "structured", source: "edgar_nmfp" }),
            ], "tranche_of_registered_fund"),
        );
        expect(r.flag).toBe("unknown");
    });
});
