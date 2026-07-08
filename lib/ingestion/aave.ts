// ---------------------------------------------------------------------------
// Aave v3 reserve shaping (pure, network-free)
// ---------------------------------------------------------------------------
// The numeric core of the Aave adapter, split out from the network shell the
// way parseNmfp is split from edgarAdapter. Everything here is deterministic and
// fixture-tested, because this is where an arithmetic slip could flip a flag:
// the ray->APY conversion, utilization, the bps config decode, and the two data
// objects the new dimensions read.
//
// Honesty rules embedded here:
//   - A read whose value is null (e.g. a deficit accessor absent on the running
//     version) stays null -> `unknown` downstream, NEVER coerced to 0.
//   - On-chain reads are `verified`; a DeFiLlama reward cross-ref is `auto` and
//     can never lift a green (that gate lives in the scoring layer).
// ---------------------------------------------------------------------------

import type {
    Confidence,
    DimensionRead,
    Flag,
    Method,
    MarketRiskData,
    YieldSourceData,
    YieldSourceKind,
} from "@/lib/contracts";

const RAY = 1e27;
const SECONDS_PER_YEAR = 31_536_000;
// Aave's USD-base oracle quotes with 8 decimals. This is correct for the
// ETH-mainnet registry; a future non-USD-base or different-decimal deployment
// would need this read per-oracle (BASE_CURRENCY_UNIT) rather than hardcoded.
const ORACLE_PRICE_DECIMALS = 8;

/**
 * Converts an Aave reserve `liquidityRate` (ray-scaled annual rate) to a
 * compounded supply APY in percent, using Aave's own per-second compounding
 * convention: APY = (1 + apr/n)^n - 1, n = seconds/year. Deterministic.
 */
export function rayRateToApy(liquidityRateRay: bigint | string): number {
    const ray = typeof liquidityRateRay === "bigint" ? Number(liquidityRateRay) : Number(liquidityRateRay);
    if (!Number.isFinite(ray) || ray <= 0) return 0;
    const apr = ray / RAY;
    const apy = Math.pow(1 + apr / SECONDS_PER_YEAR, SECONDS_PER_YEAR) - 1;
    return apy * 100;
}

/** Borrow utilization = totalBorrowed / totalSupplied. 0 supplied -> 0 (no div0). */
export function utilizationOf(totalBorrowed: number, totalSupplied: number): number {
    if (!Number.isFinite(totalSupplied) || totalSupplied <= 0) return 0;
    return totalBorrowed / totalSupplied;
}

/** Basis points (e.g. 7500) -> fraction (0.75). */
export function bpsToFraction(bps: number): number {
    return bps / 10_000;
}

/** The raw reserve-configuration reads (from getReserveConfigurationData). */
export interface RawReserveConfig {
    decimals: number;
    ltvBps: number;
    liquidationThresholdBps: number;
    reserveFactorBps: number;
    isActive: boolean;
    isFrozen: boolean;
}

export interface DecodedReserveConfig {
    decimals: number;
    ltv: number; // 0-1
    liquidationThreshold: number; // 0-1
    reserveFactor: number; // 0-1
    isActive: boolean;
    isFrozen: boolean;
}

/** Normalizes the bps config fields into 0-1 fractions. */
export function decodeReserveConfig(c: RawReserveConfig): DecodedReserveConfig {
    return {
        decimals: c.decimals,
        ltv: bpsToFraction(c.ltvBps),
        liquidationThreshold: bpsToFraction(c.liquidationThresholdBps),
        reserveFactor: bpsToFraction(c.reserveFactorBps),
        isActive: c.isActive,
        isFrozen: c.isFrozen,
    };
}

/**
 * Classifies the dominant yield kind from the organic/reward split. When reward
 * is unknown (null), the kind reflects the verified organic activity
 * (`lending_interest`); the scoring layer carries the "emissions unknown"
 * caveat. When neither is known, `unknown`.
 */
export function classifyYieldKind(organicApy: number | null, rewardApy: number | null): YieldSourceKind {
    if (organicApy == null && rewardApy == null) return "unknown";
    if (rewardApy == null) return organicApy != null ? "lending_interest" : "unknown";
    if (organicApy == null) return rewardApy > 0 ? "emissions" : "unknown";
    const total = organicApy + rewardApy;
    if (total <= 0) return "lending_interest";
    const organicShare = organicApy / total;
    if (organicShare >= 0.9) return "lending_interest";
    if (organicShare <= 0.1) return "emissions";
    return "mixed";
}

// ── DimensionRead builders ───────────────────────────────────────────────────

/** Builds a verified on-chain read. */
export function onchainRead<T extends number | boolean | string>(
    value: T | null,
    source: string,
    as_of: string,
): DimensionRead<T> {
    return { value, source, method: "onchain_read" as Method, confidence: "verified" as Confidence, as_of };
}

// ── Raw reads -> Contract A payloads ─────────────────────────────────────────

/** Everything the adapter gathered for one reserve (JSON-serializable: bigints
 *  are strings, so this doubles as the test-fixture shape). */
export interface RawReserveReads {
    // getReserveData
    totalAToken: string; // raw, scaled by `decimals`
    totalStableDebt: string;
    totalVariableDebt: string;
    liquidityRate: string; // ray
    lastUpdateTimestamp: number; // unix seconds
    // getReserveConfigurationData
    config: RawReserveConfig;
    // getPaused
    isPaused: boolean;
    // getReserveCaps (whole-token counts; 0 = disabled)
    supplyCap: string;
    borrowCap: string;
    // AaveOracle.getAssetPrice (8-decimal USD) + the oracle address
    oraclePrice: string;
    oracleSource: string;
    // Pool.getReserveDeficit (underlying units) or null when unavailable
    deficit: string | null;
    // Reward emissions: value null = unresolved (unknown). confidence "verified"
    // when the RewardsController confirmed it on-chain (including a real zero),
    // "auto" when cross-referenced from DeFiLlama.
    rewardApy: number | null;
    rewardConfidence: Confidence;
    rewardSource: string;
    underlyingSymbol: string;
    /** Anti-laundering ceiling from the underlying's own verification status. */
    underlyingCeiling?: Flag;
}

function scaled(raw: string, decimals: number): number {
    return Number(raw) / 10 ** decimals;
}

/** Builds the yield_source Contract-A payload from raw reads. */
export function buildYieldSourceData(raw: RawReserveReads): YieldSourceData {
    const asOf = new Date(raw.lastUpdateTimestamp * 1000).toISOString();
    const organicApy = rayRateToApy(raw.liquidityRate);
    const organic_apy = onchainRead<number>(organicApy, "aave:v3:pool", asOf);
    const reward_apy: DimensionRead<number> = {
        value: raw.rewardApy,
        source: raw.rewardSource,
        method: raw.rewardConfidence === "auto" ? "aggregator" : "onchain_read",
        confidence: raw.rewardConfidence,
        // A DeFiLlama cross-ref is "now"; an on-chain confirmation shares the block.
        as_of: raw.rewardConfidence === "auto" ? new Date().toISOString() : asOf,
    };
    return {
        organic_apy,
        reward_apy,
        kind: classifyYieldKind(organicApy, raw.rewardApy),
        underlying_symbol: raw.underlyingSymbol,
        ...(raw.underlyingCeiling ? { underlying_ceiling: raw.underlyingCeiling } : {}),
    };
}

/** Builds the market_risk Contract-A payload from raw reads. */
export function buildMarketRiskData(raw: RawReserveReads): MarketRiskData {
    const cfg = decodeReserveConfig(raw.config);
    const asOf = new Date(raw.lastUpdateTimestamp * 1000).toISOString();
    const src = "aave:v3:pool";

    const totalSupplied = scaled(raw.totalAToken, cfg.decimals);
    const totalBorrowed = scaled(raw.totalStableDebt, cfg.decimals) + scaled(raw.totalVariableDebt, cfg.decimals);
    const available = Math.max(0, totalSupplied - totalBorrowed);
    const utilization = utilizationOf(totalBorrowed, totalSupplied);
    const deficit = raw.deficit == null ? null : scaled(raw.deficit, cfg.decimals);
    const oraclePrice = Number(raw.oraclePrice) / 10 ** ORACLE_PRICE_DECIMALS;

    return {
        utilization: onchainRead<number>(utilization, src, asOf),
        available_liquidity: onchainRead<number>(available, src, asOf),
        total_supplied: onchainRead<number>(totalSupplied, src, asOf),
        total_borrowed: onchainRead<number>(totalBorrowed, src, asOf),
        supply_cap: onchainRead<number>(Number(raw.supplyCap), src, asOf),
        borrow_cap: onchainRead<number>(Number(raw.borrowCap), src, asOf),
        ltv: onchainRead<number>(cfg.ltv, src, asOf),
        liquidation_threshold: onchainRead<number>(cfg.liquidationThreshold, src, asOf),
        reserve_factor: onchainRead<number>(cfg.reserveFactor, src, asOf),
        is_active: onchainRead<boolean>(cfg.isActive, src, asOf),
        is_frozen: onchainRead<boolean>(cfg.isFrozen, src, asOf),
        is_paused: onchainRead<boolean>(raw.isPaused, src, asOf),
        oracle_price: onchainRead<number>(oraclePrice, "aave:oracle", asOf),
        oracle_source: onchainRead<string>(raw.oracleSource, "aave:oracle", asOf),
        deficit: onchainRead<number>(deficit, "aave:v3:pool", asOf),
        underlying_symbol: raw.underlyingSymbol,
        ...(raw.underlyingCeiling ? { underlying_ceiling: raw.underlyingCeiling } : {}),
    };
}

/** One pure entry point: raw reserve reads -> both Contract-A payloads. */
export function shapeAaveReserve(raw: RawReserveReads): {
    yield_source_data: YieldSourceData;
    market_risk_data: MarketRiskData;
} {
    return {
        yield_source_data: buildYieldSourceData(raw),
        market_risk_data: buildMarketRiskData(raw),
    };
}
