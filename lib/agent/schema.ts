// ---------------------------------------------------------------------------
// JSON Schema for the AgentVerdict contract
// ---------------------------------------------------------------------------
// Served at GET /api/schema so an integrator or agent can validate/type the
// /api/verify response without reading source. `schema.test.ts` asserts this
// stays in sync with the TypeScript AgentVerdict shape (fails on drift).
// ---------------------------------------------------------------------------

const TIER = ["verified_backed", "partially_verified", "does_not_reconcile", "unverifiable"] as const;
const CONFIDENCE = ["verified", "auto", "unverifiable"] as const;
const FRESHNESS = ["live", "aging", "stale"] as const;
const FLAG = ["green", "amber", "red", "unknown"] as const;
const EXTRACTION = ["onchain_read", "structured", "llm_extracted"] as const;
const SOURCE_TYPE = [
    "regulator_filing",
    "onchain_holdings",
    "auditor_attestation",
    "admin_report",
    "custodian_feed",
    "oracle_por",
    "issuer_selfreport",
] as const;

export const AGENT_VERDICT_SCHEMA = {
    $schema: "http://json-schema.org/draft-07/schema#",
    $id: "https://rwa-analyzer/schemas/agent-verdict.json",
    title: "AgentVerdict",
    description:
        "Un-collapsible backing-verifiability verdict. Read tier + confidence + freshness TOGETHER; " +
        "never reduce to a boolean. There is no safe/is_safe field.",
    type: "object",
    additionalProperties: false,
    required: ["asset", "backing", "dimensions", "evidence", "provider_url", "as_of", "disclaimer"],
    properties: {
        asset: {
            type: "object",
            additionalProperties: false,
            required: ["asset_id", "symbol", "name", "issuer_name"],
            properties: {
                asset_id: { type: "string", description: "'{chainId}:{address}' (lowercased)." },
                symbol: { type: "string" },
                name: { type: "string" },
                issuer_name: { type: ["string", "null"] },
            },
        },
        backing: {
            type: "object",
            additionalProperties: false,
            required: [
                "tier",
                "confidence",
                "freshness",
                "next_expected_update",
                "reason",
                "meaning",
                "trust_boundary",
                "caveats",
            ],
            properties: {
                tier: { enum: TIER, description: "Independence axis. Read WITH confidence, never alone." },
                confidence: { enum: CONFIDENCE, description: "Extraction axis. Read WITH tier, never alone." },
                freshness: {
                    anyOf: [{ enum: FRESHNESS }, { type: "null" }],
                    description: "Evidence age vs source cadence. null when there is nothing to age.",
                },
                next_expected_update: {
                    type: ["string", "null"],
                    description: "ISO-8601; when the backing evidence is next expected to refresh.",
                },
                reason: { type: "string" },
                meaning: { type: "string", description: "What this verdict does and does NOT mean." },
                trust_boundary: {
                    type: ["string", "null"],
                    description: "Where verification stops and institutional trust begins.",
                },
                caveats: {
                    type: "array",
                    items: { type: "string" },
                    description: "Required non-empty unless tier=verified_backed AND confidence=verified AND freshness=live.",
                },
            },
        },
        dimensions: {
            type: "object",
            description: "Per-dimension detail, keyed by backing | redemption | access | structure.",
            additionalProperties: {
                type: "object",
                additionalProperties: false,
                required: ["flag", "confidence", "reason", "sources"],
                properties: {
                    flag: { enum: FLAG },
                    confidence: { enum: CONFIDENCE },
                    reason: { type: "string" },
                    sources: { type: "array", items: { type: "string" } },
                },
            },
        },
        evidence: {
            type: "array",
            description: "The evidence set behind the backing verdict, both axes exposed per item.",
            items: {
                type: "object",
                additionalProperties: false,
                required: [
                    "source_type",
                    "source_label",
                    "independence",
                    "independence_label",
                    "extraction",
                    "confidence",
                    "coverage_pct",
                    "as_of",
                    "freshness",
                    "next_expected",
                    "citation",
                    "trust_boundary",
                ],
                properties: {
                    source_type: { enum: SOURCE_TYPE },
                    source_label: { type: "string" },
                    independence: { type: "integer", minimum: 0, maximum: 5 },
                    independence_label: { type: "string" },
                    extraction: { enum: EXTRACTION },
                    confidence: { enum: CONFIDENCE },
                    coverage_pct: { type: "number" },
                    as_of: { type: "string" },
                    freshness: { enum: FRESHNESS },
                    next_expected: { type: "string" },
                    citation: { type: ["string", "null"], description: "Verbatim source span, or null." },
                    trust_boundary: { type: "string" },
                    note: { type: "string" },
                },
            },
        },
        provider_url: { type: ["string", "null"], description: "Where a caller would actually transact (informational)." },
        as_of: { type: "string", description: "ISO-8601 timestamp the assessment was computed." },
        disclaimer: { type: "string" },
    },
} as const;
