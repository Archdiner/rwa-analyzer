// ---------------------------------------------------------------------------
// Citation validation - the integrity spine
// ---------------------------------------------------------------------------
// LLMs hallucinate citations as readily as facts. A "required citation" means
// nothing until it is checked. Every llm_extracted field must carry a text_span
// that is a verbatim substring of the fetched source document. If it is not,
// the field is demoted to `unverifiable` - its value may still be shown, but it
// never wears a trusted badge and computation treats it as missing.
// ---------------------------------------------------------------------------

import type { Citation, FieldObject, FieldValue } from "@/lib/contracts";

/** Minimum span length; guards against a hallucinated match on a trivial word. */
const MIN_SPAN_LENGTH = 8;

/**
 * Collapses all whitespace runs to a single space and trims. Source documents
 * (especially PDF-to-text) are full of stray newlines and double spaces, so we
 * compare on normalized whitespace rather than byte-for-byte.
 */
export function normalizeWhitespace(s: string): string {
    return s.replace(/\s+/g, " ").trim();
}

/**
 * True only if `citation` is well-formed AND its text_span appears verbatim
 * (modulo whitespace) in `sourceText`.
 */
export function validateCitation(sourceText: string, citation: Citation | null): boolean {
    if (!citation) return false;
    if (!citation.url || !citation.text_span) return false;

    const span = normalizeWhitespace(citation.text_span);
    if (span.length < MIN_SPAN_LENGTH) return false;

    return normalizeWhitespace(sourceText).includes(span);
}

/**
 * Enforces the citation rule on a single field. Non-llm fields pass through
 * untouched. An llm_extracted field with a valid citation is kept as-is; one
 * with a missing/invalid citation (or no source text) is demoted to
 * `unverifiable`.
 */
export function enforceCitation<T extends FieldValue>(
    field: FieldObject<T>,
    sourceText: string | null,
): FieldObject<T> {
    if (field.method !== "llm_extracted") return field;

    const valid = sourceText != null && validateCitation(sourceText, field.citation);
    if (valid) return field;

    return { ...field, confidence: "unverifiable" };
}
