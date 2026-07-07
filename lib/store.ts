// ---------------------------------------------------------------------------
// Asset store
// ---------------------------------------------------------------------------
// Thin persistence over Supabase for Contract A records + Contract B
// assessments + the search index. Every function degrades gracefully when
// Supabase is not configured (returns null / no-ops) so the app still works
// on-demand in local dev without a database.
// ---------------------------------------------------------------------------

import { getSupabase, hasSupabase } from "@/lib/supabase";
import { computeAssessment } from "@/lib/computation";
import type { Assessment, NormalizedAssetRecord } from "@/lib/contracts";

export interface StoredAsset {
    record: NormalizedAssetRecord;
    assessment: Assessment;
    ingested_at: string;
    computed_at: string;
}

export interface SearchHit {
    asset_id: string;
    symbol: string;
    name: string;
    issuer_name?: string | null;
}

/** Fetches a stored record + its assessment, or null if absent/unconfigured. */
export async function getStoredAsset(assetId: string): Promise<StoredAsset | null> {
    if (!hasSupabase()) return null;
    const supabase = getSupabase();

    const { data: assetRow } = await supabase
        .from("assets")
        .select("record, ingested_at")
        .eq("asset_id", assetId)
        .maybeSingle();
    if (!assetRow) return null;

    const { data: assessRow } = await supabase
        .from("assessments")
        .select("assessment, computed_at")
        .eq("asset_id", assetId)
        .maybeSingle();

    const record = assetRow.record as NormalizedAssetRecord;

    // If the assessment is missing (or the record changed since), compute now.
    const assessment = (assessRow?.assessment as Assessment | undefined) ?? computeAssessment(record);

    return {
        record,
        assessment,
        ingested_at: assetRow.ingested_at as string,
        computed_at: (assessRow?.computed_at as string) ?? assessment.computed_at,
    };
}

/** Writes a record + freshly computed assessment + search index entry. */
export async function saveAsset(record: NormalizedAssetRecord): Promise<Assessment> {
    const assessment = computeAssessment(record);
    if (!hasSupabase()) return assessment;

    const supabase = getSupabase();

    await supabase.from("assets").upsert({
        asset_id: record.asset_id,
        identifiers: record.identifiers,
        record,
        qualitative_pending: record.qualitative_pending ?? false,
        ingested_at: record.ingested_at,
    });

    await supabase.from("assessments").upsert({
        asset_id: record.asset_id,
        assessment,
        overall_confidence: assessment.overall_confidence,
        computed_at: assessment.computed_at,
    });

    await supabase.from("asset_index").upsert({
        asset_id: record.asset_id,
        symbol: record.identifiers.symbol,
        name: record.identifiers.name,
        issuer_name: record.identifiers.issuer_name ?? null,
    });

    return assessment;
}

/** Ticker/name search over the seeded index (case-insensitive). */
export async function searchIndex(query: string, limit = 8): Promise<SearchHit[]> {
    if (!hasSupabase()) return [];
    const supabase = getSupabase();

    const q = query.trim();
    if (!q) return [];

    const { data } = await supabase
        .from("asset_index")
        .select("asset_id, symbol, name, issuer_name")
        .or(`symbol.ilike.%${q}%,name.ilike.%${q}%`)
        .limit(limit);

    return (data as SearchHit[]) ?? [];
}

/** Asset ids whose quant data is older than `olderThanMs` (for the cron). */
export async function staleAssetIds(olderThanMs: number, limit = 25): Promise<string[]> {
    if (!hasSupabase()) return [];
    const supabase = getSupabase();

    const cutoff = new Date(Date.now() - olderThanMs).toISOString();
    const { data } = await supabase
        .from("assets")
        .select("asset_id")
        .lt("ingested_at", cutoff)
        .order("ingested_at", { ascending: true })
        .limit(limit);

    return ((data as { asset_id: string }[]) ?? []).map((r) => r.asset_id);
}
