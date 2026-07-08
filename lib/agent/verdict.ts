// ---------------------------------------------------------------------------
// Agent-facing backing verdict
// ---------------------------------------------------------------------------
// Server-side contract shared by the web UI, CLI, and MCP server.
//
//   - No `safe: true/false` boolean.
//   - `tier` (independence/reconciliation) and `confidence` (extraction) are separate axes.
//   - `meaning`, `trust_boundary`, and `caveats` are required unless fully verified.
//
// Pure function: `toAgentVerdict()` has no I/O and is unit-tested directly.
// ---------------------------------------------------------------------------

import type {
    Assessment,
    Confidence,
    DimensionKey,
    EvidenceExtraction,
    EvidenceItem,
    EvidenceSourceType,
    Flag,
    Freshness,
    NormalizedAssetRecord,
} from "@/lib/contracts";
import {
    EVIDENCE_SOURCE_LABELS,
    EVIDENCE_TRUST_BOUNDARY,
    independenceLabel,
} from "@/lib/display";
import { freshnessOf, nextExpectedUpdate } from "@/lib/computation/freshness";

/** The backing tier - the color/independence axis, phrased so it can't reduce to a bool. */
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
    /** Evidence age relative to this source's expected cadence. */
    freshness: Freshness;
    /** When this evidence is next expected to refresh (as_of + cadence). */
    next_expected: string;
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
        /** Freshness axis. A green is a historical claim; read this too. Null
         *  when there is no dateable evidence to age (e.g. unverifiable). */
        freshness: Freshness | null;
        /** When the backing evidence is next expected to refresh (may be null). */
        next_expected_update: string | null;
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
    /** Global scope statement - this is a BACKING verifiability read, nothing more. */
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
                `verifies nothing beyond that source's boundary${boundary ? ` - ${boundary}` : "."}`
            );
        case "partially_verified":
            return (
                "Backing is only PARTIALLY verified: part of the claim reconciles against an " +
                "independent source and the remainder is unconfirmed. Do not treat this as fully backed - read the caveats."
            );
        case "does_not_reconcile":
            return (
                "Backing DOES NOT reconcile: independent sources conflict, or reserves fail the " +
                "supply×NAV check. Do not rely on the stated backing claim."
            );
        case "unverifiable":
            return (
                "Backing could NOT be independently verified from available sources. This is not a " +
                "judgment that the asset is unsafe - it means the evidence to confirm or deny backing " +
                "does not exist or is not machine-readable. Absence of a red flag is NOT a green light."
            );
    }
}

function buildCaveats(
    tier: AgentBackingTier,
    confidence: Confidence,
    freshness: Freshness | null,
    nextExpected: string | null,
    qualitativePending: boolean,
): string[] {
    const out: string[] = [];
    if (tier === "unverifiable")
        out.push("No independent verification of backing is available - treat backing as unconfirmed.");
    if (tier === "does_not_reconcile")
        out.push("Backing figures conflict or fail reconciliation - do not rely on the stated backing.");
    if (tier === "partially_verified")
        out.push("Only part of the backing is independently verified; treat the remainder as unconfirmed.");
    if (confidence !== "verified")
        out.push(
            confidence === "auto"
                ? 'Backing confidence is "auto": the figure was auto-extracted/parsed - check the cited source before relying on it.'
                : 'Backing confidence is "unverifiable": the figure could not be independently confirmed.',
        );
    if (freshness === "aging" || freshness === "stale") {
        const after = nextExpected ? ` Re-verify after ${nextExpected.slice(0, 10)}.` : "";
        out.push(`Backing evidence is ${freshness} relative to its expected refresh cadence.${after}`);
    }
    if (qualitativePending)
        out.push("Some qualitative fields are still resolving; this read may update on a later call.");
    return out;
}

function toAgentEvidence(e: EvidenceItem): AgentEvidence {
    const { level, next_expected } = freshnessOf(e);
    return {
        source_type: e.source_type,
        source_label: EVIDENCE_SOURCE_LABELS[e.source_type],
        independence: e.independence,
        independence_label: independenceLabel(e.independence),
        extraction: e.extraction,
        confidence: e.confidence,
        coverage_pct: e.coverage_pct,
        as_of: e.as_of,
        freshness: level,
        next_expected,
        citation: e.citation?.text_span ?? null,
        trust_boundary: EVIDENCE_TRUST_BOUNDARY[e.source_type],
        ...(e.note ? { note: e.note } : {}),
    };
}

/**
 * Reshapes the internal record + assessment into the agent-honest contract.
 * Pure - no I/O - so its invariants can be unit-tested directly.
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

    // The backing dimension owns the flag-affecting freshness (computed in
    // backing.ts). Absent (e.g. a manually-built assessment) defaults to `live`.
    // next_expected_update is clock-independent (as_of + cadence), so surfacing
    // it here is not time-fragile.
    // The dimension owns flag-affecting freshness. Absent + evidence present
    // (e.g. a manually-built assessment) defaults to `live` without recomputing
    // (not time-fragile). Absent + NO dateable evidence (e.g. unverifiable) is
    // null: there is nothing to age, so "live" would be misleading.
    const freshness: Freshness | null = backingDim.freshness ?? (strongest ? "live" : null);
    const next_expected_update = strongest ? nextExpectedUpdate(strongest) : null;

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
            freshness,
            next_expected_update,
            reason: backingDim.reason,
            meaning: meaningFor(tier, strongest),
            trust_boundary: strongest ? EVIDENCE_TRUST_BOUNDARY[strongest.source_type] : null,
            caveats: buildCaveats(
                tier,
                backingDim.confidence,
                freshness,
                next_expected_update,
                record.qualitative_pending === true,
            ),
        },
        dimensions,
        evidence: evidence.map(toAgentEvidence),
        provider_url: providerUrl,
        as_of: assessment.computed_at,
        disclaimer: DISCLAIMER,
    };
}
