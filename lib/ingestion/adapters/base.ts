// ---------------------------------------------------------------------------
// Adapter shared types + helpers
// ---------------------------------------------------------------------------
// Every source adapter takes a ParsedAssetId and returns partial field-objects
// (a subset of the schema) plus any identifiers it learned. Adding a source
// later is one new adapter and nothing else changes.
// ---------------------------------------------------------------------------

import type {
    AssetIdentifiers,
    Citation,
    Confidence,
    EvidenceItem,
    FieldMap,
    FieldObject,
    FieldValue,
    Method,
} from "@/lib/contracts";
import type { ParsedAssetId } from "@/lib/chains";

export interface AdapterResult {
    fields: FieldMap;
    /** Backing evidence contributed by this adapter (v1.1). Reconcile concats
     *  these across adapters into the record's backing_evidence[]. */
    backing_evidence?: EvidenceItem[];
    identifiers?: Partial<AssetIdentifiers>;
    /** Raw source document text, when an adapter fetched one (issuer docs). */
    sourceText?: string;
    /** A disclosure/document URL discovered by this adapter (for doc fetch). */
    disclosureUrl?: string;
}

export type Adapter = (asset: ParsedAssetId) => Promise<AdapterResult>;

/** Concise FieldObject factory with sane defaults (now + no citation). */
export function field<T extends FieldValue>(
    value: T,
    opts: {
        source: string;
        method: Method;
        confidence: Confidence;
        as_of?: string;
        citation?: Citation | null;
    },
): FieldObject<T> {
    return {
        value,
        source: opts.source,
        method: opts.method,
        confidence: opts.confidence,
        as_of: opts.as_of ?? new Date().toISOString(),
        citation: opts.citation ?? null,
    };
}

/** An empty adapter result (adapter had nothing to contribute). */
export const EMPTY: AdapterResult = { fields: {} };
