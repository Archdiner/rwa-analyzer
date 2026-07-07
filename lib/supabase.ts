// ---------------------------------------------------------------------------
// Supabase client
// ---------------------------------------------------------------------------
// v1 has no user accounts — the app reads/writes the asset store server-side
// with the service role only. A browser client is intentionally omitted.
// ---------------------------------------------------------------------------

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let serverClient: SupabaseClient | null = null;

/**
 * Returns the singleton service-role Supabase client for server-side reads and
 * writes to the asset store. Throws if credentials are absent.
 */
export function getSupabase(): SupabaseClient {
    if (serverClient) return serverClient;

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_PRIVATE_KEY;

    if (!url || !key) {
        throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    }

    serverClient = createClient(url, key, {
        auth: { autoRefreshToken: false, persistSession: false },
    });

    return serverClient;
}

/** True when Supabase credentials are configured (store is available). */
export function hasSupabase(): boolean {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_PRIVATE_KEY;
    return Boolean(url && key);
}
