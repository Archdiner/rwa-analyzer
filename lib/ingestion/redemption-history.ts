// ---------------------------------------------------------------------------
// Redemption-history shaping (pure, network-free)
// ---------------------------------------------------------------------------
// Assembles the three-signal RedemptionHistoryData without conflating the
// signals: a live on-chain pause read (verified), N-MFP liquidity-fee events
// (auto, from the EDGAR adapter), and curated incidents (auto + citation). The
// three arrive from different adapters, so this module also merges the EDGAR
// fee contribution into the base built from the live+registry read.
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

function read(value: boolean | null, source: string, as_of: string): DimensionRead<boolean> {
    return { value, source, method: "onchain_read" as Method, confidence: "verified" as Confidence, as_of };
}

/**
 * Builds the base payload from the live on-chain read + curated incidents.
 * `fee_events` start empty; the EDGAR adapter's contribution is merged later via
 * `mergeFeeEvents`.
 */
export function buildRedemptionHistoryData(input: {
    currentPaused: boolean | null;
    currentFrozen: boolean | null;
    incidents: RedemptionIncident[];
    asOf: string;
    underlyingCeiling?: Flag;
}): RedemptionHistoryData {
    return {
        current_paused: read(input.currentPaused, "onchain:pause", input.asOf),
        current_frozen: read(input.currentFrozen, "onchain:freeze", input.asOf),
        fee_events: [],
        incidents: input.incidents,
        ...(input.underlyingCeiling ? { underlying_ceiling: input.underlyingCeiling } : {}),
    };
}

/** Merges N-MFP fee events (from the EDGAR adapter) into an existing payload,
 *  or synthesizes a payload if only fee events are present (registered fund with
 *  no on-chain pause mechanism and no curated incidents). */
export function mergeFeeEvents(
    base: RedemptionHistoryData | undefined,
    feeEvents: FeeEvent[],
    asOf: string,
): RedemptionHistoryData {
    if (base) return { ...base, fee_events: [...base.fee_events, ...feeEvents] };
    return {
        current_paused: read(null, "onchain:pause", asOf),
        current_frozen: read(null, "onchain:freeze", asOf),
        fee_events: feeEvents,
        incidents: [],
    };
}

/** True when there is any basis to assess redemption restrictions: a readable
 *  live pause state, a curated incident, or a fee event. Without any of these
 *  the dimension stays `unknown` rather than greening the long tail blindly. */
export function hasAssessmentBasis(data: RedemptionHistoryData): boolean {
    return (
        data.current_paused.value != null ||
        data.current_frozen.value != null ||
        data.incidents.length > 0 ||
        data.fee_events.length > 0
    );
}
