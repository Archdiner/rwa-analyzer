// ---------------------------------------------------------------------------
// Computation helpers
// ---------------------------------------------------------------------------
// Shared machinery for the deterministic rule modules. The key invariant lives
// in `finalize`: a dimension's confidence is capped at the min confidence of
// the inputs it actually used, and an `auto` input forces the "Based on
// auto-extracted data." label. Computation can never emit a confident verdict
// from unconfident inputs.
// ---------------------------------------------------------------------------

import {
    minConfidence,
    type Confidence,
    type DimensionAssessment,
    type FieldMap,
    type FieldName,
    type FieldObject,
    type FieldValue,
    type Flag,
} from "@/lib/contracts";

const AUTO_NOTE = "Based on auto-extracted data.";

/**
 * Returns a field only if it is present AND at least `auto` confidence. An
 * `unverifiable` field (e.g. a citation that failed validation) is treated as
 * missing - the rule reads it as `unknown`, never as fact.
 */
export function usable<T extends FieldValue>(f?: FieldObject<T>): FieldObject<T> | undefined {
    if (!f) return undefined;
    if (f.confidence === "unverifiable") return undefined;
    return f;
}

/** Reads a typed field from the map (unsafe cast is fine: values are trusted). */
export function read<T extends FieldValue>(fields: FieldMap, name: FieldName): FieldObject<T> | undefined {
    return fields[name] as FieldObject<T> | undefined;
}

/** Steps a flag one notch worse (used by staleness/other downgrades). */
export function downgradeFlag(flag: Flag): Flag {
    if (flag === "green") return "amber";
    if (flag === "amber") return "red";
    return flag;
}

/**
 * Builds a dimension verdict with the confidence cap applied. `used` is the set
 * of input fields the verdict actually depended on; its min confidence caps the
 * dimension and drives the auto-extracted label.
 */
export function finalize(
    flag: Flag,
    reason: string,
    inputs: FieldName[],
    used: FieldObject[],
): DimensionAssessment {
    const confidence: Confidence = used.length
        ? minConfidence(...used.map((f) => f.confidence))
        : "unverifiable";

    const reasonWithNote = confidence === "auto" ? `${reason} ${AUTO_NOTE}` : reason;
    const sources = [...new Set(used.map((f) => f.source))];

    return { flag, reason: reasonWithNote, inputs, confidence, sources };
}

/** Formats a USD amount compactly for reason strings. */
export function usd(n: number): string {
    if (n >= 1_000_000) return `$${(n / 1_000_000).toLocaleString(undefined, { maximumFractionDigits: 1 })}M`;
    if (n >= 1_000) return `$${(n / 1_000).toLocaleString(undefined, { maximumFractionDigits: 0 })}K`;
    return `$${n.toLocaleString()}`;
}

/** Short human date for reason strings. */
export function shortDate(iso: string): string {
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? iso : d.toISOString().slice(0, 10);
}
