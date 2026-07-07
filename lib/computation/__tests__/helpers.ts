// Shared test helpers (not a suite — no .test.ts suffix).
import type { FieldObject, FieldValue, Method, Confidence } from "@/lib/contracts";

export function f<T extends FieldValue>(
    value: T,
    opts: { method?: Method; confidence?: Confidence; source?: string; as_of?: string } = {},
): FieldObject<T> {
    return {
        value,
        source: opts.source ?? "test",
        method: opts.method ?? "onchain_read",
        confidence: opts.confidence ?? "verified",
        as_of: opts.as_of ?? new Date().toISOString(),
        citation: null,
    };
}

export function daysAgo(n: number): string {
    return new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString();
}
