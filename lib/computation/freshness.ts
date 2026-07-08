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
    return nextExpectedAt(ev.as_of, cadenceOf(ev));
}

/**
 * Age of an `as_of` relative to a cadence, and the derived freshness level. The
 * primitive both the backing-evidence path and the v1.2 on-chain dimensions
 * share, so the gradient is defined in exactly one place.
 */
export function freshnessAt(asOf: string, cadenceMs: number): {
    level: Freshness;
    ratio: number;
    next_expected: string;
} {
    const age = Date.now() - new Date(asOf).getTime();
    const ratio = cadenceMs > 0 ? age / cadenceMs : Infinity;
    const level: Freshness = ratio <= 1 ? "live" : ratio <= 2 ? "aging" : "stale";
    return { level, ratio, next_expected: nextExpectedAt(asOf, cadenceMs) };
}

/** Clock-independent next-refresh timestamp for a raw as_of + cadence. */
export function nextExpectedAt(asOf: string, cadenceMs: number): string {
    return new Date(new Date(asOf).getTime() + cadenceMs).toISOString();
}

/**
 * Applies the freshness gradient to a flag+reason for a raw as_of + cadence.
 * DEMOTE-ONLY: `live` is a no-op, `aging` adds a note, `stale` downgrades one
 * notch (or drops to `unknown` past 3x cadence). `staleNoun` names what went
 * stale in the reason (defaults to the backing-path "Reserve data").
 */
export function applyFreshnessAt(
    flag: Flag,
    reason: string,
    asOf: string,
    cadenceMs: number,
    staleNoun = "Reserve data",
): { flag: Flag; reason: string; freshness: Freshness } {
    const { level, ratio } = freshnessAt(asOf, cadenceMs);
    if (level === "live") return { flag, reason, freshness: level };

    const aged = shortDate(asOf);
    if (level === "aging") {
        return { flag, reason: `${reason} Evidence is aging (as of ${aged}).`, freshness: level };
    }
    // stale: one notch worse, or fully unknown once we are past 3x cadence.
    const f = ratio > 3 ? "unknown" : downgradeFlag(flag);
    return { flag: f, reason: `${reason} ${staleNoun} is stale (as of ${aged}).`, freshness: level };
}

/** Age of `ev` relative to its cadence, and the derived freshness level. */
export function freshnessOf(ev: EvidenceItem): {
    level: Freshness;
    ratio: number;
    next_expected: string;
} {
    return freshnessAt(ev.as_of, cadenceOf(ev));
}

/**
 * Applies the freshness gradient to a backing EvidenceItem. Thin wrapper over
 * `applyFreshnessAt` using the item's per-source cadence.
 */
export function applyFreshness(
    flag: Flag,
    reason: string,
    ev: EvidenceItem,
): { flag: Flag; reason: string; freshness: Freshness } {
    return applyFreshnessAt(flag, reason, ev.as_of, cadenceOf(ev));
}
