// ---------------------------------------------------------------------------
// On-chain reader adapter
// ---------------------------------------------------------------------------
// The always-available foundation: reads ERC-20 metadata + total supply, and
// best-effort detects transfer restrictions (ERC-1404 / whitelist), which for
// an RWA implies KYC/eligibility gating. Everything here is `verified` because
// it is a direct chain read anyone can reproduce.
//
// Holder count is intentionally NOT read here - it requires an indexer, not an
// RPC. Reference adapters may supply it.
// ---------------------------------------------------------------------------

import { parseAbi, toFunctionSelector, type Address } from "viem";
import { getClient } from "@/lib/chains";
import { field, type AdapterResult, EMPTY } from "@/lib/ingestion/adapters/base";
import type { ParsedAssetId } from "@/lib/chains";

const ERC20_ABI = parseAbi([
    "function name() view returns (string)",
    "function symbol() view returns (string)",
    "function decimals() view returns (uint8)",
    "function totalSupply() view returns (uint256)",
]);

// ERC-1404 is the common "restricted token" standard used by tokenized RWAs.
const ERC1404_SELECTOR = toFunctionSelector(
    "function detectTransferRestriction(address from, address to, uint256 value) view returns (uint8)",
);

async function readErc20(
    client: NonNullable<ReturnType<typeof getClient>>,
    address: Address,
) {
    const [name, symbol, decimals, totalSupply] = await Promise.all([
        client.readContract({ address, abi: ERC20_ABI, functionName: "name" }).catch(() => null),
        client.readContract({ address, abi: ERC20_ABI, functionName: "symbol" }).catch(() => null),
        client.readContract({ address, abi: ERC20_ABI, functionName: "decimals" }).catch(() => null),
        client.readContract({ address, abi: ERC20_ABI, functionName: "totalSupply" }).catch(() => null),
    ]);
    return { name, symbol, decimals, totalSupply };
}

/** True if the contract bytecode advertises the ERC-1404 restriction selector. */
async function detectTransferRestriction(
    client: NonNullable<ReturnType<typeof getClient>>,
    address: Address,
): Promise<boolean> {
    try {
        const code = await client.getCode({ address });
        if (!code) return false;
        return code.includes(ERC1404_SELECTOR.slice(2));
    } catch {
        return false;
    }
}

export async function onchainAdapter(asset: ParsedAssetId): Promise<AdapterResult> {
    const client = getClient(asset.chainId);
    if (!client) return EMPTY;

    const address = asset.address as Address;
    const nowIso = new Date().toISOString();

    try {
        const { name, symbol, decimals, totalSupply } = await readErc20(client, address);

        // A contract with no readable supply is not a usable token - bail so the
        // caller can report "does not resolve" rather than a phantom record.
        if (totalSupply == null || decimals == null) return EMPTY;

        const supply = Number(totalSupply) / 10 ** Number(decimals);

        const result: AdapterResult = {
            fields: {
                supply: field(supply, {
                    source: "onchain",
                    method: "onchain_read",
                    confidence: "verified",
                    as_of: nowIso,
                }),
            },
            identifiers: {},
        };

        if (typeof name === "string" && name) result.identifiers!.name = name;
        if (typeof symbol === "string" && symbol) result.identifiers!.symbol = symbol;

        const restricted = await detectTransferRestriction(client, address);
        if (restricted) {
            result.fields.kyc_required = field(true, {
                source: "onchain_transfer_restriction",
                method: "onchain_read",
                confidence: "verified",
                as_of: nowIso,
            });
        }

        return result;
    } catch (err) {
        console.error(`[onchain] read failed for ${asset.chainId}:${asset.address}:`, err);
        return EMPTY;
    }
}
