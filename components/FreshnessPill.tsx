import type { Freshness } from "@/lib/contracts";

/**
 * The third axis, made visible. A green is a historical claim; this says how
 * current the evidence is relative to its expected refresh cadence. Separate
 * from the flag (independence) and the confidence badge (extraction).
 */
const MAP: Record<Freshness, { text: string; bg: string; label: string; title: string }> = {
    live: {
        text: "text-green",
        bg: "bg-[color:var(--green-bg)]",
        label: "Live",
        title: "Evidence is within its source's expected refresh cadence.",
    },
    aging: {
        text: "text-amber",
        bg: "bg-[color:var(--amber-bg)]",
        label: "Aging",
        title: "Evidence is past its expected refresh but not yet stale - read with caution.",
    },
    stale: {
        text: "text-red",
        bg: "bg-[color:var(--red-bg)]",
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
        <span
            className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-medium ${s.bg} ${s.text}`}
            title={s.title}
        >
            {s.label}
            {nextUpdate && (
                <span className="font-normal text-text-faint">· updates ~{nextUpdate.slice(0, 10)}</span>
            )}
        </span>
    );
}
