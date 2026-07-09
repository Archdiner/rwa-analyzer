import type { Flag } from "@/lib/contracts";
import { flagLabel } from "@/lib/display";

/**
 * Access red is an ELIGIBILITY restriction, not a danger signal, so it renders
 * in a distinct "gate" color with the word "Restricted" rather than "Concern".
 */
export default function FlagChip({ flag, isAccess = false }: { flag: Flag; isAccess?: boolean }) {
    const gate = isAccess && flag === "red";

    const map: Record<Flag, { dot: string; text: string; label: string }> = {
        green: { dot: "bg-green", text: "text-green", label: flagLabel("green") },
        amber: { dot: "bg-amber", text: "text-amber", label: flagLabel("amber") },
        red: { dot: "bg-red", text: "text-red", label: flagLabel("red") },
        unknown: { dot: "bg-unknown", text: "text-text-faint", label: "Unknown" },
    };

    const s = gate ? { dot: "bg-gate", text: "text-gate", label: "Restricted" } : map[flag];

    return (
        <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${s.text}`}>
            <span className={`h-2 w-2 rounded-full ${s.dot}`} />
            {s.label}
        </span>
    );
}
