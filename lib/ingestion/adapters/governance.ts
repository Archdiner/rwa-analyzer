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

import { parseAbi, getAddress, type Address } from "viem";
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

const PROXY_VIEW_ABI = parseAbi([
    "function implementation() view returns (address)",
    "function admin() view returns (address)",
]);
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
    // Run the interface probes unless we KNOW it's an EOA. A transient getCode
    // failure (isContract === null) must not skip them — the readContract calls
    // themselves reveal contract-ness (a successful getThreshold IS the proof),
    // so a failed getCode no longer flips a real timelock/Safe to unclassifiable.
    if (isContract !== false) {
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

/** A non-zero address from a proxy view call, else null. */
function nonZero(addr: string | null): string | null {
    if (!addr) return null;
    return /^0x0{40}$/i.test(addr) ? null : getAddress(addr);
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
        // Reliable proxy detection: actually CALL implementation()/admin(). A
        // coincidental bytecode match can't make a non-proxy return an address.
        const [implCallRaw, adminCallRaw] = await Promise.all([
            client.readContract({ address, abi: PROXY_VIEW_ABI, functionName: "implementation" }).catch(() => null),
            client.readContract({ address, abi: PROXY_VIEW_ABI, functionName: "admin" }).catch(() => null),
        ]);
        const implCall = nonZero(implCallRaw ?? null);
        const adminCall = nonZero(adminCallRaw ?? null);

        // Upgrade authority: transparent admin slot, then admin() call, else owner().
        const owner =
            adminSlot || adminCall
                ? null
                : await client.readContract({ address, abi: OWNABLE_ABI, functionName: "owner" }).catch(() => null);
        const adminAddr = adminSlot ?? adminCall ?? (owner ? getAddress(owner) : null);

        let adminProbe = { isContract: null as boolean | null, safeThreshold: null as number | null, safeOwnerCount: null as number | null, timelockDelaySeconds: null as number | null };
        if (adminAddr) adminProbe = await probeAdmin(client, getAddress(adminAddr));

        const paused = await client.readContract({ address, abi: PAUSABLE_ABI, functionName: "paused" }).catch(() => null);

        const raw: RawGovernanceReads = {
            impl,
            adminSlot,
            beacon,
            implCall,
            adminCall,
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
