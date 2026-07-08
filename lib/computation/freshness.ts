// ---------------------------------------------------------------------------
// Freshness - the third axis (evidence age relative to expected cadence)
// ---------------------------------------------------------------------------
// A green backing verdict is a HISTORICAL claim: the reconciliation was true at
// the evidence's `as_of`, not necessarily now. This module turns that age into a
// machine-readable axis instead of a sentence buried in `reason`.
//
// Age is measured RELATIVE to the source's expected cadence (EXPECTED_CADENCE_MS,
// or a per-item override), so a 20-day-old monthly filing reads `live` while a
// 20-day-old daily oracle feed reads `stale`. The downgrade is a gradient, not a
// cliff, and it only ever DEMOTES a flag - never promotes one (mirrors the
// reconcile-only-demotes invariant).
//
//   ratio = age / cadence
//   ratio <= 1   live    no change
//   1 < r <= 2   aging   note only, no downgrade
//   2 < r <= 3   stale   downgrade one notch
//   r > 3        stale   drop to `unknown` (we genuinely no longer know)
//
// Pure and deterministic apart from the wall clock read in `freshnessOf`; the
// `next_expected` date it returns is clock-independent (as_of + cadence), so
// callers that only need the schedule are not time-fragile.
// ---------------------------------------------------------------------------

import {
    EXPECTED_CADENCE_MS,
    type EvidenceItem,
    type Flag,
    type Freshness,
} from "@/lib/contracts";
import { downgradeFlag, shortDate } from "@/lib/computation/util";

/** Cadence for an item: its explicit override, else the source-type default. */
export function cadenceOf(ev: EvidenceItem): number {
    return ev.cadence_ms ?? EXPECTED_CADENCE_MS[ev.source_type];
}

/** When this evidence is next expected to refresh (clock-independent). */
export function nextExpectedUpdate(ev: EvidenceItem): string {
    return new Date(new Date(ev.as_of).getTime() + cadenceOf(ev)).toISOString();
}

/** Age of `ev` relative to its cadence, and the derived freshness level. */
export function freshnessOf(ev: EvidenceItem): {
    level: Freshness;
    ratio: number;
    next_expected: string;
} {
    const cadence = cadenceOf(ev);
    const age = Date.now() - new Date(ev.as_of).getTime();
    const ratio = cadence > 0 ? age / cadence : Infinity;
    const level: Freshness = ratio <= 1 ? "live" : ratio <= 2 ? "aging" : "stale";
    return { level, ratio, next_expected: nextExpectedUpdate(ev) };
}

/**
 * Applies the freshness gradient to a flag+reason. DEMOTE-ONLY: `live` is a
 * no-op, `aging` adds a note, `stale` downgrades one notch (or drops to
 * `unknown` past 3x cadence). Returns the derived freshness so the caller can
 * surface it as the third axis.
 */
export function applyFreshness(
    flag: Flag,
    reason: string,
    ev: EvidenceItem,
): { flag: Flag; reason: string; freshness: Freshness } {
    const { level, ratio } = freshnessOf(ev);
    if (level === "live") return { flag, reason, freshness: level };

    const aged = shortDate(ev.as_of);
    if (level === "aging") {
        return { flag, reason: `${reason} Evidence is aging (as of ${aged}).`, freshness: level };
    }
    // stale: one notch worse, or fully unknown once we are past 3x cadence.
    const f = ratio > 3 ? "unknown" : downgradeFlag(flag);
    return { flag: f, reason: `${reason} Reserve data is stale (as of ${aged}).`, freshness: level };
}
