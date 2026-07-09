// ---------------------------------------------------------------------------
// Ingestion orchestrator (two-phase)
// ---------------------------------------------------------------------------
// asset_id -> NormalizedAssetRecord (Contract A).
//
//   ingestQuant()       fast, synchronous: on-chain + Chainlink + DeFiLlama +
//                       (optional) rwa.xyz. Renders a card in ~1-2s.
//   ingestQualitative() slow, deferred: issuer-doc fetch + LLM extraction.
//   ingest()            both, for cron/seed.
//
// Splitting the phases keeps cold lookups fast and cheap (fix #4): the OpenAI
// call only happens on the deferred path, behind the API's rate limiter.
// ---------------------------------------------------------------------------

import type {
    AssetIdentifiers,
    FieldMap,
    FieldName,
    NormalizedAssetRecord,
    TokenizationMode,
} from "@/lib/contracts";
import { parseAssetId } from "@/lib/chains";
import { onchainAdapter } from "@/lib/ingestion/adapters/onchain";
import { onchainHoldingsAdapter } from "@/lib/ingestion/adapters/onchain-holdings";
import { chainlinkAdapter } from "@/lib/ingestion/adapters/chainlink";
import { defillamaAdapter } from "@/lib/ingestion/adapters/defillama";
import { edgarAdapter } from "@/lib/ingestion/adapters/edgar";
import { attestationAdapter } from "@/lib/ingestion/adapters/attestation";
import { aaveAdapter } from "@/lib/ingestion/adapters/aave";
import { governanceAdapter } from "@/lib/ingestion/adapters/governance";
import { redemptionHistoryAdapter } from "@/lib/ingestion/adapters/redemption-history";
import { mergeRedemptionHistory } from "@/lib/ingestion/redemption-history";
import { rwaxyzAdapter } from "@/lib/ingestion/adapters/rwaxyz";
import { resolveIssuerDoc } from "@/lib/ingestion/adapters/issuer-docs";
import { extractQualitative } from "@/lib/ingestion/extractor";
import { reconcile, reconcileFields, type Contribution } from "@/lib/ingestion/reconcile";

const QUALITATIVE_KEYS: FieldName[] = [
    "wrapper_type",
    "redemption_speed",
    "redemption_cap",
    "jurisdiction",
    "custodian",
];

export interface IngestOptions {
    /** Human-curated identifiers (seed). */
    identifiers?: Partial<AssetIdentifiers>;
    /** Human-verified fields (seed) - carried at their stated confidence. */
    seedFields?: FieldMap;
    /** Known disclosure URL (seed / reference), skips web-search discovery. */
    disclosureUrl?: string;
    /** Curated tokenization mode (seed) - decides how reserves reconcile. */
    tokenizationMode?: TokenizationMode;
    /** Curated DeFiLlama pool id for this asset's native live yield (DeFi assets). */
    defillamaPool?: string;
}

function qualitativePending(fields: FieldMap): boolean {
    return !QUALITATIVE_KEYS.every((k) => fields[k] != null);
}

/** Phase 1 - fast quantitative ingest. */
export async function ingestQuant(assetId: string, opts: IngestOptions = {}): Promise<NormalizedAssetRecord> {
    const parsed = parseAssetId(assetId);
    if (!parsed) throw new Error(`Malformed asset_id: ${assetId}`);

    const onchain = await onchainAdapter(parsed);
    const symbolHint = opts.identifiers?.symbol ?? onchain.identifiers?.symbol;

    const [chainlink, defillama, edgar, attestation, aave, governance, redemptionHistory, rwaxyz] = await Promise.all([
        chainlinkAdapter(parsed),
        defillamaAdapter(parsed, opts.defillamaPool),
        edgarAdapter(parsed),
        attestationAdapter(parsed), // registry-gated: instant EMPTY unless the asset has one
        aaveAdapter(parsed), // registry-gated: instant EMPTY unless the asset is an Aave v3 reserve
        governanceAdapter(parsed), // registry-optional: reads any contract's control on-chain
        redemptionHistoryAdapter(parsed), // live pause read + curated incident registry
        rwaxyzAdapter(parsed, symbolHint),
    ]);

    // Seed contribution first = highest identifier precedence.
    const contributions: Contribution[] = [
        { fields: opts.seedFields ?? {}, identifiers: opts.identifiers },
        onchain,
        chainlink,
        defillama,
        edgar,
        attestation,
        aave,
        governance,
        redemptionHistory,
        rwaxyz,
    ];

    const record = reconcile(assetId, parsed, contributions, opts.tokenizationMode ?? "unknown");

    // v1.2 on-chain dimensions: the Aave adapter emits at most one of each data
    // object (one reserve = one read), so they attach directly rather than
    // reconciling across sources. Absent -> the dimensions read `unknown`.
    if (aave.yield_source_data) record.yield_source_data = aave.yield_source_data;
    if (aave.market_risk_data) record.market_risk_data = aave.market_risk_data;

    // v1.3 dimensions. governance attaches directly (one contract read). The
    // redemption-restriction payload is assembled from TWO contributions — the
    // live-pause/incident read and the EDGAR N-MFP fee signal — merged here.
    if (governance.governance_data) record.governance_data = governance.governance_data;
    const mergedRedemption = mergeRedemptionHistory(redemptionHistory.redemption_history_data, edgar.redemption_history_data);
    if (mergedRedemption) record.redemption_history_data = mergedRedemption;

    // On-chain reconstruction runs AFTER supply/NAV are known, so coverage can
    // be measured against supply x NAV. Only assets with a verified reserve
    // wallet contribute (none of the flagships do - see reserves-registry.ts).
    const supplyVal = record.fields.supply?.value;
    const navVal = record.fields.nav?.value;
    const expectedUsd =
        typeof supplyVal === "number" && typeof navVal === "number" ? supplyVal * navVal : 0;
    const holdings = await onchainHoldingsAdapter(parsed, expectedUsd);
    if (holdings.backing_evidence?.length) {
        record.backing_evidence.push(...holdings.backing_evidence);
    }

    // A seeded asset is human-curated and authoritative - never run LLM
    // extraction over it (that could only conflict with or downgrade verified
    // facts). Long-tail assets go through the deferred qualitative phase.
    const seeded = Object.keys(opts.seedFields ?? {}).length > 0;
    record.qualitative_pending = seeded ? false : qualitativePending(record.fields);
    return record;
}

/** Phase 2 - deferred qualitative fill. Mutates and returns a new record. */
export async function ingestQualitative(
    record: NormalizedAssetRecord,
    opts: IngestOptions = {},
): Promise<NormalizedAssetRecord> {
    const doc = await resolveIssuerDoc({
        name: record.identifiers.name,
        symbol: record.identifiers.symbol,
        disclosureUrl: opts.disclosureUrl,
    });

    // No document found -> qualitative fields remain missing (computation reads
    // that as `unknown`, i.e. the Unverifiable coverage tier). Honest, not green.
    if (!doc) {
        return { ...record, qualitative_pending: false };
    }

    const extracted = await extractQualitative(doc);

    const merged = reconcileFields([{ fields: record.fields }, { fields: extracted }]);
    return {
        ...record,
        fields: merged.fields,
        conflicts: [...record.conflicts, ...merged.conflicts],
        qualitative_pending: false,
        ingested_at: new Date().toISOString(),
    };
}

/** Full ingest (both phases) - for cron and seeding. */
export async function ingest(assetId: string, opts: IngestOptions = {}): Promise<NormalizedAssetRecord> {
    const quant = await ingestQuant(assetId, opts);
    if (!quant.qualitative_pending) return quant;
    return ingestQualitative(quant, opts);
}
