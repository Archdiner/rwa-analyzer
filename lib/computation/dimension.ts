// ---------------------------------------------------------------------------
// Shared finalize for the v1.2 on-chain dimensions (yield_source, market_risk)
// ---------------------------------------------------------------------------
// Both dimensions end the same way, and that ending encodes honesty invariants
// that must stay identical across them: apply the anti-laundering ceiling
// (demote-only), THEN the freshness gradient (demote-only), THEN cap confidence
// at the min of the reads used. Keeping it in one place means the compose order
// can never drift between the two dimensions.
// ---------------------------------------------------------------------------

import {
    minConfidence,
    type Confidence,
    type DimensionAssessment,
    type DimensionRead,
    type FieldName,
    type Flag,
} from "@/lib/contracts";
import { capFlag } from "@/lib/computation/util";
import { applyFreshnessAt } from "@/lib/computation/freshness";

/** On-chain reserve reads refresh continuously; a day-old read is aging. */
export const ONCHAIN_CADENCE_MS = 24 * 60 * 60 * 1000;

/** An `unknown` dimension with no dateable freshness (e.g. no data present). */
export function unknownDimension(reason: string): DimensionAssessment {
    return { flag: "unknown", reason, inputs: [], confidence: "unverifiable", sources: [] };
}

/**
 * Finalizes an on-chain dimension: anti-laundering ceiling, then freshness, then
 * the confidence cap. `used` is the set of reads the verdict depended on; its
 * min confidence caps the dimension.
 */
export function finalizeReadDimension(opts: {
    flag: Flag;
    reason: string;
    used: DimensionRead[];
    asOf: string;
    inputs: FieldName[];
    ceiling?: Flag;
    cadenceMs?: number;
}): DimensionAssessment {
    const { flag, reason, used, asOf, inputs, ceiling, cadenceMs = ONCHAIN_CADENCE_MS } = opts;
    const capped = ceiling ? capFlag(flag, ceiling) : flag;
    const cappedReason =
        capped !== flag
            ? `${reason} Capped at the underlying's own verification ceiling (${ceiling}); you cannot be safer than the asset you lent.`
            : reason;
    const fr = applyFreshnessAt(capped, cappedReason, asOf, cadenceMs, "On-chain read");
    // A read with a null value verified NOTHING (the accessor was unavailable),
    // so it contributes `unverifiable` to the confidence min regardless of the
    // label it was stamped with - an "I could not read this" outcome must never
    // carry a `verified` confidence.
    const confidence: Confidence = used.length
        ? minConfidence(...used.map((u) => (u.value == null ? "unverifiable" : u.confidence)))
        : "unverifiable";
    const sources = [...new Set(used.map((u) => u.source))];
    return { flag: fr.flag, reason: fr.reason, inputs, confidence, sources, freshness: fr.freshness };
}
