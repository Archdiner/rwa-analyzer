import type { Confidence } from "@/lib/contracts";
import { confidenceLabel } from "@/lib/display";

const STYLES: Record<Confidence, string> = {
    verified: "border-[color:var(--verified)] text-[color:var(--verified)]",
    auto: "border-[color:var(--auto)] text-[color:var(--auto)] confidence-auto",
    unverifiable: "border-[color:var(--unverifiable)] text-[color:var(--text-faint)]",
};

export default function ConfidenceBadge({ confidence, size = "sm" }: { confidence: Confidence; size?: "sm" | "md" }) {
    const pad = size === "md" ? "px-2.5 py-1 text-xs" : "px-2 py-0.5 text-[10px]";
    return (
        <span
            className={`inline-flex items-center gap-1 rounded-full border font-mono uppercase tracking-wide ${pad} ${STYLES[confidence]}`}
            title={
                confidence === "verified"
                    ? "Independently checkable (on-chain read, attested feed, or reference API)."
                    : confidence === "auto"
                      ? "Machine-derived (LLM/aggregator). Plausible but unconfirmed — verify yourself."
                      : "Required data was missing or a citation failed validation."
            }
        >
            {confidenceLabel(confidence)}
        </span>
    );
}
