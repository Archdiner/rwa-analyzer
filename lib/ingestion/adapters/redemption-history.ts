// ---------------------------------------------------------------------------
// Redemption-history adapter (live on-chain read + incident registry)
// ---------------------------------------------------------------------------
// Contributes the `verified` current-state signal (a single cheap `paused()`
// read — one call, not a log scan) and the curated incident signal. The N-MFP
// liquidity-fee signal is contributed separately by the EDGAR adapter and merged
// at the orchestrator. Emits data only when there is a basis to assess (a pause
// mechanism exists, or a curated incident is on record); otherwise EMPTY so the
// dimension stays honestly `unknown` for the long tail rather than greening
// every un-paused token blindly.
// ---------------------------------------------------------------------------

import { parseAbi, type Address } from "viem";
import { getClient } from "@/lib/chains";
import { formatAssetId as buildAssetId } from "@/lib/chains";
import type { ParsedAssetId } from "@/lib/chains";
import { type AdapterResult, EMPTY } from "@/lib/ingestion/adapters/base";
import { lookupRedemptionIncidents } from "@/lib/ingestion/adapters/redemption-registry";
import { buildRedemptionHistoryData, hasAssessmentBasis } from "@/lib/ingestion/redemption-history";

const PAUSABLE_ABI = parseAbi(["function paused() view returns (bool)"]);

export async function redemptionHistoryAdapter(asset: ParsedAssetId): Promise<AdapterResult> {
    const client = getClient(asset.chainId);
    const assetId = buildAssetId(asset.chainId, asset.address);
    const incidents = lookupRedemptionIncidents(assetId);
    const nowIso = new Date().toISOString();

    // Live current-state read (best-effort). A revert means no global pause
    // mechanism → null (unknown), never assumed false.
    let currentPaused: boolean | null = null;
    if (client) {
        currentPaused = await client
            .readContract({ address: asset.address as Address, abi: PAUSABLE_ABI, functionName: "paused" })
            .then((v) => v as boolean)
            .catch(() => null);
    }

    const data = buildRedemptionHistoryData({
        currentPaused,
        currentFrozen: null, // global freeze is rare; per-account freeze is not a redemption gate
        incidents,
        asOf: nowIso,
    });

    // Only contribute when there is something to assess; else let the dimension
    // read `unknown` (unless the EDGAR adapter adds fee events downstream).
    if (!hasAssessmentBasis(data)) return EMPTY;
    return { fields: {}, redemption_history_data: data };
}
