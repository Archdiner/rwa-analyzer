import type { Freshness } from "@/lib/contracts";

/**
 * The third axis, made visible. A green is a historical claim; this says how
 * current the evidence is relative to its expected refresh cadence. Separate
 * from the flag (independence) and the confidence badge (extraction).
 */
const MAP: Record<Freshness, { dot: string; text: string; label: string; title: string }> = {
    live: {
        dot: "bg-green",
        text: "text-green",
        label: "Live",
        title: "Evidence is within its source's expected refresh cadence.",
    },
    aging: {
        dot: "bg-amber",
        text: "text-amber",
        label: "Aging",
        title: "Evidence is past its expected refresh but not yet stale - read with caution.",
    },
    stale: {
        dot: "bg-red",
        text: "text-red",
        label: "Stale",
        title: "Evidence is well past its expected refresh cadence; the verdict is downgraded.",
    },
};

export default function FreshnessPill({
    freshness,
    nextUpdate,
}: {
    freshness: Freshness;
    nextUpdate?: string | null;
}) {
    const s = MAP[freshness];
    return (
        <span className={`inline-flex items-center gap-1.5 text-[11px] font-medium ${s.text}`} title={s.title}>
            <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
            {s.label}
            {nextUpdate && <span className="font-normal text-text-faint">· updates ~{nextUpdate.slice(0, 10)}</span>}
        </span>
    );
}
