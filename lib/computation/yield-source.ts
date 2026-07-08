// ---------------------------------------------------------------------------
// yield_source dimension (v1.2) - organic vs. inflationary decomposition
// ---------------------------------------------------------------------------
// Turns the on-chain yield decomposition (Contract A `yield_source_data`) into a
// dimension verdict. The verifiable core is the ORGANIC rate: borrow interest
// derived from the reserve's on-chain rate (`verified`). Reward emissions are
// the softer signal (`auto` when cross-referenced from DeFiLlama), and the split
// is the honest output.
//
// Honesty rules (mirroring backing):
//   - GREEN rests only on a `verified` on-chain organic read that is the
//     dominant share of the yield. An `auto` reward figure can never earn a
//     green (it caps the dimension at amber, matching the confidence cap).
//   - `unknown` is first-class: no readable rate -> unknown, never a false green.
//   - Emissions unknown are never assumed 0; the split stays unverified (amber).
//   - Freshness demotes a stale read; the anti-laundering ceiling caps the flag
//     at the underlying's own verification status.
// ---------------------------------------------------------------------------

import {
    minConfidence,
    type Confidence,
    type DimensionAssessment,
    type DimensionRead,
    type FieldName,
    type Flag,
    type NormalizedAssetRecord,
    type YieldSourceData,
} from "@/lib/contracts";
import { capFlag, read, usable } from "@/lib/computation/util";
import { applyFreshnessAt } from "@/lib/computation/freshness";

const DAY_MS = 24 * 60 * 60 * 1000;
const INPUTS: FieldName[] = ["yield_apy"];

/** Organic must be at least this share of total yield to be a clean green. */
const ORGANIC_GREEN_SHARE = 0.9;
/** Total yield below this (%) is treated as ~0 (nothing to decompose). */
const NEGLIGIBLE_YIELD = 0.01;
/** A headline yield above this (%) while verified organic+reward read ~0 is a
 *  data-integrity contradiction. */
const CONTRADICTION_HEADLINE_MIN = 0.5;

const TRUST_BOUNDARY =
    " Yield is real on-chain interest; the token's value still depends on pool " +
    "solvency and the collateral oracle - see market risk.";

function fmt(apy: number): string {
    return apy.toFixed(apy >= 10 ? 0 : 1);
}

function unknownDim(reason: string): DimensionAssessment {
    return { flag: "unknown", reason, inputs: [], confidence: "unverifiable", sources: [] };
}

/**
 * Builds the final verdict: applies the anti-laundering ceiling, then the
 * freshness gradient, and caps confidence at the min of the reads used.
 */
function decide(
    flag: Flag,
    reason: string,
    used: DimensionRead[],
    asOf: string,
    ceiling?: Flag,
): DimensionAssessment {
    const capped = ceiling ? capFlag(flag, ceiling) : flag;
    const cappedReason =
        capped !== flag
            ? `${reason} Capped at the underlying's own verification ceiling (${ceiling}); you cannot be safer than the asset you lent.`
            : reason;
    const fr = applyFreshnessAt(capped, cappedReason, asOf, DAY_MS, "On-chain read");
    const confidence: Confidence = used.length ? minConfidence(...used.map((u) => u.confidence)) : "unverifiable";
    const sources = [...new Set(used.map((u) => u.source))];
    return { flag: fr.flag, reason: fr.reason, inputs: INPUTS, confidence, sources, freshness: fr.freshness };
}

export function assessYieldSource(record: NormalizedAssetRecord): DimensionAssessment {
    const data: YieldSourceData | undefined = record.yield_source_data;
    if (!data) {
        return unknownDim("No on-chain yield-source data for this asset; yield provenance is not assessed.");
    }

    const organic = data.organic_apy;
    const reward = data.reward_apy;
    const headline = usable(read<number>(record.fields, "yield_apy"));

    const organicKnown = organic.value != null && organic.confidence !== "unverifiable";
    const rewardKnown = reward.value != null && reward.confidence !== "unverifiable";

    if (!organicKnown && !rewardKnown) {
        return decide("unknown", "Neither organic nor reward yield could be read on-chain for this reserve.", [organic, reward], organic.as_of, data.underlying_ceiling);
    }

    // Data-integrity contradiction: our verified organic AND reward both read
    // ~0, yet an aggregator reports a material headline yield. The numbers do
    // not reconcile - a red, exactly the kind of disagreement this tool exists
    // to surface.
    if (
        organicKnown &&
        rewardKnown &&
        organic.value! + reward.value! < NEGLIGIBLE_YIELD &&
        headline != null &&
        headline.value > CONTRADICTION_HEADLINE_MIN
    ) {
        return decide(
            "red",
            `On-chain organic and reward yield both read ~0%, but an aggregator reports ~${fmt(headline.value)}% - the numbers do not reconcile.`,
            [organic, reward],
            organic.as_of,
            data.underlying_ceiling,
        );
    }

    // Organic verified but emissions could not be read: report the organic rate,
    // but the total mix is unverified, so this is never a clean green.
    if (organicKnown && !rewardKnown) {
        return decide(
            "amber",
            `~${fmt(organic.value!)}% organic borrow interest verified on-chain, but reward emissions could not be read, so the full yield mix is unverified.${TRUST_BOUNDARY}`,
            [organic],
            organic.as_of,
            data.underlying_ceiling,
        );
    }

    // Both known.
    const total = organic.value! + reward.value!;
    if (total < NEGLIGIBLE_YIELD) {
        return decide(
            "green",
            `Supply yield is ~0% with no reward emissions; the yield is fully accounted for on-chain.${TRUST_BOUNDARY}`,
            [organic, reward],
            organic.as_of,
            data.underlying_ceiling,
        );
    }

    const organicShare = organic.value! / total;
    const organicIsVerified = organic.confidence === "verified";
    const rewardIsVerified = reward.confidence === "verified";

    if (organicShare >= ORGANIC_GREEN_SHARE && organicIsVerified && rewardIsVerified) {
        const reason =
            reward.value! > 0
                ? `~${fmt(organic.value!)}% organic borrow interest + ~${fmt(reward.value!)}% emissions; ${(organicShare * 100).toFixed(0)}% of the yield is verified organic interest.${TRUST_BOUNDARY}`
                : `~${fmt(organic.value!)}% organic borrow interest, verified on-chain; no reward emissions.${TRUST_BOUNDARY}`;
        return decide("green", reason, [organic, reward], organic.as_of, data.underlying_ceiling);
    }

    // Emissions are a material share, or the reward figure is an aggregator
    // estimate - either way the yield is not a clean, fully-verified organic read.
    const emissionsPct = ((1 - organicShare) * 100).toFixed(0);
    const softNote = !rewardIsVerified ? " and the emissions figure is an aggregator estimate" : "";
    const kindNote = data.kind === "emissions" ? "emissions-dominated" : "a material emissions share";
    return decide(
        "amber",
        `~${fmt(organic.value!)}% organic + ~${fmt(reward.value!)}% emissions; ${kindNote} (${emissionsPct}% of yield)${softNote}, so the yield is not a clean organic read.${TRUST_BOUNDARY}`,
        [organic, reward],
        organic.as_of,
        data.underlying_ceiling,
    );
}
