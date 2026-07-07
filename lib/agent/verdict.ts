// ---------------------------------------------------------------------------
// Agent-facing backing verdict — the honest contract a machine calls
// ---------------------------------------------------------------------------
// The whole edge of this tool is the caveat, so the agent contract must make the
// caveat IMPOSSIBLE to drop. A human reading "unverifiable" on a card applies
// judgment; an agent acts on whatever shape it gets, at machine speed, with real
// money. So the response is deliberately un-collapsible to a boolean:
//
//   • There is NO `safe: true/false`. Ever.
//   • Backing is TWO orthogonal axes an agent must read together: `tier` (did the
//     backing claim reconcile — the independence/color axis) and `confidence`
//     (how we read the figure — the extraction axis). "verified_backed" + "auto"
//     is a real, common cell: independently attested but we parsed the number.
//   • `meaning` states in one sentence what the verdict DOES and DOES NOT mean.
//   • `trust_boundary` names exactly where verification stops and institutional
//     trust begins — top-level, not buried metadata.
//   • `caveats` is REQUIRED non-empty unless (tier === verified_backed &&
//     confidence === verified). Absence of a red flag is never a green light.
//
// This shape is generated server-side so the web card, the CLI, and the MCP tool
// all speak the same honest contract. Build the core once; wrap it three ways.
// ---------------------------------------------------------------------------

import type {
    Assessment,
    Confidence,
    DimensionKey,
    EvidenceExtraction,
    EvidenceItem,
    EvidenceSourceType,
    Flag,
    NormalizedAssetRecord,
} from "@/lib/contracts";
import {
    EVIDENCE_SOURCE_LABELS,
    EVIDENCE_TRUST_BOUNDARY,
    independenceLabel,
} from "@/lib/display";

/** The backing tier — the color/independence axis, phrased so it can't reduce to a bool. */
export type AgentBackingTier =
    | "verified_backed" // green: backing claim reconciled against an independent source
    | "partially_verified" // amber: part reconciled, remainder unconfirmed
    | "does_not_reconcile" // red: sources conflict / reserves fail supply×NAV
    | "unverifiable"; // unknown: no independent evidence exists to confirm or deny

const TIER_BY_FLAG: Record<Flag, AgentBackingTier> = {
    green: "verified_backed",
    amber: "partially_verified",
    red: "does_not_reconcile",
    unknown: "unverifiable",
};

export interface AgentEvidence {
    source_type: EvidenceSourceType;
    source_label: string;
    /** 0–5. Who produced it → the ceiling color it can support. */
    independence: number;
    independence_label: string;
    /** How we read it (on-chain read / structured / parsed) → the confidence label. */
    extraction: EvidenceExtraction;
    confidence: Confidence;
    coverage_pct: number;
    as_of: string;
    citation: string | null;
    /** Where trust bottoms out for THIS source. */
    trust_boundary: string;
    note?: string;
}

export interface AgentDimension {
    flag: Flag;
    confidence: Confidence;
    reason: string;
    sources: string[];
}

export interface AgentVerdict {
    asset: {
        asset_id: string;
        symbol: string;
        name: string;
        issuer_name: string | null;
    };
    backing: {
        /** Independence axis. Read WITH `confidence`, never alone. */
        tier: AgentBackingTier;
        /** Extraction axis. Read WITH `tier`, never alone. */
        confidence: Confidence;
        reason: string;
        /** What this verdict does and does NOT mean. Surface this to the user. */
        meaning: string;
        /** Where verification stops and institutional trust begins (may be null). */
        trust_boundary: string | null;
        /** Required non-empty unless tier=verified_backed AND confidence=verified. */
        caveats: string[];
    };
    /** Full per-dimension detail for agents that reason deeper. */
    dimensions: Record<DimensionKey, AgentDimension>;
    /** The evidence set behind the backing verdict, with both axes exposed. */
    evidence: AgentEvidence[];
    /** Where a caller would actually transact (informational). */
    provider_url: string | null;
    as_of: string;
    /** Global scope statement — this is a BACKING verifiability read, nothing more. */
    disclaimer: string;
}

const DISCLAIMER =
    "Verifiability read of asset BACKING only. Not investment advice, not a safety or " +
    "solvency guarantee, and not a read on any app/wrapper used to access the asset. " +
    "`tier` and `confidence` are two axes and must be read together.";

/** The strongest (most independent) usable evidence item, or null. */
function strongestEvidence(evidence: EvidenceItem[]): EvidenceItem | null {
    const usable = evidence.filter((e) => e.confidence !== "unverifiable");
    if (usable.length === 0) return null;
    return usable.reduce((best, e) => (e.independence > best.independence ? e : best));
}

function meaningFor(tier: AgentBackingTier, strongest: EvidenceItem | null): string {
    const via = strongest ? ` via ${EVIDENCE_SOURCE_LABELS[strongest.source_type].toLowerCase()}` : "";
    const boundary = strongest ? EVIDENCE_TRUST_BOUNDARY[strongest.source_type] : null;
    switch (tier) {
        case "verified_backed":
            return (
                `Backing is independently verified${via}: the backing claim reconciles against an ` +
                `independent source. This is NOT a safety guarantee or investment advice, and it ` +
                `verifies nothing beyond that source's boundary${boundary ? ` — ${boundary}` : "."}`
            );
        case "partially_verified":
            return (
                "Backing is only PARTIALLY verified: part of the claim reconciles against an " +
                "independent source and the remainder is unconfirmed. Do not treat this as fully backed — read the caveats."
            );
        case "does_not_reconcile":
            return (
                "Backing DOES NOT reconcile: independent sources conflict, or reserves fail the " +
                "supply×NAV check. Do not rely on the stated backing claim."
            );
        case "unverifiable":
            return (
                "Backing could NOT be independently verified from available sources. This is not a " +
                "judgment that the asset is unsafe — it means the evidence to confirm or deny backing " +
                "does not exist or is not machine-readable. Absence of a red flag is NOT a green light."
            );
    }
}

function buildCaveats(
    tier: AgentBackingTier,
    confidence: Confidence,
    qualitativePending: boolean,
): string[] {
    const out: string[] = [];
    if (tier === "unverifiable")
        out.push("No independent verification of backing is available — treat backing as unconfirmed.");
    if (tier === "does_not_reconcile")
        out.push("Backing figures conflict or fail reconciliation — do not rely on the stated backing.");
    if (tier === "partially_verified")
        out.push("Only part of the backing is independently verified; treat the remainder as unconfirmed.");
    if (confidence !== "verified")
        out.push(
            confidence === "auto"
                ? 'Backing confidence is "auto": the figure was auto-extracted/parsed — check the cited source before relying on it.'
                : 'Backing confidence is "unverifiable": the figure could not be independently confirmed.',
        );
    if (qualitativePending)
        out.push("Some qualitative fields are still resolving; this read may update on a later call.");
    return out;
}

function toAgentEvidence(e: EvidenceItem): AgentEvidence {
    return {
        source_type: e.source_type,
        source_label: EVIDENCE_SOURCE_LABELS[e.source_type],
        independence: e.independence,
        independence_label: independenceLabel(e.independence),
        extraction: e.extraction,
        confidence: e.confidence,
        coverage_pct: e.coverage_pct,
        as_of: e.as_of,
        citation: e.citation?.text_span ?? null,
        trust_boundary: EVIDENCE_TRUST_BOUNDARY[e.source_type],
        ...(e.note ? { note: e.note } : {}),
    };
}

/**
 * Reshapes the internal record + assessment into the agent-honest contract.
 * Pure — no I/O — so its invariants can be unit-tested directly.
 */
export function toAgentVerdict(
    record: NormalizedAssetRecord,
    assessment: Assessment,
    providerUrl: string | null = null,
): AgentVerdict {
    const backingDim = assessment.dimensions.backing;
    const tier = TIER_BY_FLAG[backingDim.flag];
    const evidence = record.backing_evidence ?? [];
    const strongest = strongestEvidence(evidence);

    const dimensions = Object.fromEntries(
        (Object.keys(assessment.dimensions) as DimensionKey[]).map((k) => {
            const d = assessment.dimensions[k];
            return [k, { flag: d.flag, confidence: d.confidence, reason: d.reason, sources: d.sources }];
        }),
    ) as Record<DimensionKey, AgentDimension>;

    return {
        asset: {
            asset_id: record.asset_id,
            symbol: record.identifiers.symbol,
            name: record.identifiers.name,
            issuer_name: record.identifiers.issuer_name ?? null,
        },
        backing: {
            tier,
            confidence: backingDim.confidence,
            reason: backingDim.reason,
            meaning: meaningFor(tier, strongest),
            trust_boundary: strongest ? EVIDENCE_TRUST_BOUNDARY[strongest.source_type] : null,
            caveats: buildCaveats(tier, backingDim.confidence, record.qualitative_pending === true),
        },
        dimensions,
        evidence: evidence.map(toAgentEvidence),
        provider_url: providerUrl,
        as_of: assessment.computed_at,
        disclaimer: DISCLAIMER,
    };
}
