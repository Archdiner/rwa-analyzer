// ---------------------------------------------------------------------------
// On-chain holdings reconstruction adapter
// ---------------------------------------------------------------------------
// Reads an asset's verified reserve wallet(s), values each held instrument, and
// emits ONE onchain_holdings evidence item. Independence is ceilinged by what is
// held (anti-laundering) via leafBackingIndependence. Assets with no registry
// entry contribute nothing — which today is every flagship (see the OUSG finding
// in reserves-registry.ts).
// ---------------------------------------------------------------------------

import { erc20Abi, type Address } from "viem";
import { getClient, formatAssetId as buildAssetId } from "@/lib/chains";
import type { ParsedAssetId } from "@/lib/chains";
import { type AdapterResult, EMPTY } from "@/lib/ingestion/adapters/base";
import {
    lookupReserveWallet,
    PROVEN_LEAVES,
    RESERVE_WALLETS,
} from "@/lib/ingestion/adapters/reserves-registry";
import {
    buildHoldingsEvidence,
    leafBackingIndependence,
    type ValuedHolding,
} from "@/lib/ingestion/holdings";

/**
 * @param expectedUsd supply × NAV — the AUM the reserve must cover. Coverage is
 *        measured against it; pass 0 if unknown (coverage then reads as 0%).
 */
export async function onchainHoldingsAdapter(
    asset: ParsedAssetId,
    expectedUsd: number,
): Promise<AdapterResult> {
    const assetId = buildAssetId(asset.chainId, asset.address);
    const entry = lookupReserveWallet(assetId);
    if (!entry) return EMPTY;

    const client = getClient(entry.walletChainId);
    if (!client) return EMPTY;

    try {
        const holdings: ValuedHolding[] = [];

        for (const inst of entry.instruments) {
            const decimals = await client.readContract({
                address: inst.token,
                abi: erc20Abi,
                functionName: "decimals",
            });

            let raw = BigInt(0);
            for (const wallet of entry.wallets) {
                const bal = await client.readContract({
                    address: inst.token,
                    abi: erc20Abi,
                    functionName: "balanceOf",
                    args: [wallet as Address],
                });
                raw += bal;
            }

            const tokens = Number(raw) / 10 ** Number(decimals);
            const balanceUsd = tokens * (inst.usdPerToken ?? 1);
            const independence = inst.assetId
                ? leafBackingIndependence(inst.assetId, PROVEN_LEAVES, RESERVE_WALLETS)
                : inst.kind === "cash_treasury_proven"
                  ? 5
                  : inst.kind === "stablecoin"
                    ? 2
                    : 1;

            holdings.push({ label: inst.label, balanceUsd, independence });
        }

        const evidence = buildHoldingsEvidence(holdings, expectedUsd, new Date().toISOString());
        return evidence ? { fields: {}, backing_evidence: [evidence] } : EMPTY;
    } catch (err) {
        console.error(`[onchain-holdings] read failed for ${assetId}:`, err);
        return EMPTY;
    }
}
