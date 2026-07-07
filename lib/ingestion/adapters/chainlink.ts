// ---------------------------------------------------------------------------
// Chainlink PoR / SmartData adapter
// ---------------------------------------------------------------------------
// Reads a verified reserve/NAV feed (AggregatorV3Interface) for assets present
// in the registry, and attaches the reserves_method classification. The number
// is `verified` (a reproducible on-chain read); the METHOD is what gives the
// number meaning. Assets not in the registry contribute nothing.
// ---------------------------------------------------------------------------

import { parseAbi, type Address } from "viem";
import { getClient, formatAssetId as buildAssetId } from "@/lib/chains";
import { field, type AdapterResult, EMPTY } from "@/lib/ingestion/adapters/base";
import { lookupPorFeed } from "@/lib/ingestion/adapters/chainlink-registry";
import type { ParsedAssetId } from "@/lib/chains";

const AGGREGATOR_V3_ABI = parseAbi([
    "function decimals() view returns (uint8)",
    "function latestRoundData() view returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)",
]);

export async function chainlinkAdapter(asset: ParsedAssetId): Promise<AdapterResult> {
    const assetId = buildAssetId(asset.chainId, asset.address);
    const entry = lookupPorFeed(assetId);
    if (!entry) return EMPTY;

    const client = getClient(entry.feedChainId);
    if (!client) return EMPTY;

    try {
        const feedAddress = entry.feedAddress as Address;
        const [decimals, round] = await Promise.all([
            client.readContract({ address: feedAddress, abi: AGGREGATOR_V3_ABI, functionName: "decimals" }),
            client.readContract({ address: feedAddress, abi: AGGREGATOR_V3_ABI, functionName: "latestRoundData" }),
        ]);

        const answer = round[1]; // int256
        const updatedAt = Number(round[3]); // unix seconds
        if (answer <= BigInt(0) || updatedAt === 0) return EMPTY;

        const value = Number(answer) / 10 ** Number(decimals);
        const asOf = new Date(updatedAt * 1000).toISOString();

        const result: AdapterResult = { fields: {} };

        if (entry.kind === "reserves") {
            result.fields.reserves_value = field(value, {
                source: "chainlink_por",
                method: "onchain_read",
                confidence: "verified",
                as_of: asOf,
            });
            result.fields.reserves_method = field(entry.reservesMethod, {
                source: "chainlink_registry",
                method: "reference_api",
                confidence: "verified",
                as_of: asOf,
            });
        } else {
            result.fields.nav = field(value, {
                source: "chainlink_por",
                method: "onchain_read",
                confidence: "verified",
                as_of: asOf,
            });
        }

        return result;
    } catch (err) {
        console.error(`[chainlink] feed read failed for ${assetId}:`, err);
        return EMPTY;
    }
}
