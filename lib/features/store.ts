// ---------------------------------------------------------------------------
// Feature-request queue store (Phase 1)
// ---------------------------------------------------------------------------
// Thin persistence over the `feature_requests` table. Like lib/store.ts, every
// function degrades gracefully when Supabase is unconfigured (returns null / []
// / no-op) so local dev works without a database.
// ---------------------------------------------------------------------------

import { getSupabase, hasSupabase } from "@/lib/supabase";

export type FeatureStatus = "received" | "triaged" | "rejected" | "promoted";

// Open-ended by design: the intake box accepts any idea, and triage classifies
// without forcing everything into the existing modules or rejecting ambition.
// `scale` flags size (never a reason to discard); `themes` feed cross-suggestion
// synthesis (Phase 2); `buildable_now` gates only the narrow auto-PR tail.
export type TriageArea =
    | "ingestion"
    | "computation"
    | "app"
    | "new_capability"
    | "new_direction"
    | "meta"
    | "unknown";

export type TriageScale = "small_bounded" | "medium" | "large" | "exploratory";

export interface TriageResult {
    summary: string;
    area: TriageArea;
    scale: TriageScale;
    merit: string;
    themes: string[];
    buildable_now: boolean;
    dedup_hint: string;
}

export interface FeatureRequest {
    id: string;
    submitter_ip: string | null;
    raw_text: string;
    status: FeatureStatus;
    triage: TriageResult | null;
    cluster_id: string | null;
    cluster_label: string | null;
    created_at: string;
}

/** Enqueue a submission at `received`. Returns the new id, or null if unconfigured. */
export async function enqueueRequest(rawText: string, submitterIp: string | null): Promise<string | null> {
    if (!hasSupabase()) return null;
    const { data, error } = await getSupabase()
        .from("feature_requests")
        .insert({ raw_text: rawText, submitter_ip: submitterIp, status: "received" })
        .select("id")
        .single();
    if (error) throw error;
    return (data as { id: string }).id;
}

/** Oldest N `received` requests (FIFO) for the worker to drain. */
export async function nextReceived(limit: number): Promise<FeatureRequest[]> {
    if (!hasSupabase()) return [];
    const { data, error } = await getSupabase()
        .from("feature_requests")
        .select("*")
        .eq("status", "received")
        .order("created_at", { ascending: true })
        .limit(limit);
    if (error) throw error;
    return (data ?? []) as FeatureRequest[];
}

/** Record a triage outcome (`triaged` on success, `rejected` on persistent malformation). */
export async function setTriage(
    id: string,
    status: Extract<FeatureStatus, "triaged" | "rejected">,
    triage: TriageResult | null,
): Promise<void> {
    if (!hasSupabase()) return;
    const { error } = await getSupabase().from("feature_requests").update({ status, triage }).eq("id", id);
    if (error) throw error;
}
