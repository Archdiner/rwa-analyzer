// ---------------------------------------------------------------------------
// PoR feed verification harness (per the verification instruction block).
// Usage:
//   npx tsx scripts/verify-por.ts                 # G1: token supply reads
//   npx tsx scripts/verify-por.ts <feedAddr>      # G3/G4/G6: test-read a feed
// ---------------------------------------------------------------------------

import { config } from "dotenv";
config({ path: ".env.local" });
config();
import { parseAbi, type Address } from "viem";
import { getClient } from "../lib/chains";

const ERC20 = parseAbi([
    "function name() view returns (string)",
    "function symbol() view returns (string)",
    "function decimals() view returns (uint8)",
    "function totalSupply() view returns (uint256)",
]);

const AGG = parseAbi([
    "function description() view returns (string)",
    "function decimals() view returns (uint8)",
    "function latestRoundData() view returns (uint80,int256,uint256,uint256,uint80)",
]);

const TOKENS: { symbol: string; address: Address }[] = [
    { symbol: "OUSG", address: "0x1B19C19393e2d034D8Ff31ff34c81252FcBbee92" },
    { symbol: "USDY", address: "0x96F6eF951840721AdBF46Ac996b59E0235CB985C" },
];

async function readToken(client: NonNullable<ReturnType<typeof getClient>>, t: { symbol: string; address: Address }) {
    const [name, decimals, supply] = await Promise.all([
        client.readContract({ address: t.address, abi: ERC20, functionName: "name" }),
        client.readContract({ address: t.address, abi: ERC20, functionName: "decimals" }),
        client.readContract({ address: t.address, abi: ERC20, functionName: "totalSupply" }),
    ]);
    const scaled = Number(supply) / 10 ** Number(decimals);
    console.log(`  ${t.symbol}  name="${name}"  decimals=${decimals}  totalSupply=${scaled.toLocaleString()}`);
}

async function readFeed(client: NonNullable<ReturnType<typeof getClient>>, feed: Address) {
    const [desc, decimals, round] = await Promise.all([
        client.readContract({ address: feed, abi: AGG, functionName: "description" }),
        client.readContract({ address: feed, abi: AGG, functionName: "decimals" }),
        client.readContract({ address: feed, abi: AGG, functionName: "latestRoundData" }),
    ]);
    const answer = Number(round[1]) / 10 ** Number(decimals);
    const updatedAt = new Date(Number(round[3]) * 1000).toISOString();
    console.log(`  feed ${feed}`);
    console.log(`    description()=${JSON.stringify(desc)}  decimals=${decimals}`);
    console.log(`    answer(scaled)=${answer.toLocaleString()}  updatedAt=${updatedAt}`);
}

async function main() {
    const client = getClient(1);
    if (!client) {
        console.error("No Ethereum RPC configured (set ETHEREUM_RPC_URL). Aborting.");
        process.exit(1);
    }

    const feedArg = process.argv[2] as Address | undefined;
    if (feedArg) {
        console.log("== G3/G4/G6: feed test-read ==");
        await readFeed(client, feedArg);
    } else {
        console.log("== G1: on-chain token supply reads ==");
        for (const t of TOKENS) await readToken(client, t);
    }
}

main().then(() => process.exit(0));
