// ---------------------------------------------------------------------------
// Auditor-attestation adapter (Lane C) - coverage without diluting the moat
// ---------------------------------------------------------------------------
// For an asset with a registered attestation (attestation-registry), fetches the
// document, LLM-extracts the reserve total (+ NAV/share if stated) WITH verbatim
// citations, and emits one `auditor_attestation` EvidenceItem plus a `nav` field.
//
// The extraction is `llm_extracted`, so:
//   - the evidence confidence is `auto` (never `verified`);
//   - the citation MUST validate as a verbatim substring or the item drops to
//     `unverifiable` (computation reads that as no evidence -> honest unknown);
//   - the backing resolver still gates green on the supply x NAV arithmetic and
//     the parse-confidence FLOOR. The attestation is never trusted blind.
//
// The pure `buildAttestationContribution` holds all the citation/confidence
// logic and is unit-tested without network or OpenAI.
// ---------------------------------------------------------------------------

import { field, type AdapterResult, EMPTY } from "@/lib/ingestion/adapters/base";
import type { EvidenceItem, FieldObject } from "@/lib/contracts";
import type { ParsedAssetId } from "@/lib/chains";
import { formatAssetId as buildAssetId } from "@/lib/chains";
import { extractJson, hasOpenAi } from "@/lib/openai";
import { validateCitation } from "@/lib/ingestion/citations";
import { fetchDocText } from "@/lib/ingestion/adapters/issuer-docs";
import { lookupAttestation, type AttestationEntry } from "@/lib/ingestion/adapters/attestation-registry";

/** Raw shape the model returns (numbers parsed, spans verbatim for citation). */
export interface AttestationExtraction {
    found: boolean;
    total_net_assets_usd: number;
    total_net_assets_span: string;
    nav_per_share_usd: number; // 0 when the doc does not state a per-share NAV
    nav_per_share_span: string; // "" when not stated
    as_of_date: string; // ISO-8601 if the model can, else as written
    parse_confidence: number; // model self-report 0-1; a FLOOR, never a gate
}

const SCHEMA = {
    type: "object",
    additionalProperties: false,
    properties: {
        found: { type: "boolean" },
        total_net_assets_usd: { type: "number" },
        total_net_assets_span: { type: "string" },
        nav_per_share_usd: { type: "number" },
        nav_per_share_span: { type: "string" },
        as_of_date: { type: "string" },
        parse_confidence: { type: "number" },
    },
    required: [
        "found",
        "total_net_assets_usd",
        "total_net_assets_span",
        "nav_per_share_usd",
        "nav_per_share_span",
        "as_of_date",
        "parse_confidence",
    ],
};

const SYSTEM = [
    "You read an auditor/administrator ATTESTATION for a tokenized fund and extract its reserve figures.",
    "Extract ONLY what is explicitly stated in the DOCUMENT. Never infer or use outside knowledge.",
    "total_net_assets_usd: the fund's total net assets / assets under management in USD, as a plain number.",
    "nav_per_share_usd: the net asset value PER SHARE/TOKEN in USD if stated; else 0.",
    "For each figure, the *_span MUST be an exact verbatim quote copied character-for-character from the document (the sentence or line containing the number). If a figure is not stated, set its number to 0 and its span to ''.",
    "as_of_date: the attestation's 'as of' date (ISO-8601 if possible).",
    "found: true only if a total net assets figure is explicitly stated.",
    "parse_confidence: your 0-1 confidence that these figures are exactly what the document states. A confident wrong answer is the cardinal sin; when unsure, lower it.",
].join(" ");

function toIso(raw: string): string {
    const d = new Date(raw);
    return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

/**
 * PURE: turns an extraction + the source text into an AdapterResult. All the
 * citation/confidence logic lives here so it is testable without network/LLM.
 * A span that is not a verbatim substring demotes its field/evidence to
 * `unverifiable`; the resolver then treats it as missing (never a false green).
 */
export function buildAttestationContribution(
    ext: AttestationExtraction,
    sourceText: string,
    entry: AttestationEntry,
): AdapterResult {
    if (!ext.found || !(ext.total_net_assets_usd > 0)) return EMPTY;

    const as_of = toIso(ext.as_of_date);
    const source = `Attestation - ${entry.administrator_name}`;

    const reservesCited = validateCitation(sourceText, {
        url: entry.doc_url,
        text_span: ext.total_net_assets_span,
    });

    const evidence: EvidenceItem = {
        source_type: "auditor_attestation",
        independence: 4, // auditor: green-capable, but below regulator (5)
        reserves_value: ext.total_net_assets_usd,
        coverage_pct: 100,
        as_of,
        extraction: "llm_extracted",
        confidence: reservesCited ? "auto" : "unverifiable", // llm => never verified
        parse_confidence: ext.parse_confidence,
        citation: { url: entry.doc_url, text_span: ext.total_net_assets_span },
        cadence_ms: entry.cadence_ms,
        source,
    };

    const result: AdapterResult = { fields: {}, backing_evidence: [evidence] };

    // NAV/share, only if the doc stated it and the citation checks out. Needed
    // for the supply x NAV reconciliation on a fully-tokenized asset.
    if (ext.nav_per_share_usd > 0) {
        const navCited = validateCitation(sourceText, {
            url: entry.doc_url,
            text_span: ext.nav_per_share_span,
        });
        const nav: FieldObject<number> = field(ext.nav_per_share_usd, {
            source,
            method: "llm_extracted",
            confidence: navCited ? "auto" : "unverifiable",
            as_of,
            citation: { url: entry.doc_url, text_span: ext.nav_per_share_span },
        });
        result.fields.nav = nav;
    }

    return result;
}

/** Network shell: registry lookup -> fetch -> extract -> pure builder. */
export async function attestationAdapter(asset: ParsedAssetId): Promise<AdapterResult> {
    const assetId = buildAssetId(asset.chainId, asset.address);
    const entry = lookupAttestation(assetId);
    if (!entry) return EMPTY; // instant: long-tail assets never pay this cost
    if (!hasOpenAi()) return EMPTY; // no model -> honest unknown, never a guess

    try {
        const text = await fetchDocText(entry.doc_url);
        if (!text) return EMPTY;

        const ext = await extractJson<AttestationExtraction>({
            schemaName: "rwa_attestation_reserves",
            schema: SCHEMA,
            system: SYSTEM,
            user: `DOCUMENT (source: ${entry.doc_url}):\n\n${text}`,
        });
        if (!ext) return EMPTY;

        return buildAttestationContribution(ext, text, entry);
    } catch (err) {
        console.error(`[attestation] lookup failed for ${assetId}:`, err);
        return EMPTY;
    }
}
