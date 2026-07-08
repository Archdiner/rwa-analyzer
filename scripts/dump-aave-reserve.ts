// One-off: dump raw Aave v3 USDC reserve reads to build a test fixture and
// validate the ray->APY math against DeFiLlama. Run:
//   npx tsx scripts/dump-aave-reserve.ts
import { createPublicClient, http, parseAbi, getAddress } from "viem";
import { mainnet } from "viem/chains";

const RPC = process.env.ETHEREUM_RPC_URL;
if (!RPC) throw new Error("ETHEREUM_RPC_URL not set");
const client = createPublicClient({ chain: mainnet, transport: http(RPC) });

const PROVIDER = getAddress("0x2f39d218133AFaB8F2B819B1066c7E434Ad94E9e");
const USDC = getAddress("0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48");

const PROVIDER_ABI = parseAbi([
  "function getPool() view returns (address)",
  "function getPoolDataProvider() view returns (address)",
  "function getPriceOracle() view returns (address)",
]);
const DP_ABI = parseAbi([
  "function getReserveData(address asset) view returns (uint256 unbacked, uint256 accruedToTreasuryScaled, uint256 totalAToken, uint256 totalStableDebt, uint256 totalVariableDebt, uint256 liquidityRate, uint256 variableBorrowRate, uint256 stableBorrowRate, uint256 averageStableBorrowRate, uint256 liquidityIndex, uint256 variableBorrowIndex, uint40 lastUpdateTimestamp)",
  "function getReserveConfigurationData(address asset) view returns (uint256 decimals, uint256 ltv, uint256 liquidationThreshold, uint256 liquidationBonus, uint256 reserveFactor, bool usageAsCollateralEnabled, bool borrowingEnabled, bool stableBorrowRateEnabled, bool isActive, bool isFrozen)",
  "function getReserveCaps(address asset) view returns (uint256 borrowCap, uint256 supplyCap)",
  "function getPaused(address asset) view returns (bool isPaused)",
]);
const ORACLE_ABI = parseAbi(["function getAssetPrice(address asset) view returns (uint256)"]);
const POOL_DEFICIT_ABI = parseAbi(["function getReserveDeficit(address asset) view returns (uint256)"]);

function j(o: unknown) {
  return JSON.stringify(o, (_k, v) => (typeof v === "bigint" ? v.toString() : v), 2);
}

async function main() {
  const [pool, dp, oracle] = await Promise.all([
    client.readContract({ address: PROVIDER, abi: PROVIDER_ABI, functionName: "getPool" }),
    client.readContract({ address: PROVIDER, abi: PROVIDER_ABI, functionName: "getPoolDataProvider" }),
    client.readContract({ address: PROVIDER, abi: PROVIDER_ABI, functionName: "getPriceOracle" }),
  ]);

  const reserveData = await client.readContract({ address: dp, abi: DP_ABI, functionName: "getReserveData", args: [USDC] });
  const config = await client.readContract({ address: dp, abi: DP_ABI, functionName: "getReserveConfigurationData", args: [USDC] });
  const caps = await client.readContract({ address: dp, abi: DP_ABI, functionName: "getReserveCaps", args: [USDC] });
  const paused = await client.readContract({ address: dp, abi: DP_ABI, functionName: "getPaused", args: [USDC] });
  const price = await client.readContract({ address: getAddress(oracle), abi: ORACLE_ABI, functionName: "getAssetPrice", args: [USDC] });

  let deficit: string | null = null;
  try {
    const d = await client.readContract({ address: pool, abi: POOL_DEFICIT_ABI, functionName: "getReserveDeficit", args: [USDC] });
    deficit = d.toString();
  } catch (e) {
    deficit = null;
    console.log("getReserveDeficit: NOT AVAILABLE on running version:", (e as Error).message.slice(0, 80));
  }

  console.log("pool:", pool, "dp:", dp, "oracle:", oracle);
  console.log("reserveData:", j(reserveData));
  console.log("config:", j(config));
  console.log("caps:", j(caps));
  console.log("paused:", paused);
  console.log("oraclePrice(USDC):", price.toString());
  console.log("deficit:", deficit);

  // Validate ray->APY: liquidityRate is ray-scaled APR; compound per second.
  const RAY = 1e27;
  const SECONDS_PER_YEAR = 31536000;
  const apr = Number(reserveData[5]) / RAY;
  const apy = (Math.pow(1 + apr / SECONDS_PER_YEAR, SECONDS_PER_YEAR) - 1) * 100;
  console.log(`\nliquidityRate ray=${reserveData[5]} -> APR=${(apr * 100).toFixed(4)}% -> APY=${apy.toFixed(4)}%`);

  // DeFiLlama aave-v3 USDC (ethereum) pool for cross-check.
  try {
    const res = await fetch("https://yields.llama.fi/pools", { headers: { accept: "application/json" } });
    const json = (await res.json()) as { data: Array<{ chain: string; project: string; symbol: string; apyBase: number | null; apyReward: number | null; pool: string; underlyingTokens?: string[] }> };
    const match = json.data.find((p) => p.project === "aave-v3" && p.chain === "Ethereum" && (p.underlyingTokens ?? []).some((t) => t.toLowerCase() === USDC.toLowerCase()));
    console.log("\nDeFiLlama aave-v3 USDC:", match ? j({ pool: match.pool, symbol: match.symbol, apyBase: match.apyBase, apyReward: match.apyReward }) : "not found");
  } catch (e) {
    console.log("DeFiLlama fetch failed:", (e as Error).message);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
