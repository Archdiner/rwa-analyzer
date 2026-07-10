// ---------------------------------------------------------------------------
// Asset service - get-or-ingest orchestration
// ---------------------------------------------------------------------------
// Shared by the API route and the risk-card page. Implements the two-phase
// cold-lookup: a cache miss runs the fast quant ingest and returns immediately
// with `needsFill: true`; the caller defers the slow qualitative fill (OpenAI)
// via next/server `after`, so the first render is fast and the LLM call happens
// off the response path.
// ---------------------------------------------------------------------------

import type { EvidenceItem, Jurisdiction, RedemptionSpeed } from "@/lib/contracts";
import type { IngestOptions } from "@/lib/ingestion";
import { ingestQuant, ingestQualitative } from "@/lib/ingestion";
import { getStoredAsset, saveAsset, type StoredAsset } from "@/lib/store";
import { getSeed, allSeeds } from "@/lib/seed/assets";
import { EVIDENCE_TRUST_BOUNDARY } from "@/lib/display";
import type { AssetSummary } from "@/lib/decision";

function seedOptions(assetId: string): IngestOptions {
    const seed = getSeed(assetId);
    if (!seed) return {};
    return {
        identifiers: seed.identifiers,
        seedFields: seed.seedFields,
        disclosureUrl: seed.disclosureUrl,
        tokenizationMode: seed.tokenizationMode,
        defillamaPool: seed.defillamaPool,
    };
}

export interface AssetResult {
    data: StoredAsset;
    needsFill: boolean;
}

/**
 * Returns a renderable asset. Cache hit is returned as-is (flagging whether a
 * qualitative fill is still pending). Cache miss runs the fast quant phase,
 * stores it, and returns it with needsFill=true. Returns null if the asset
 * does not resolve to any readable data.
 */
export async function getAsset(assetId: string): Promise<AssetResult | null> {
    const cached = await getStoredAsset(assetId);
    if (cached) {
        return { data: cached, needsFill: cached.record.qualitative_pending === true };
    }

    const record = await ingestQuant(assetId, seedOptions(assetId));

    // Nothing readable on-chain and not seeded -> not a resolvable asset.
    if (Object.keys(record.fields).length === 0) return null;

    const assessment = await saveAsset(record);
    return {
        data: {
            record,
            assessment,
            ingested_at: record.ingested_at,
            computed_at: assessment.computed_at,
        },
        needsFill: record.qualitative_pending === true,
    };
}

// ── Universe (the decision surface) ──────────────────────────────────────────

/** Where trust bottoms out for the strongest (most independent) evidence item. */
function strongestTrustBoundary(evidence: EvidenceItem[]): string | null {
    const usable = evidence.filter((e) => e.confidence !== "unverifiable");
    if (usable.length === 0) return null;
    const top = usable.reduce((best, e) => (e.independence > best.independence ? e : best));
    return EVIDENCE_TRUST_BOUNDARY[top.source_type] ?? null;
}

function numField(data: StoredAsset, name: "min_investment_usd" | "yield_apy"): number | null {
    const v = data.record.fields[name]?.value;
    return typeof v === "number" ? v : null;
}

/**
 * A yield's kind IS part of the number: a live DeFi pool APY (aggregator source)
 * is a different thing from a fund's stated rate (a seeded, manual figure), and
 * the card must not blur them. Derived from the field's provenance, not guessed.
 */
function yieldKind(data: StoredAsset): AssetSummary["yield_kind"] {
    const y = data.record.fields.yield_apy;
    if (!y) return null;
    return y.method === "aggregator" ? "pool_apy" : "stated_rate";
}

/** Flattens a stored asset into the summary the decision engine ranks. */
export function toSummary(data: StoredAsset, providerUrl?: string | null): AssetSummary {
    const { record, assessment } = data;
    const f = record.fields;
    const backing = assessment.dimensions.backing;
    return {
        asset_id: record.asset_id,
        symbol: record.identifiers.symbol,
        name: record.identifiers.name,
        issuer_name: record.identifiers.issuer_name ?? null,
        chain_id: record.identifiers.chain_id,
        provider_url: providerUrl ?? null,
        jurisdiction: (f.jurisdiction?.value as Jurisdiction | undefined) ?? null,
        min_investment_usd: numField(data, "min_investment_usd"),
        yield_apy: numField(data, "yield_apy"),
        yield_kind: yieldKind(data),
        yield_as_of: f.yield_apy?.as_of ?? null,
        redemption_speed: (f.redemption_speed?.value as RedemptionSpeed | undefined) ?? null,
        backing_flag: backing.flag,
        backing_reason: backing.reason,
        backing_confidence: backing.confidence,
        trust_boundary: strongestTrustBoundary(record.backing_evidence ?? []),
    };
}

let universeCache: { at: number; data: AssetSummary[] } | null = null;
const UNIVERSE_TTL_MS = 5 * 60 * 1000;

/**
 * The assessed seed universe as decision-ready summaries. Cached in memory (TTL)
 * so the landing doesn't re-ingest every asset on each load; in production the
 * cron keeps the store warm and this reads through it.
 */
export async function getUniverse(): Promise<AssetSummary[]> {
    if (universeCache && Date.now() - universeCache.at < UNIVERSE_TTL_MS) {
        return universeCache.data;
    }

    const summaries = await Promise.all(
        allSeeds().map(async ({ assetId, seed }) => {
            try {
                const r = await getAsset(assetId);
                return r ? toSummary(r.data, seed.providerUrl) : null;
            } catch (err) {
                console.error(`[universe] failed to assemble ${assetId}:`, err);
                return null;
            }
        }),
    );

    const data = summaries.filter((s): s is AssetSummary => s !== null);
    universeCache = { at: Date.now(), data };
    return data;
}

// Per-instance in-flight guard: rapid duplicate requests for the same asset all
// schedule `after(fillQualitative)`, and each fill runs a paid extraction. This
// dedups them within an instance so only one fill per asset runs at a time; the
// persisted `qualitative_pending` flag and the global budget cover the rest.
const inFlightFills = new Set<string>();

/**
 * Runs the deferred qualitative phase for an asset and persists the result.
 * Safe to call from `after()`; failures are logged, not thrown.
 */
export async function fillQualitative(assetId: string): Promise<void> {
    if (inFlightFills.has(assetId)) return;
    inFlightFills.add(assetId);
    try {
        const stored = await getStoredAsset(assetId);
        const opts = seedOptions(assetId);

        // Prefer the stored record; if none (no DB), re-run quant to get one.
        const base = stored?.record ?? (await ingestQuant(assetId, opts));
        if (base.qualitative_pending === false) return;

        const filled = await ingestQualitative(base, opts);
        await saveAsset(filled);
    } catch (err) {
        console.error(`[service] qualitative fill failed for ${assetId}:`, err);
    } finally {
        inFlightFills.delete(assetId);
    }
}
