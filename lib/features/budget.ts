// ---------------------------------------------------------------------------
// Daily spend budget for the triage worker (R-COST)
// ---------------------------------------------------------------------------
// A persistent per-day counter so the worker drains the queue only while budget
// remains, then pauses until the next day (the date PK is the implicit reset).
// The debit is atomic (a single-statement SQL upsert, see debit_budget in
// supabase/schema.sql) so concurrent worker invocations can't overspend.
// Degrades gracefully when Supabase is unconfigured.
// ---------------------------------------------------------------------------

import { getSupabase, hasSupabase } from "@/lib/supabase";

/** Hard daily ceiling on the OpenAI key (triage + embeddings). */
export const DAILY_BUDGET_USD = 1.0;

/** Today's date key (UTC, date-only). Pass an explicit date in tests. */
export function budgetDate(now: Date = new Date()): string {
    return now.toISOString().slice(0, 10);
}

/** USD already spent on `date` (0 if none / unconfigured). */
export async function spentOn(date: string): Promise<number> {
    if (!hasSupabase()) return 0;
    const { data, error } = await getSupabase()
        .from("processing_budget")
        .select("spent_usd")
        .eq("spend_date", date)
        .maybeSingle();
    if (error) throw error;
    return data ? Number((data as { spent_usd: number }).spent_usd) : 0;
}

/** USD remaining in the daily budget for `date`. */
export async function remaining(date: string): Promise<number> {
    return Math.max(0, DAILY_BUDGET_USD - (await spentOn(date)));
}

/** True if there's room for an item estimated to cost `estimate`. */
export async function canAfford(date: string, estimate: number): Promise<boolean> {
    return (await remaining(date)) >= estimate;
}

/** Atomically add `amount` to `date`'s spend; returns the new total. No-op total when unconfigured. */
export async function debit(date: string, amount: number): Promise<number> {
    if (!hasSupabase()) return amount;
    const { data, error } = await getSupabase().rpc("debit_budget", { p_date: date, p_amount: amount });
    if (error) throw error;
    return Number(data);
}
