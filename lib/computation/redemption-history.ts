// ---------------------------------------------------------------------------
// redemption_history dimension (v1.3) - the redemption-restriction track record
// ---------------------------------------------------------------------------
// Composes THREE distinct verification means without conflating them:
//   1. live on-chain pause/freeze  (verified)  → drives RED when currently on
//   2. N-MFP liquidity-fee flag/events (verified structured) → AMBER when a fee
//      was applied; a "no fee" flag supports a green
//   3. curated incident registry (auto + citation) → AMBER/RED, but AUTO
//      confidence, so a curated signal can never mint a verified green
//
// A green is an ABSENCE claim, freshness-scoped: "not currently restricted, and
// no restriction on record as of {date}" — never "provably never restricted".
// It rests only on VERIFIED reads (pause=false and/or fee-flag=N); curated
// incidents only ever demote.
// ---------------------------------------------------------------------------

import {
    type DimensionAssessment,
    type FieldName,
    type NormalizedAssetRecord,
    type RedemptionHistoryData,
    type RedemptionIncident,
} from "@/lib/contracts";
import { finalizeReadDimension, unknownDimension, ONCHAIN_CADENCE_MS } from "@/lib/computation/dimension";
import { hasAssessmentBasis } from "@/lib/ingestion/redemption-history";
import { freshnessAt } from "@/lib/computation/freshness";
import { shortDate } from "@/lib/computation/util";

const INPUTS: FieldName[] = [];
// N-MFP is a MONTHLY filing; a month-old fee flag is `live`, not stale. Measuring
// it against the daily on-chain cadence would wrongly demote every registered MMF.
const MONTHLY_CADENCE_MS = 35 * 24 * 60 * 60 * 1000;

/** Picks the freshness driver: the signal most stale RELATIVE TO ITS OWN cadence
 *  (on-chain reads daily, the N-MFP fee flag monthly), so a fresh live read and a
 *  month-old monthly filing both read `live`. */
function governingFreshness(data: RedemptionHistoryData): { asOf: string; cadenceMs: number } {
    const signals: { asOf: string; cadenceMs: number }[] = [];
    if (data.current_paused.value != null) signals.push({ asOf: data.current_paused.as_of, cadenceMs: ONCHAIN_CADENCE_MS });
    if (data.current_frozen.value != null) signals.push({ asOf: data.current_frozen.as_of, cadenceMs: ONCHAIN_CADENCE_MS });
    if (data.latest_fee_flag.value != null) signals.push({ asOf: data.latest_fee_flag.as_of, cadenceMs: MONTHLY_CADENCE_MS });
    if (signals.length === 0) return { asOf: data.current_paused.as_of, cadenceMs: ONCHAIN_CADENCE_MS };
    return signals.reduce((worst, s) =>
        freshnessAt(s.asOf, s.cadenceMs).ratio > freshnessAt(worst.asOf, worst.cadenceMs).ratio ? s : worst,
    );
}

function describeIncident(i: RedemptionIncident): string {
    const when = shortDate(i.as_of);
    const status = i.resolved_at ? `resolved ${shortDate(i.resolved_at)}` : "ongoing";
    return `${i.kind.replace(/_/g, " ")} (${i.regime.replace(/_/g, " ")}) on ${when}, ${status} — per ${i.source}`;
}

const OFFCHAIN_NOTE =
    " This reads current on-chain state, the latest regulator filing, and a curated incident record — it is not a guarantee redemptions will always be honored.";

export function assessRedemptionHistory(record: NormalizedAssetRecord): DimensionAssessment {
    const data: RedemptionHistoryData | undefined = record.redemption_history_data;
    if (!data || !hasAssessmentBasis(data)) {
        return unknownDimension("No basis to assess redemption restrictions for this asset (no pause mechanism, filing, or incident on record).");
    }

    const pausedNow = data.current_paused.value === true || data.current_frozen.value === true;
    const feeApplied = data.latest_fee_flag.value === true || data.fee_events.length > 0;
    const activeIncidents = data.incidents.filter((i) => !i.resolved_at);
    const isMmf = data.latest_fee_flag.value != null; // we read an N-MFP fee flag → it's a registered MMF

    // Confidence rests only on the verified reads that were actually present.
    const verifiedUsed = [data.current_paused, data.current_frozen, data.latest_fee_flag].filter((r) => r.value != null);
    // A curated incident driving the flag caps confidence at `auto`.
    const autoMarker = { value: 1, source: data.incidents[0]?.source ?? "registry", confidence: "auto" as const, as_of: data.incidents[0]?.as_of ?? "" };

    const mmfNote = isMmf
        ? " Regulatory redemption gates are structurally unavailable for money market funds post-Oct-2023; this tracks liquidity fees."
        : "";

    // Freshness ages the claim by each signal's OWN cadence (on-chain daily,
    // N-MFP monthly) so a normal month-old filing does not wrongly demote it.
    const fresh = governingFreshness(data);
    const asOf = fresh.asOf;

    // 1. Currently paused/frozen on-chain — the strongest, verified signal.
    if (pausedNow) {
        return finalizeReadDimension({
            flag: "red",
            reason: `Redemptions are currently restricted on-chain (the token is paused/frozen).${OFFCHAIN_NOTE}`,
            used: verifiedUsed,
            asOf,
            inputs: INPUTS,
            cadenceMs: fresh.cadenceMs,
            ceiling: data.underlying_ceiling,
        });
    }

    // 2. An active (unresolved) curated suspension/gate/cap — a restriction on
    //    record. Auto confidence (curated), so it demotes but is honestly tiered.
    if (activeIncidents.length > 0) {
        return finalizeReadDimension({
            flag: "red",
            reason: `A redemption restriction is on record and unresolved: ${activeIncidents.map(describeIncident).join("; ")}.${OFFCHAIN_NOTE}`,
            used: [...verifiedUsed, autoMarker],
            asOf,
            inputs: INPUTS,
            cadenceMs: fresh.cadenceMs,
            ceiling: data.underlying_ceiling,
        });
    }

    // 3. A liquidity fee was applied (verified structured) and/or a resolved past
    //    incident (curated) — a material history, not a clean green.
    if (feeApplied || data.incidents.length > 0) {
        const parts: string[] = [];
        if (feeApplied) parts.push(`a liquidity fee was applied${isMmf ? " (per N-MFP)" : ""}`);
        if (data.incidents.length > 0) parts.push(`past restriction(s) on record: ${data.incidents.map(describeIncident).join("; ")}`);
        const drivenByCurated = data.incidents.length > 0 && !feeApplied;
        return finalizeReadDimension({
            flag: "amber",
            reason: `Not currently restricted, but there is redemption-restriction history — ${parts.join("; ")}.${mmfNote}${OFFCHAIN_NOTE}`,
            used: drivenByCurated ? [...verifiedUsed, autoMarker] : verifiedUsed,
            asOf,
            inputs: INPUTS,
            cadenceMs: fresh.cadenceMs,
            ceiling: data.underlying_ceiling,
        });
    }

    // 4. Green: not currently restricted and nothing on record — an ABSENCE claim,
    //    freshness-scoped, resting only on verified reads.
    return finalizeReadDimension({
        flag: "green",
        reason: `Not currently restricted, and no redemption restriction on record as of ${shortDate(asOf)}.${mmfNote}${OFFCHAIN_NOTE}`,
        used: verifiedUsed,
        asOf,
        inputs: INPUTS,
        cadenceMs: fresh.cadenceMs,
        ceiling: data.underlying_ceiling,
    });
}
