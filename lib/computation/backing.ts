// ---------------------------------------------------------------------------
// Backing & verification (spec §5.1) — evidence-set resolver (v1.1)
// ---------------------------------------------------------------------------
// Reads backing EVIDENCE (Contract A), not a single reserves field. Two axes:
//   INDEPENDENCE (who wrote it) sets the ceiling color.
//   EXTRACTION   (how we read it) sets the confidence label.
//
// Green rests ONLY on guards the model cannot argue with: the supply x NAV
// reconciliation (arithmetic) and the verbatim-substring citation (enforced
// upstream). parse_confidence is a FLOOR, never a gate. NAV is never assumed.
//
// Two correctness fixes over the naive resolver:
//   1. ANTI-LAUNDERING — on-chain reconstruction's independence is ceilinged by
//      the held instrument (stamped in the evidence item at ingest), so a wallet
//      holding an amber token is amber, not green.
//   2. SLICE-FUNDS — tokenization_mode "tranche_of_registered_fund" skips the
//      supply x NAV reconciliation (category-inapplicable when the on-chain
//      token is a slice of a larger fund) and confers green via a regulator
//      filing + NAV integrity instead.
// ---------------------------------------------------------------------------

import {
    minConfidence,
    GREEN_INDEPENDENCE_FLOOR,
    PARSE_CONFIDENCE_FLOOR,
    type DimensionAssessment,
    type EvidenceItem,
    type FieldName,
    type FieldObject,
    type Flag,
    type NormalizedAssetRecord,
} from "@/lib/contracts";
import { read, usable, downgradeFlag, shortDate, usd } from "@/lib/computation/util";

const BACKING_TOLERANCE = 0.05; // 5% reconciliation tolerance
const FRESH_WINDOW_MS = 3 * 24 * 60 * 60 * 1000; // 3 days (live feeds/reads)
const FILING_FRESH_WINDOW_MS = 45 * 24 * 60 * 60 * 1000; // 45 days (monthly filings)
const NAV_PEG_TOLERANCE = 0.01; // $1.00 MMF NAV integrity band
const FULL_COVERAGE_PCT = 95; // at/above this, an item claims ~all reserves

const INPUTS: FieldName[] = ["supply", "nav"];
const AUTO_NOTE = "Based on auto-extracted data.";

function usableEvidence(evidence: EvidenceItem[]): EvidenceItem[] {
    return evidence.filter((e) => e.confidence !== "unverifiable");
}

/** Highest independence wins; ties broken by coverage, then freshness. */
function strongest(items: EvidenceItem[]): EvidenceItem {
    return items.reduce((best, e) => {
        if (e.independence !== best.independence) return e.independence > best.independence ? e : best;
        if (e.coverage_pct !== best.coverage_pct) return e.coverage_pct > best.coverage_pct ? e : best;
        return new Date(e.as_of).getTime() > new Date(best.as_of).getTime() ? e : best;
    });
}

function build(flag: Flag, reason: string, used: (FieldObject | EvidenceItem)[]): DimensionAssessment {
    const confidence = used.length ? minConfidence(...used.map((u) => u.confidence)) : "unverifiable";
    const reasonWithNote = confidence === "auto" ? `${reason} ${AUTO_NOTE}` : reason;
    const sources = [...new Set(used.map((u) => u.source))];
    return { flag, reason: reasonWithNote, inputs: INPUTS, confidence, sources };
}

function stale(asOf: string, windowMs: number): boolean {
    return Date.now() - new Date(asOf).getTime() > windowMs;
}

function withinTolerance(a: number, b: number): boolean {
    const denom = Math.max(Math.abs(a), Math.abs(b)) || 1;
    return Math.abs(a - b) / denom <= BACKING_TOLERANCE;
}

/** Applies the parse-confidence floor and staleness downgrade to a green. */
function guardGreen(
    flag: Flag,
    reason: string,
    ev: EvidenceItem,
    freshWindowMs: number,
): { flag: Flag; reason: string } {
    let f = flag;
    let r = reason;
    if (
        f === "green" &&
        ev.extraction === "llm_extracted" &&
        ev.parse_confidence != null &&
        ev.parse_confidence < PARSE_CONFIDENCE_FLOOR
    ) {
        f = "amber";
        r = `Reserves reconcile, but the figure was parsed with low confidence and is not treated as verified.`;
    }
    if (stale(ev.as_of, freshWindowMs)) {
        f = downgradeFlag(f);
        r += ` Reserve data is stale (last updated ${shortDate(ev.as_of)}).`;
    }
    return { flag: f, reason: r };
}

export function assessBacking(record: NormalizedAssetRecord): DimensionAssessment {
    const { fields } = record;
    const nav = usable(read<number>(fields, "nav"));
    const supply = usable(read<number>(fields, "supply"));
    const evidence = usableEvidence(record.backing_evidence ?? []);
    const mode = record.tokenization_mode ?? "unknown";

    if (mode === "tranche_of_registered_fund") return assessTranche(nav, evidence);

    // fully_tokenized / unknown: reserves reconcile against supply x NAV.
    if (!supply || !nav) {
        return build(
            "unknown",
            "Net asset value or supply is unavailable, so backing cannot be assessed.",
            [supply, nav].filter(Boolean) as FieldObject[],
        );
    }
    if (evidence.length === 0) {
        return build("red", "No verifiable reserve evidence; backing cannot be confirmed.", [supply, nav]);
    }

    return assessFullyTokenized(supply, nav, evidence);
}

interface Classified {
    ev: EvidenceItem;
    actualShare: number; // reserves_value / expected
    claimedShare: number; // coverage_pct / 100
    matches: boolean; // number is consistent with its own coverage claim
    full: boolean; // claims ~all reserves
}

function assessFullyTokenized(
    supply: FieldObject<number>,
    nav: FieldObject<number>,
    evidence: EvidenceItem[],
): DimensionAssessment {
    const base: FieldObject[] = [supply, nav];
    const expected = supply.value * nav.value;

    const cls: Classified[] = evidence.map((ev) => {
        const actualShare = expected > 0 ? ev.reserves_value / expected : ev.reserves_value > 0 ? Infinity : 0;
        const claimedShare = ev.coverage_pct / 100;
        return {
            ev,
            actualShare,
            claimedShare,
            matches: Math.abs(actualShare - claimedShare) <= BACKING_TOLERANCE,
            full: ev.coverage_pct >= FULL_COVERAGE_PCT,
        };
    });

    const independent = cls.filter((c) => c.ev.independence >= GREEN_INDEPENDENCE_FLOOR);

    // 1. Cross-source conflict: INDEPENDENT sources that each claim ~all the
    //    reserves must agree WITH EACH OTHER. Disagreement is a red — the tool's
    //    whole point — regardless of which (if any) matches supply x NAV.
    const indepFull = independent.filter((c) => c.full);
    if (indepFull.length >= 2) {
        const anchor = indepFull[0].ev.reserves_value;
        const disagree = indepFull.some((c) => !withinTolerance(c.ev.reserves_value, anchor));
        if (disagree) {
            return build(
                "red",
                "Independent sources disagree on the reserve value; backing cannot be trusted until reconciled.",
                [...base, ...indepFull.map((c) => c.ev)],
            );
        }
    }

    // 2. Green: an independent source accounts for ~all reserves and the number
    //    reconciles. Subject to the parse floor and staleness.
    const indepFullMatch = independent.filter((c) => c.full && c.matches);
    if (indepFullMatch.length) {
        const primary = strongest(indepFullMatch.map((c) => c.ev));
        const deltaPct = `${(Math.abs(primary.reserves_value - expected) / (expected || 1) * 100).toFixed(1)}%`;
        const g = guardGreen(
            "green",
            `Fully backed; reserves independently verified (${primary.source}). On-chain value reconciles within ${deltaPct}.`,
            primary,
            FRESH_WINDOW_MS,
        );
        return build(g.flag, g.reason, [...base, primary]);
    }

    // 3. Independent source claims full coverage but the number is off -> red.
    const indepFullMismatch = independent.filter((c) => c.full && !c.matches);
    if (indepFullMismatch.length) {
        const p = strongest(indepFullMismatch.map((c) => c.ev));
        const deltaPct = `${(Math.abs(p.reserves_value - expected) / (expected || 1) * 100).toFixed(1)}%`;
        return build("red", `Reported reserves diverge from on-chain value by ${deltaPct}.`, [...base, p]);
    }

    // 4. Independent partial: a verified slice, honest remainder unverified.
    const indepPartial = independent.filter((c) => c.matches && !c.full);
    if (indepPartial.length) {
        const primary = strongest(indepPartial.map((c) => c.ev));
        const coverage = Math.round(primary.coverage_pct);
        const remainder = Math.max(0, expected - primary.reserves_value);
        const reason =
            `${coverage}% of backing is independently verified on-chain (${usd(primary.reserves_value)}); ` +
            `the remaining ${usd(remainder)} is not independently verified.`;
        const g = guardGreen("amber", reason, primary, FRESH_WINDOW_MS); // amber never promotes; guard only staleness-notes
        return build("amber", g.reason, [...base, primary]);
    }

    // 5. No independent evidence — below the green floor (self-report / oracle
    //    unclassified / laundering-ceilinged reconstruction).
    const best = strongest(evidence);
    const bestCls = cls.find((c) => c.ev === best)!;
    const deltaPct = `${(Math.abs(best.reserves_value - expected) / (expected || 1) * 100).toFixed(1)}%`;

    if (!bestCls.matches) {
        return build("red", `Reported reserves diverge from on-chain value by ${deltaPct}.`, [...base, best]);
    }

    let flag: Flag = "amber";
    let reason: string;
    const coverageNote = bestCls.full ? "" : ` (covers ~${Math.round(best.coverage_pct)}% of backing)`;
    if (best.independence <= 1) {
        reason = `Appears backed${coverageNote}, but reserves are self-reported by the issuer, not independently verified.`;
    } else {
        reason = `Appears backed${coverageNote} (reconciles within ${deltaPct}), but the reserve verification method is unconfirmed.`;
    }
    if (best.note && best.source_type === "onchain_holdings") reason += ` ${best.note}`;

    if (stale(best.as_of, FRESH_WINDOW_MS)) {
        flag = downgradeFlag(flag);
        reason += ` Reserve data is stale (last updated ${shortDate(best.as_of)}).`;
    }

    return build(flag, reason, [...base, best]);
}

/**
 * Tranche of a registered fund: the on-chain token is a slice of a larger
 * regulated fund, so total-pool reconciliation (supply x NAV) is
 * category-inapplicable. Green comes from a regulator filing + NAV integrity
 * (the fund is a regulated MMF holding govt securities at a $1 NAV), not from
 * matching total reserves to on-chain supply.
 */
function assessTranche(nav: FieldObject<number> | undefined, evidence: EvidenceItem[]): DimensionAssessment {
    if (!nav) {
        return build("unknown", "NAV is unavailable, so NAV integrity cannot be checked for this regulated fund.", []);
    }

    const filings = evidence.filter(
        (e) => e.source_type === "regulator_filing" && e.independence >= GREEN_INDEPENDENCE_FLOOR,
    );

    if (filings.length === 0) {
        // The proof exists (EDGAR) but has not been retrieved yet. Honest:
        // pending, not a false green and not a misleading red.
        return build(
            "unknown",
            "Regulated fund; portfolio holdings are regulator-filed but have not yet been retrieved (EDGAR pending).",
            [],
        );
    }

    const primary = strongest(filings);
    const navOk = Math.abs(nav.value - 1) <= NAV_PEG_TOLERANCE;

    let flag: Flag = navOk ? "green" : "amber";
    let reason = navOk
        ? `Regulated 1940-Act fund: portfolio holdings are regulator-filed (${primary.source}) and NAV is maintained at $${nav.value.toFixed(4)}. The on-chain token is a share of the fund, so total-pool reconciliation does not apply.`
        : `Regulated fund with regulator-filed holdings (${primary.source}), but NAV has drifted from $1.00 to $${nav.value.toFixed(4)}.`;

    // Parse floor (structured EDGAR data has parse_confidence null, so this is a
    // no-op there; it guards any future LLM-parsed filing).
    if (
        flag === "green" &&
        primary.extraction === "llm_extracted" &&
        primary.parse_confidence != null &&
        primary.parse_confidence < PARSE_CONFIDENCE_FLOOR
    ) {
        flag = "amber";
        reason = `Regulator filing (${primary.source}) supports backing, but the figure was parsed with low confidence and is not treated as verified.`;
    }

    if (stale(primary.as_of, FILING_FRESH_WINDOW_MS)) {
        flag = downgradeFlag(flag);
        reason += ` Latest filing is stale (${shortDate(primary.as_of)}).`;
    }

    return build(flag, reason, [nav, primary]);
}
