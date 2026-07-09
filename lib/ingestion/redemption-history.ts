// ---------------------------------------------------------------------------
// Redemption-history shaping (pure, network-free)
// ---------------------------------------------------------------------------
// Assembles the three-signal RedemptionHistoryData without conflating the
// signals: a live on-chain pause read (verified), the registered-MMF N-MFP
// liquidity-fee flag + events (verified structured, from the EDGAR adapter), and
// curated incidents (auto + citation, from the registry). The live+incident part
// and the fee part arrive from different adapters, so this module also merges
// the EDGAR fee contribution into the base.
// ---------------------------------------------------------------------------

import type {
    Confidence,
    DimensionRead,
    FeeEvent,
    Flag,
    Method,
    RedemptionHistoryData,
    RedemptionIncident,
} from "@/lib/contracts";

function onchain(value: boolean | null, source: string, as_of: string): DimensionRead<boolean> {
    return { value, source, method: "onchain_read" as Method, confidence: "verified" as Confidence, as_of };
}

/** The N-MFP fee flag: a `verified` structured regulator read (re-derivable). */
function feeFlagRead(value: boolean | null, as_of: string): DimensionRead<boolean> {
    return { value, source: "SEC EDGAR N-MFP", method: "reference_api" as Method, confidence: "verified" as Confidence, as_of };
}

/** Builds the base payload from the live on-chain read + curated incidents.
 *  The fee flag/events start empty; the EDGAR contribution is merged later. */
export function buildRedemptionHistoryData(input: {
    currentPaused: boolean | null;
    currentFrozen: boolean | null;
    incidents: RedemptionIncident[];
    asOf: string;
    underlyingCeiling?: Flag;
}): RedemptionHistoryData {
    return {
        current_paused: onchain(input.currentPaused, "onchain:pause", input.asOf),
        current_frozen: onchain(input.currentFrozen, "onchain:freeze", input.asOf),
        latest_fee_flag: feeFlagRead(null, input.asOf),
        fee_events: [],
        incidents: input.incidents,
        ...(input.underlyingCeiling ? { underlying_ceiling: input.underlyingCeiling } : {}),
    };
}

/** Builds the EDGAR-side fee contribution (a fee-only payload the orchestrator
 *  merges into the base). `feeApplied` is the latest N-MFP fee flag. */
export function buildFeeContribution(feeApplied: boolean | null, feeEvents: FeeEvent[], asOf: string): RedemptionHistoryData {
    return {
        current_paused: onchain(null, "onchain:pause", asOf),
        current_frozen: onchain(null, "onchain:freeze", asOf),
        latest_fee_flag: feeFlagRead(feeApplied, asOf),
        fee_events: feeEvents,
        incidents: [],
    };
}

/** Merges the EDGAR fee contribution into a base (live+incidents). Either may be
 *  undefined; returns the combined payload, or undefined if neither exists. */
export function mergeRedemptionHistory(
    base: RedemptionHistoryData | undefined,
    fee: RedemptionHistoryData | undefined,
): RedemptionHistoryData | undefined {
    if (!base) return fee;
    if (!fee) return base;
    return {
        ...base,
        latest_fee_flag: fee.latest_fee_flag,
        fee_events: [...base.fee_events, ...fee.fee_events],
    };
}

/** True when there is any basis to assess redemption restrictions: a readable
 *  live pause state, a fee flag/event, or a curated incident. Without any of
 *  these the dimension stays `unknown` rather than greening the long tail. */
export function hasAssessmentBasis(data: RedemptionHistoryData): boolean {
    return (
        data.current_paused.value != null ||
        data.current_frozen.value != null ||
        data.latest_fee_flag.value != null ||
        data.incidents.length > 0 ||
        data.fee_events.length > 0
    );
}
