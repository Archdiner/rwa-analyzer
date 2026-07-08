// Shared test helpers (not a suite - no .test.ts suffix).
import type {
    Citation,
    Confidence,
    EvidenceExtraction,
    EvidenceItem,
    EvidenceSourceType,
    FieldMap,
    FieldObject,
    FieldValue,
    Method,
    NormalizedAssetRecord,
    TokenizationMode,
} from "@/lib/contracts";

export function f<T extends FieldValue>(
    value: T,
    opts: { method?: Method; confidence?: Confidence; source?: string; as_of?: string } = {},
): FieldObject<T> {
    return {
        value,
        source: opts.source ?? "test",
        method: opts.method ?? "onchain_read",
        confidence: opts.confidence ?? "verified",
        as_of: opts.as_of ?? new Date().toISOString(),
        citation: null,
    };
}

export function daysAgo(n: number): string {
    return new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString();
}

/** Concise backing-evidence builder for tests. */
export function ev(opts: {
    source_type?: EvidenceSourceType;
    independence: number;
    reserves_value: number;
    coverage_pct?: number;
    extraction?: EvidenceExtraction;
    confidence?: Confidence;
    parse_confidence?: number | null;
    citation?: Citation | null;
    source?: string;
    as_of?: string;
    note?: string;
}): EvidenceItem {
    return {
        source_type: opts.source_type ?? "oracle_por",
        independence: opts.independence,
        reserves_value: opts.reserves_value,
        coverage_pct: opts.coverage_pct ?? 100,
        as_of: opts.as_of ?? new Date().toISOString(),
        extraction: opts.extraction ?? "onchain_read",
        confidence: opts.confidence ?? "verified",
        parse_confidence: opts.parse_confidence ?? null,
        citation: opts.citation ?? null,
        source: opts.source ?? "test_feed",
        note: opts.note,
    };
}

/** Builds a minimal Contract A record for computation tests. */
export function rec(
    fields: FieldMap = {},
    backing_evidence: EvidenceItem[] = [],
    tokenization_mode: TokenizationMode = "fully_tokenized",
): NormalizedAssetRecord {
    return {
        asset_id: "1:0x0000000000000000000000000000000000000001",
        identifiers: {
            name: "Test",
            symbol: "TEST",
            chain_id: 1,
            contract_address: "0x0000000000000000000000000000000000000001",
        },
        fields,
        backing_evidence,
        tokenization_mode,
        conflicts: [],
        ingested_at: new Date().toISOString(),
    };
}
