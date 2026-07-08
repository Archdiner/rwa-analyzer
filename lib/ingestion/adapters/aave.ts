// ---------------------------------------------------------------------------
// Aave v3 ingestion adapter (viem reads -> Contract A)
// ---------------------------------------------------------------------------
// The network shell around lib/ingestion/aave.ts (all shaping lives there,
// fixture-tested). Mirrors edgarAdapter: registry-gated so it is an instant
// EMPTY for any non-Aave asset, resolves the periphery from the registry's
// PoolAddressesProvider, reads the reserve defensively, and hands the raw reads
// to the pure `shapeAaveReserve`.
//
// Honesty: on-chain reads are `verified`; a `deficit` accessor absent on the
// running version leaves `deficit = null` -> `unknown`, never 0. Reward
// emissions are confirmed on-chain via the RewardsController (an empty reward
// set is a VERIFIED zero); DeFiLlama's `apyReward` is only a keyless fallback
// cross-ref, labeled `auto`, and can never lift a green.
// ---------------------------------------------------------------------------

import { parseAbi, getAddress, type Address } from "viem";
import { getClient } from "@/lib/chains";
import { formatAssetId as buildAssetId } from "@/lib/chains";
import { type AdapterResult, EMPTY } from "@/lib/ingestion/adapters/base";
import type { ParsedAssetId } from "@/lib/chains";
import type { Confidence } from "@/lib/contracts";
import { lookupAaveMarket } from "@/lib/ingestion/adapters/aave-registry";
import { shapeAaveReserve, type RawReserveReads } from "@/lib/ingestion/aave";

const PROVIDER_ABI = parseAbi([
    "function getPool() view returns (address)",
    "function getPoolDataProvider() view returns (address)",
    "function getPriceOracle() view returns (address)",
]);
const DATA_PROVIDER_ABI = parseAbi([
    "function getReserveData(address asset) view returns (uint256 unbacked, uint256 accruedToTreasuryScaled, uint256 totalAToken, uint256 totalStableDebt, uint256 totalVariableDebt, uint256 liquidityRate, uint256 variableBorrowRate, uint256 stableBorrowRate, uint256 averageStableBorrowRate, uint256 liquidityIndex, uint256 variableBorrowIndex, uint40 lastUpdateTimestamp)",
    "function getReserveConfigurationData(address asset) view returns (uint256 decimals, uint256 ltv, uint256 liquidationThreshold, uint256 liquidationBonus, uint256 reserveFactor, bool usageAsCollateralEnabled, bool borrowingEnabled, bool stableBorrowRateEnabled, bool isActive, bool isFrozen)",
    "function getReserveCaps(address asset) view returns (uint256 borrowCap, uint256 supplyCap)",
    "function getPaused(address asset) view returns (bool isPaused)",
]);
const ORACLE_ABI = parseAbi(["function getAssetPrice(address asset) view returns (uint256)"]);
const POOL_ABI = parseAbi(["function getReserveDeficit(address asset) view returns (uint256)"]);
const ATOKEN_ABI = parseAbi(["function getIncentivesController() view returns (address)"]);
const REWARDS_ABI = parseAbi([
    "function getRewardsByAsset(address asset) view returns (address[])",
    "function getRewardsData(address asset, address reward) view returns (uint256 index, uint256 emissionPerSecond, uint256 lastUpdateTimestamp, uint256 distributionEnd)",
]);

type Client = NonNullable<ReturnType<typeof getClient>>;

/** Reward emissions detection. An empty reward set is a VERIFIED zero. When the
 *  on-chain read fails, falls back to DeFiLlama `apyReward` (auto), else null. */
async function detectReward(
    client: Client,
    aToken: Address,
    underlying: Address,
    chainId: number,
): Promise<{ rewardApy: number | null; rewardConfidence: Confidence; rewardSource: string }> {
    try {
        const controller = await client.readContract({ address: aToken, abi: ATOKEN_ABI, functionName: "getIncentivesController" });
        const rewards = await client.readContract({ address: controller, abi: REWARDS_ABI, functionName: "getRewardsByAsset", args: [aToken] });

        if (rewards.length === 0) {
            return { rewardApy: 0, rewardConfidence: "verified", rewardSource: "aave:rewards" };
        }
        // Emissions exist. Check whether any are still active (distributionEnd in
        // the future). Quantifying reward APY needs reward-token pricing, so we
        // defer the magnitude to DeFiLlama rather than emit a half-derived number.
        const now = Math.floor(Date.now() / 1000);
        let active = false;
        for (const reward of rewards) {
            const data = await client.readContract({ address: controller, abi: REWARDS_ABI, functionName: "getRewardsData", args: [aToken, reward] });
            if (Number(data[3]) > now && Number(data[1]) > 0) active = true;
        }
        if (!active) {
            return { rewardApy: 0, rewardConfidence: "verified", rewardSource: "aave:rewards" };
        }
    } catch {
        // fall through to the DeFiLlama cross-ref
    }

    const llama = await defillamaRewardApy(underlying, chainId);
    if (llama != null) return { rewardApy: llama, rewardConfidence: "auto", rewardSource: "defillama:aave-v3" };
    return { rewardApy: null, rewardConfidence: "auto", rewardSource: "aave:rewards" };
}

interface LlamaPool {
    chain: string;
    project: string;
    apyReward: number | null;
    underlyingTokens?: string[] | null;
}

/** Keyless DeFiLlama cross-ref for Aave v3 reward APY. auto, never verified. */
async function defillamaRewardApy(underlying: Address, chainId: number): Promise<number | null> {
    try {
        const res = await fetch("https://yields.llama.fi/pools", { headers: { accept: "application/json" } });
        if (!res.ok) return null;
        const json = (await res.json()) as { data?: LlamaPool[] };
        const chain = chainId === 1 ? "Ethereum" : null;
        if (!chain) return null;
        const want = underlying.toLowerCase();
        const pool = (json.data ?? []).find(
            (p) => p.project === "aave-v3" && p.chain === chain && (p.underlyingTokens ?? []).some((t) => t?.toLowerCase() === want),
        );
        const r = pool?.apyReward;
        return typeof r === "number" && Number.isFinite(r) ? r : null;
    } catch {
        return null;
    }
}

export async function aaveAdapter(asset: ParsedAssetId): Promise<AdapterResult> {
    const assetId = buildAssetId(asset.chainId, asset.address);
    const entry = lookupAaveMarket(assetId);
    if (!entry) return EMPTY; // registry-gated: instant EMPTY for non-Aave assets

    const client = getClient(asset.chainId);
    if (!client) return EMPTY;

    try {
        const provider = getAddress(entry.poolAddressesProvider);
        const underlying = getAddress(entry.underlying);
        const aToken = getAddress(entry.aToken);

        const [pool, dataProvider, oracle] = await Promise.all([
            client.readContract({ address: provider, abi: PROVIDER_ABI, functionName: "getPool" }),
            client.readContract({ address: provider, abi: PROVIDER_ABI, functionName: "getPoolDataProvider" }),
            client.readContract({ address: provider, abi: PROVIDER_ABI, functionName: "getPriceOracle" }),
        ]);

        const [reserveData, config, caps, isPaused, oraclePrice] = await Promise.all([
            client.readContract({ address: dataProvider, abi: DATA_PROVIDER_ABI, functionName: "getReserveData", args: [underlying] }),
            client.readContract({ address: dataProvider, abi: DATA_PROVIDER_ABI, functionName: "getReserveConfigurationData", args: [underlying] }),
            client.readContract({ address: dataProvider, abi: DATA_PROVIDER_ABI, functionName: "getReserveCaps", args: [underlying] }),
            client.readContract({ address: dataProvider, abi: DATA_PROVIDER_ABI, functionName: "getPaused", args: [underlying] }),
            client.readContract({ address: getAddress(oracle), abi: ORACLE_ABI, functionName: "getAssetPrice", args: [underlying] }),
        ]);

        // Bad-debt/deficit accessor varies by running version: read defensively.
        // Absent -> null -> `unknown` downstream, never assumed 0.
        let deficit: string | null = null;
        try {
            const d = await client.readContract({ address: pool, abi: POOL_ABI, functionName: "getReserveDeficit", args: [underlying] });
            deficit = d.toString();
        } catch {
            deficit = null;
        }

        const reward = await detectReward(client, aToken, underlying, asset.chainId);

        const raw: RawReserveReads = {
            totalAToken: reserveData[2].toString(),
            totalStableDebt: reserveData[3].toString(),
            totalVariableDebt: reserveData[4].toString(),
            liquidityRate: reserveData[5].toString(),
            lastUpdateTimestamp: Number(reserveData[11]),
            config: {
                decimals: Number(config[0]),
                ltvBps: Number(config[1]),
                liquidationThresholdBps: Number(config[2]),
                reserveFactorBps: Number(config[4]),
                isActive: config[8],
                isFrozen: config[9],
            },
            isPaused,
            borrowCap: caps[0].toString(),
            supplyCap: caps[1].toString(),
            oraclePrice: oraclePrice.toString(),
            oracleSource: getAddress(oracle),
            deficit,
            rewardApy: reward.rewardApy,
            rewardConfidence: reward.rewardConfidence,
            rewardSource: reward.rewardSource,
            underlyingSymbol: entry.label.split(" ").pop() ?? entry.underlying,
        };

        const { yield_source_data, market_risk_data } = shapeAaveReserve(raw);
        return { fields: {}, yield_source_data, market_risk_data };
    } catch (err) {
        console.error(`[aave] read failed for ${assetId}:`, err);
        return EMPTY;
    }
}
