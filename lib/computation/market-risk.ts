// ---------------------------------------------------------------------------
// market_risk dimension (v1.2) - the deep on-chain risk read
// ---------------------------------------------------------------------------
// The DeFiLlama differentiator: reads the reserve's ACTUAL on-chain risk state
// and grades every derivable signal honestly. Each signal is ok/caution/critical
// or `unknown` (never assumed benign); the dimension flag is the worst material
// signal, and a green requires that NO signal is critical AND no material signal
// is an unreadable `unknown`.
//
// Signals (all on-chain): bad-debt/deficit, utilization, collateralization
// buffer, caps proximity, reserve state (frozen/paused/inactive), oracle
// dependency. Off-chain risk (audits, exploit history, admin-key/upgradeability)
// is DEFERRED - surfaced as an explicit scope caveat, never silently omitted and
// never blocking the on-chain green (green means "low ON-CHAIN risk", scoped).
//
// Green rests only on arithmetic over on-chain reads; it is NOT a safety claim.
// ---------------------------------------------------------------------------

import {
    minConfidence,
    type Confidence,
    type DimensionAssessment,
    type DimensionRead,
    type FieldName,
    type Flag,
    type MarketRiskData,
    type NormalizedAssetRecord,
    type RiskSignalLevel,
} from "@/lib/contracts";
import { capFlag } from "@/lib/computation/util";
import { applyFreshnessAt } from "@/lib/computation/freshness";

const DAY_MS = 24 * 60 * 60 * 1000;
const INPUTS: FieldName[] = [];

// Utilization bands.
const UTIL_CAUTION = 0.8;
const UTIL_CRITICAL = 0.95;
// Deficit (bad debt) as a share of supplied.
const DEFICIT_DUST = 0.001; // < 0.1% of supply = dust from liquidation mechanics
const DEFICIT_CRITICAL = 0.01; // >= 1% of supply = material bad debt (solvency)
// Collateralization buffer = liquidationThreshold - ltv.
const BUFFER_THIN = 0.02;
// Caps proximity.
const CAP_NEAR = 0.98;

const OFFCHAIN_CAVEAT =
    " Off-chain risks (audit coverage, exploit history, admin-key/upgradeability) " +
    "are outside this on-chain read and remain unknown.";

interface Signal {
    key: string;
    level: RiskSignalLevel;
    detail: string;
}

function n(read: DimensionRead<number> | undefined): number | null {
    return read && read.value != null ? read.value : null;
}
function b(read: DimensionRead<boolean> | undefined): boolean | null {
    return read && read.value != null ? read.value : null;
}

function pct(x: number): string {
    const v = x * 100;
    // One decimal for small shares (e.g. a 0.3% deficit), integers for the rest
    // (e.g. 87% utilization), so a sub-1% signal never rounds away to "0%".
    return v > 0 && v < 10 ? `${v.toFixed(1)}%` : `${v.toFixed(0)}%`;
}

// ── Per-signal graders ───────────────────────────────────────────────────────

function gradeDeficit(d: MarketRiskData): Signal {
    const deficit = n(d.deficit);
    const supplied = n(d.total_supplied);
    if (deficit == null) {
        return { key: "deficit", level: "unknown", detail: "bad-debt/deficit could not be read on this version" };
    }
    if (deficit <= 0) return { key: "deficit", level: "ok", detail: "no reserve deficit" };
    if (supplied == null || supplied <= 0) {
        return { key: "deficit", level: "critical", detail: "a reserve deficit is present" };
    }
    const ratio = deficit / supplied;
    if (ratio < DEFICIT_DUST) return { key: "deficit", level: "ok", detail: `dust deficit (${pct(ratio)} of supply)` };
    if (ratio < DEFICIT_CRITICAL) return { key: "deficit", level: "caution", detail: `bad debt is ${pct(ratio)} of supply` };
    return { key: "deficit", level: "critical", detail: `material bad debt: ${pct(ratio)} of supply` };
}

function gradeUtilization(d: MarketRiskData): Signal {
    const u = n(d.utilization);
    const avail = n(d.available_liquidity);
    if (u == null) return { key: "utilization", level: "unknown", detail: "utilization could not be read" };
    const availNote = avail != null ? `, ~${Math.round(avail).toLocaleString()} available` : "";
    if (u > UTIL_CRITICAL) return { key: "utilization", level: "critical", detail: `utilization ${pct(u)} - liquidity crunch${availNote}` };
    if (u >= UTIL_CAUTION) return { key: "utilization", level: "caution", detail: `utilization ${pct(u)} - withdrawal risk${availNote}` };
    return { key: "utilization", level: "ok", detail: `utilization ${pct(u)}${availNote}` };
}

function gradeBuffer(d: MarketRiskData): Signal {
    const ltv = n(d.ltv);
    const lt = n(d.liquidation_threshold);
    if (ltv == null || lt == null) return { key: "buffer", level: "unknown", detail: "collateral config could not be read" };
    if (lt === 0) return { key: "buffer", level: "ok", detail: "not enabled as collateral" };
    const buffer = lt - ltv;
    if (buffer <= 0) return { key: "buffer", level: "critical", detail: `LTV (${pct(ltv)}) >= liquidation threshold (${pct(lt)})` };
    if (buffer < BUFFER_THIN) return { key: "buffer", level: "caution", detail: `thin collateral buffer (${pct(buffer)}), reserve-level config` };
    return { key: "buffer", level: "ok", detail: `collateral buffer ${pct(buffer)} (reserve-level config, not per-borrower solvency)` };
}

function gradeCaps(d: MarketRiskData): Signal {
    const supplied = n(d.total_supplied);
    const supplyCap = n(d.supply_cap);
    const borrowed = n(d.total_borrowed);
    const borrowCap = n(d.borrow_cap);
    // Without the totals we cannot assess cap proximity - unknown, not a false
    // "within caps" ok (a disabled/absent cap must not mask unreadable state).
    if (supplied == null && borrowed == null) {
        return { key: "caps", level: "unknown", detail: "cap proximity could not be assessed" };
    }
    const near: string[] = [];
    if (supplyCap != null && supplyCap > 0 && supplied != null && supplied / supplyCap >= CAP_NEAR) near.push("supply cap");
    if (borrowCap != null && borrowCap > 0 && borrowed != null && borrowed / borrowCap >= CAP_NEAR) near.push("borrow cap");
    if (near.length) return { key: "caps", level: "caution", detail: `near ${near.join(" and ")}` };
    return { key: "caps", level: "ok", detail: "within supply/borrow caps" };
}

function gradeReserveState(d: MarketRiskData): Signal {
    const active = b(d.is_active);
    const frozen = b(d.is_frozen);
    const paused = b(d.is_paused);
    if (active === false) return { key: "state", level: "critical", detail: "reserve is inactive" };
    if (frozen === true) return { key: "state", level: "critical", detail: "reserve is frozen" };
    if (paused === true) return { key: "state", level: "critical", detail: "reserve is paused" };
    if (active == null && frozen == null && paused == null) {
        return { key: "state", level: "unknown", detail: "reserve state could not be read" };
    }
    return { key: "state", level: "ok", detail: "active, not frozen or paused" };
}

function gradeOracle(d: MarketRiskData): Signal {
    const price = n(d.oracle_price);
    const src = d.oracle_source?.value ?? null;
    if (price == null) return { key: "oracle", level: "unknown", detail: "collateral oracle price could not be read" };
    if (price <= 0) return { key: "oracle", level: "critical", detail: "collateral oracle returns a zero price" };
    const named = src ? `priced by oracle ${src}` : "oracle present";
    return { key: "oracle", level: "ok", detail: named };
}

// ── Aggregation ──────────────────────────────────────────────────────────────

function overallFlag(signals: Signal[]): Flag {
    const has = (l: RiskSignalLevel) => signals.some((s) => s.level === l);
    if (has("critical")) return "red";
    if (has("caution")) return "amber";
    // No critical/caution. An unreadable material signal blocks a clean green.
    if (has("unknown")) return has("ok") ? "amber" : "unknown";
    return "green";
}

function unknownDim(reason: string): DimensionAssessment {
    return { flag: "unknown", reason, inputs: [], confidence: "unverifiable", sources: [] };
}

export function assessMarketRisk(record: NormalizedAssetRecord): DimensionAssessment {
    const data: MarketRiskData | undefined = record.market_risk_data;
    if (!data) {
        return unknownDim("No on-chain market-risk data for this asset; market risk is not assessed.");
    }

    const signals: Signal[] = [
        gradeReserveState(data),
        gradeDeficit(data),
        gradeUtilization(data),
        gradeOracle(data),
        gradeBuffer(data),
        gradeCaps(data),
    ];

    const flag = overallFlag(signals);

    // Reason: lead with the driving signals (whatever set the flag), then the
    // healthy context, then the scope caveat for off-chain risk.
    const drivers = signals.filter((s) => s.level === "critical" || s.level === "caution");
    const unknowns = signals.filter((s) => s.level === "unknown");
    const parts: string[] = [];
    if (drivers.length) parts.push(drivers.map((s) => s.detail).join("; "));
    if (unknowns.length) parts.push(`unread: ${unknowns.map((s) => s.detail).join("; ")}`);
    if (!drivers.length && !unknowns.length) {
        const oracle = signals.find((s) => s.key === "oracle")!;
        parts.push(`on-chain risk signals healthy - ${oracle.detail}`);
    }
    let reason = parts.join(". ");
    reason = reason.charAt(0).toUpperCase() + reason.slice(1) + ".";
    if (flag === "green") {
        reason += " Low on-chain risk - this reads the reserve's state, not a per-borrower solvency proof or a safety guarantee.";
    }
    reason += OFFCHAIN_CAVEAT;

    // Confidence caps at the min of the reads used (all on-chain -> verified).
    const usedReads: DimensionRead[] = [data.utilization, data.total_supplied, data.oracle_price, data.deficit];
    const confidence: Confidence = minConfidence(...usedReads.map((r) => r.confidence));
    const sources = [...new Set(usedReads.map((r) => r.source))];

    // Anti-laundering ceiling, then freshness (both demote-only).
    const capped = data.underlying_ceiling ? capFlag(flag, data.underlying_ceiling) : flag;
    const cappedReason =
        capped !== flag
            ? `${reason} Capped at the underlying's own verification ceiling (${data.underlying_ceiling}); you cannot be safer than the asset you lent.`
            : reason;
    const fr = applyFreshnessAt(capped, cappedReason, data.utilization.as_of, DAY_MS, "On-chain read");

    return { flag: fr.flag, reason: fr.reason, inputs: INPUTS, confidence, sources, freshness: fr.freshness };
}
