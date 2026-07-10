// ---------------------------------------------------------------------------
// Global daily cost budget - the circuit-breaker for paid external calls
// ---------------------------------------------------------------------------
// The one mechanism that bounds worst-case spend regardless of how a caller
// reaches us (rate-limit bypass, header spoofing, many distinct assets). Every
// expensive external call (OpenAI extraction, web-search discovery) must first
// reserve a unit here; when the daily cap is reached the call is skipped and the
// pipeline degrades honestly to `unverifiable` instead of spending.
//
// Durable across serverless instances via a Postgres atomic increment
// (`bump_usage`). Falls back to a per-instance in-memory counter when Supabase
// is absent or the RPC is not migrated, so there is always *some* ceiling and an
// un-migrated deploy still cannot run away.
// ---------------------------------------------------------------------------

import { getSupabase, hasSupabase } from "@/lib/supabase";

export type UsageKind = "openai" | "web_search";

/** Sensible defaults for a beta/testing launch; override per-kind via env. */
const DEFAULT_CAPS: Record<UsageKind, number> = { openai: 500, web_search: 500 };

function capFor(kind: UsageKind): number {
    const raw = kind === "openai" ? process.env.OPENAI_DAILY_CAP : process.env.WEB_SEARCH_DAILY_CAP;
    const n = raw != null && raw !== "" ? Number(raw) : NaN;
    return Number.isFinite(n) && n >= 0 ? n : DEFAULT_CAPS[kind];
}

/** UTC calendar day; the counter resets at 00:00 UTC. */
function today(): string {
    return new Date().toISOString().slice(0, 10);
}

// Per-instance fallback counter (Supabase absent or RPC missing). Bounded map.
const mem = new Map<string, number>();

function memConsume(kind: UsageKind, cap: number): boolean {
    const key = `${today()}:${kind}`;
    const next = (mem.get(key) ?? 0) + 1;
    mem.set(key, next);
    if (mem.size > 64) {
        const day = today();
        for (const k of mem.keys()) if (!k.startsWith(day)) mem.delete(k);
    }
    return next <= cap;
}

/**
 * Reserves one unit of the daily budget for `kind`. Returns true if the call is
 * within budget (caller may proceed), false if the cap is reached (caller should
 * skip the paid call and degrade gracefully). Never throws.
 */
export async function reserveExternalCall(kind: UsageKind): Promise<boolean> {
    const cap = capFor(kind);
    if (cap <= 0) return false;
    if (!hasSupabase()) return memConsume(kind, cap);

    try {
        const { data, error } = await getSupabase().rpc("bump_usage", { p_day: today(), p_kind: kind });
        if (error || typeof data !== "number") return memConsume(kind, cap);
        return data <= cap;
    } catch {
        return memConsume(kind, cap);
    }
}
