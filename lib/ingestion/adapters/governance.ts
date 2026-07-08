// ---------------------------------------------------------------------------
// Governance / admin-key adapter (viem reads -> Contract A)
// ---------------------------------------------------------------------------
// The network shell around lib/ingestion/governance.ts (all classification lives
// there, fixture-tested). Unlike the other v1.x adapters this is REGISTRY-
// OPTIONAL: it reads the asset's own contract, so it works on any proxy and
// reaches the long tail. An optional label registry only enriches admin_label.
//
// Reads: EIP-1967 slots (getStorageAt), proxy/upgrade selectors (getCode), the
// upgrade authority (transparent admin slot or owner()), and that authority's
// type (EOA vs Safe vs TimelockController). All verified on-chain; anything
// unreadable stays null -> unknown. Degrades to EMPTY on RPC failure.
// ---------------------------------------------------------------------------

import { parseAbi, toFunctionSelector, getAddress, type Address } from "viem";
import { getClient } from "@/lib/chains";
import type { ParsedAssetId } from "@/lib/chains";
import { type AdapterResult, EMPTY } from "@/lib/ingestion/adapters/base";
import {
    EIP1967_IMPL_SLOT,
    EIP1967_ADMIN_SLOT,
    EIP1967_BEACON_SLOT,
    slotToAddress,
    buildGovernanceData,
    type RawGovernanceReads,
} from "@/lib/ingestion/governance";
import { lookupAdminLabel } from "@/lib/ingestion/adapters/governance-registry";

type Client = NonNullable<ReturnType<typeof getClient>>;

const PROXY_SELECTORS = [
    toFunctionSelector("function upgradeTo(address)"),
    toFunctionSelector("function upgradeToAndCall(address,bytes)"),
    toFunctionSelector("function implementation() view returns (address)"),
    toFunctionSelector("function admin() view returns (address)"),
];
const OWNABLE_ABI = parseAbi(["function owner() view returns (address)"]);
const SAFE_ABI = parseAbi([
    "function getThreshold() view returns (uint256)",
    "function getOwners() view returns (address[])",
]);
const TIMELOCK_ABI = parseAbi(["function getMinDelay() view returns (uint256)"]);
const PAUSABLE_ABI = parseAbi(["function paused() view returns (bool)"]);

async function readSlotAddress(client: Client, address: Address, slot: string): Promise<string | null> {
    const word = await client.getStorageAt({ address, slot: slot as `0x${string}` }).catch(() => null);
    return slotToAddress(word ?? null);
}

/** Classifies the admin controller: contract? Safe? Timelock? */
async function probeAdmin(client: Client, admin: Address) {
    const code = await client.getCode({ address: admin }).catch(() => null);
    const isContract = code != null ? code !== "0x" : null;
    let safeThreshold: number | null = null;
    let safeOwnerCount: number | null = null;
    let timelockDelaySeconds: number | null = null;
    if (isContract) {
        const [t, owners] = await Promise.all([
            client.readContract({ address: admin, abi: SAFE_ABI, functionName: "getThreshold" }).catch(() => null),
            client.readContract({ address: admin, abi: SAFE_ABI, functionName: "getOwners" }).catch(() => null),
        ]);
        if (t != null && owners != null) {
            safeThreshold = Number(t);
            safeOwnerCount = owners.length;
        }
        const delay = await client.readContract({ address: admin, abi: TIMELOCK_ABI, functionName: "getMinDelay" }).catch(() => null);
        if (delay != null) timelockDelaySeconds = Number(delay);
    }
    return { isContract, safeThreshold, safeOwnerCount, timelockDelaySeconds };
}

export async function governanceAdapter(asset: ParsedAssetId): Promise<AdapterResult> {
    const client = getClient(asset.chainId);
    if (!client) return EMPTY;

    const address = asset.address as Address;
    const nowIso = new Date().toISOString();

    try {
        const code = await client.getCode({ address }).catch(() => null);
        if (!code || code === "0x") return EMPTY; // not a contract → nothing to grade

        const [impl, adminSlot, beacon] = await Promise.all([
            readSlotAddress(client, address, EIP1967_IMPL_SLOT),
            readSlotAddress(client, address, EIP1967_ADMIN_SLOT),
            readSlotAddress(client, address, EIP1967_BEACON_SLOT),
        ]);
        const hasProxySelectors = PROXY_SELECTORS.some((sel) => code.includes(sel.slice(2)));

        // Upgrade authority: transparent admin slot, else owner() (UUPS/Ownable).
        const owner = adminSlot
            ? null
            : await client.readContract({ address, abi: OWNABLE_ABI, functionName: "owner" }).catch(() => null);
        const adminAddr = adminSlot ?? (owner ? getAddress(owner) : null);

        let adminProbe = { isContract: null as boolean | null, safeThreshold: null as number | null, safeOwnerCount: null as number | null, timelockDelaySeconds: null as number | null };
        if (adminAddr) adminProbe = await probeAdmin(client, getAddress(adminAddr));

        const paused = await client.readContract({ address, abi: PAUSABLE_ABI, functionName: "paused" }).catch(() => null);

        const raw: RawGovernanceReads = {
            impl,
            adminSlot,
            beacon,
            hasProxySelectors,
            owner: owner ? getAddress(owner) : null,
            adminIsContract: adminProbe.isContract,
            safeThreshold: adminProbe.safeThreshold,
            safeOwnerCount: adminProbe.safeOwnerCount,
            timelockDelaySeconds: adminProbe.timelockDelaySeconds,
            pausePower: paused != null ? true : null, // paused() present → a pause power exists
            asOf: nowIso,
        };

        const adminLabel = adminAddr ? lookupAdminLabel(asset.chainId, adminAddr) : undefined;
        return { fields: {}, governance_data: buildGovernanceData(raw, { adminLabel }) };
    } catch (err) {
        console.error(`[governance] read failed for ${asset.chainId}:${asset.address}:`, err);
        return EMPTY;
    }
}
