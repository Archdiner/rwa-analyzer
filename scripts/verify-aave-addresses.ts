// One-off: verify Aave v3 Ethereum addresses ON-CHAIN so the registry ships
// only human-gated, provenance-backed entries (U2 / R7). Run:
//   npx tsx scripts/verify-aave-addresses.ts
import { createPublicClient, http, parseAbi, getAddress } from "viem";
import { mainnet } from "viem/chains";

const RPC = process.env.ETHEREUM_RPC_URL;
if (!RPC) throw new Error("ETHEREUM_RPC_URL not set");

const client = createPublicClient({ chain: mainnet, transport: http(RPC) });

// Canonical Aave v3 Ethereum PoolAddressesProvider (to be confirmed on-chain).
const PROVIDER = "0x2f39d218133AFaB8F2B819B1066c7E434Ad94E9e";
const USDC = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
const WETH = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";

const PROVIDER_ABI = parseAbi([
  "function getPool() view returns (address)",
  "function getPoolDataProvider() view returns (address)",
  "function getPriceOracle() view returns (address)",
]);
const DATA_PROVIDER_ABI = parseAbi([
  "function getReserveTokensAddresses(address asset) view returns (address aTokenAddress, address stableDebtTokenAddress, address variableDebtTokenAddress)",
]);
const ERC20_ABI = parseAbi(["function symbol() view returns (string)"]);

async function main() {
  const block = await client.getBlockNumber();
  const pool = await client.readContract({ address: getAddress(PROVIDER), abi: PROVIDER_ABI, functionName: "getPool" });
  const dataProvider = await client.readContract({ address: getAddress(PROVIDER), abi: PROVIDER_ABI, functionName: "getPoolDataProvider" });
  const oracle = await client.readContract({ address: getAddress(PROVIDER), abi: PROVIDER_ABI, functionName: "getPriceOracle" });

  console.log("block:", block.toString());
  console.log("PoolAddressesProvider:", getAddress(PROVIDER));
  console.log("  -> Pool:", pool);
  console.log("  -> PoolDataProvider:", dataProvider);
  console.log("  -> PriceOracle:", oracle);

  for (const [name, underlying] of [["USDC", USDC], ["WETH", WETH]] as const) {
    const symbol = await client.readContract({ address: getAddress(underlying), abi: ERC20_ABI, functionName: "symbol" });
    const [aToken] = await client.readContract({
      address: dataProvider,
      abi: DATA_PROVIDER_ABI,
      functionName: "getReserveTokensAddresses",
      args: [getAddress(underlying)],
    });
    const aSymbol = await client.readContract({ address: aToken, abi: ERC20_ABI, functionName: "symbol" });
    console.log(`\n${name} (${symbol}) underlying: ${getAddress(underlying)}`);
    console.log(`  -> aToken: ${aToken} (${aSymbol})`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
