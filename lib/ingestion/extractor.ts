// ---------------------------------------------------------------------------
// Qualitative extractor (the LLM step)
// ---------------------------------------------------------------------------
// Extracts the 4 high-signal qualitative fields from an issuer document into
// enum-constrained values, each with a verbatim citation. Every returned span
// is then validated as a real substring of the document (lib/ingestion/
// citations); any that fail are demoted to `unverifiable`. Values the model
// marks `unknown` contribute nothing (computation then sees them as missing).
//
// The LLM lives ONLY here. It turns prose into structured fields; it never
// decides a score.
// ---------------------------------------------------------------------------

import type {
    FieldMap,
    FieldObject,
    Jurisdiction,
    RedemptionSpeed,
    WrapperType,
} from "@/lib/contracts";
import { extractJson } from "@/lib/openai";
import { enforceCitation } from "@/lib/ingestion/citations";
import type { IssuerDoc } from "@/lib/ingestion/adapters/issuer-docs";

const WRAPPER_TYPES: WrapperType[] = [
    "registered_fund_40act",
    "registered_fund_other",
    "private_fund",
    "spv",
    "mirror_token",
    "unbacked",
    "unknown",
];
const REDEMPTION_SPEEDS: RedemptionSpeed[] = [
    "instant",
    "instant_capped",
    "daily",
    "t_plus_n",
    "none",
    "unknown",
];
const JURISDICTIONS: Jurisdiction[] = [
    "permissionless",
    "non_us_only",
    "us_retail",
    "us_accredited",
    "us_qualified_purchaser",
    "eu_only",
    "unknown",
];

interface Extracted {
    value: string;
    text_span: string;
}

interface ExtractionResult {
    wrapper_type: Extracted;
    redemption_speed: Extracted;
    redemption_cap: Extracted;
    jurisdiction: Extracted;
    custodian: Extracted;
}

function citedField(source: string, value: string, url: string, textSpan: string): FieldObject<string> {
    return {
        value,
        source,
        method: "llm_extracted",
        confidence: "auto",
        as_of: new Date().toISOString(),
        citation: { url, text_span: textSpan },
    };
}

/** Skip a value the model couldn't ground. */
function isUnknown(v: string): boolean {
    const s = v.trim().toLowerCase();
    return s === "" || s === "unknown" || s === "n/a" || s === "not stated";
}

const enumProp = (values: string[]) => ({
    type: "object",
    additionalProperties: false,
    properties: { value: { type: "string", enum: values }, text_span: { type: "string" } },
    required: ["value", "text_span"],
});
const stringProp = () => ({
    type: "object",
    additionalProperties: false,
    properties: { value: { type: "string" }, text_span: { type: "string" } },
    required: ["value", "text_span"],
});

const SCHEMA = {
    type: "object",
    additionalProperties: false,
    properties: {
        wrapper_type: enumProp(WRAPPER_TYPES),
        redemption_speed: enumProp(REDEMPTION_SPEEDS),
        redemption_cap: stringProp(),
        jurisdiction: enumProp(JURISDICTIONS),
        custodian: stringProp(),
    },
    required: ["wrapper_type", "redemption_speed", "redemption_cap", "jurisdiction", "custodian"],
};

const SYSTEM = [
    "You extract structured facts from a tokenized real-world asset's disclosure document.",
    "Extract ONLY what is explicitly stated in the DOCUMENT.",
    "If a field is not explicitly stated, set value to 'unknown' and text_span to ''.",
    "For every non-unknown value, text_span MUST be an exact, verbatim quote copied character-for-character from the document that supports the value.",
    "Do not infer, summarize, paraphrase, or use outside knowledge. A confident guess is the cardinal sin here; 'unknown' is always safer.",
    "redemption_cap: a short machine string like '50000000_per_24h', 'none', or 'unknown'.",
    "custodian: the custodian's name exactly as written, or 'unknown'.",
].join(" ");

/**
 * Extracts qualitative fields from a document. Returns validated field-objects
 * (invalid citations demoted to unverifiable, unknowns omitted). Empty map if
 * OpenAI is unconfigured or the call fails.
 */
export async function extractQualitative(doc: IssuerDoc): Promise<FieldMap> {
    const result = await extractJson<ExtractionResult>({
        schemaName: "rwa_qualitative_fields",
        schema: SCHEMA,
        system: SYSTEM,
        user: `DOCUMENT (source: ${doc.url}):\n\n${doc.text}`,
    });

    if (!result) return {};

    const fields: FieldMap = {};

    const add = (key: keyof FieldMap, source: string, ext: Extracted) => {
        if (!ext || isUnknown(ext.value)) return;
        const raw = citedField(source, ext.value, doc.url, ext.text_span);
        fields[key] = enforceCitation(raw, doc.text);
    };

    add("wrapper_type", "llm:prospectus", result.wrapper_type);
    add("redemption_speed", "llm:terms", result.redemption_speed);
    add("redemption_cap", "llm:terms", result.redemption_cap);
    add("jurisdiction", "llm:terms", result.jurisdiction);
    add("custodian", "llm:prospectus", result.custodian);

    return fields;
}
