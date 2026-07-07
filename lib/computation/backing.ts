// ---------------------------------------------------------------------------
// Backing & verification (spec §5.1)
// ---------------------------------------------------------------------------
// Does the token's reserve actually back its supply, and how is that proven?
//
// Reads backing EVIDENCE (Contract A v1.1), not a single reserves field. Two
// axes decide the verdict (see lib/contracts.ts):
//   INDEPENDENCE (who wrote the evidence) sets the ceiling color.
//   EXTRACTION   (how we read the number) sets the confidence label.
// NAV is never assumed: a missing nav yields `unknown`, not a false green off a
// hardcoded 1.
//
// NOTE: this is the migration-commit resolver — a faithful single-source port of
// the pre-v1.1 behavior onto the evidence array, so the contract is stable and
// green before the multi-evidence resolver (coverage aggregation, cross-source
// conflict, tranche mode, on-chain reconstruction) lands on top of it.
// ---------------------------------------------------------------------------

import {
    minConfidence,
    GREEN_INDEPENDENCE_FLOOR,
    PARSE_CONFIDENCE_FLOOR,
    type Confidence,
    type DimensionAssessment,
    type EvidenceItem,
    type FieldName,
    type Flag,
    type NormalizedAssetRecord,
} from "@/lib/contracts";
import { read, usable, downgradeFlag, shortDate } from "@/lib/computation/util";

const BACKING_TOLERANCE = 0.05; // 5% supply-vs-reserve divergence tolerance
const FRESH_WINDOW_MS = 3 * 24 * 60 * 60 * 1000; // 3 days

const INPUTS: FieldName[] = ["supply", "nav"];
const AUTO_NOTE = "Based on auto-extracted data.";

/** Evidence that can actually be used: present and not unverifiable. */
function usableEvidence(evidence: EvidenceItem[]): EvidenceItem[] {
    return evidence.filter((e) => e.confidence !== "unverifiable");
}

/** The strongest evidence: highest independence, ties broken by coverage. */
function primaryEvidence(evidence: EvidenceItem[]): EvidenceItem {
    return evidence.reduce((best, e) => {
        if (e.independence !== best.independence) return e.independence > best.independence ? e : best;
        return e.coverage_pct > best.coverage_pct ? e : best;
    });
}

function build(
    flag: Flag,
    reason: string,
    confidences: Confidence[],
    sources: string[],
): DimensionAssessment {
    const confidence = confidences.length ? minConfidence(...confidences) : "unverifiable";
    const reasonWithNote = confidence === "auto" ? `${reason} ${AUTO_NOTE}` : reason;
    return { flag, reason: reasonWithNote, inputs: INPUTS, confidence, sources: [...new Set(sources)] };
}

export function assessBacking(record: NormalizedAssetRecord): DimensionAssessment {
    const { fields } = record;
    const supply = usable(read<number>(fields, "supply"));
    const nav = usable(read<number>(fields, "nav"));

    // NAV and supply are prerequisites for any reconciliation.
    if (!supply || !nav) {
        return build(
            "unknown",
            "Net asset value or supply is unavailable, so backing cannot be assessed.",
            [supply, nav].filter(Boolean).map((f) => f!.confidence),
            [supply, nav].filter(Boolean).map((f) => f!.source),
        );
    }

    const evidence = usableEvidence(record.backing_evidence ?? []);
    if (evidence.length === 0) {
        return build(
            "red",
            "No verifiable reserve evidence; backing cannot be confirmed.",
            [supply.confidence, nav.confidence],
            [supply.source, nav.source],
        );
    }

    const primary = primaryEvidence(evidence);
    const confidences = [supply.confidence, nav.confidence, primary.confidence];
    const sources = [supply.source, nav.source, primary.source];

    const expected = supply.value * nav.value;
    const delta = expected === 0 ? 1 : Math.abs(primary.reserves_value - expected) / expected;
    const deltaPct = `${(delta * 100).toFixed(1)}%`;

    if (delta > BACKING_TOLERANCE) {
        return build("red", `Reported reserves diverge from on-chain value by ${deltaPct}.`, confidences, sources);
    }

    let flag: Flag;
    let reason: string;

    if (primary.independence >= GREEN_INDEPENDENCE_FLOOR) {
        flag = "green";
        reason = `Fully backed; reserves independently verified (${primary.source}). On-chain value reconciles within ${deltaPct}.`;
    } else if (primary.independence <= 1) {
        flag = "amber";
        reason = "Appears backed, but reserves are self-reported by the issuer, not independently verified.";
    } else {
        flag = "amber";
        reason = `Appears backed (reconciles within ${deltaPct}), but the reserve verification method is unconfirmed.`;
    }

    // Parse-confidence FLOOR (never a gate): a low-confidence parsed figure may
    // not carry a green. See the principle in lib/contracts.ts.
    if (
        flag === "green" &&
        primary.extraction === "llm_extracted" &&
        primary.parse_confidence != null &&
        primary.parse_confidence < PARSE_CONFIDENCE_FLOOR
    ) {
        flag = "amber";
        reason = `Reserves reconcile within ${deltaPct}, but the figure was parsed with low confidence and is not treated as verified.`;
    }

    // Staleness downgrade.
    const stale = Date.now() - new Date(primary.as_of).getTime() > FRESH_WINDOW_MS;
    if (stale) {
        flag = downgradeFlag(flag);
        reason += ` Reserve data is stale (last updated ${shortDate(primary.as_of)}).`;
    }

    return build(flag, reason, confidences, sources);
}
