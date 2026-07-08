import type { Confidence } from "@/lib/contracts";

const STYLES: Record<Confidence, string> = {
    verified: "border-border text-text-muted",
    auto: "border-amber text-amber confidence-auto",
    unverifiable: "border-border text-text-faint",
};

const SHORT: Record<Confidence, string> = {
    verified: "verified",
    auto: "auto",
    unverifiable: "unverifiable",
};

const TITLE: Record<Confidence, string> = {
    verified: "Independently checkable (on-chain read, attested feed, or reference API).",
    auto: "Machine-derived (LLM/aggregator). Plausible but unconfirmed; verify at the source.",
    unverifiable: "Required data was missing or a citation failed validation.",
};

export default function ConfidenceBadge({ confidence, size = "sm" }: { confidence: Confidence; size?: "sm" | "md" }) {
    const pad = size === "md" ? "px-2 py-0.5 text-[11px]" : "px-1.5 py-0.5 text-[10px]";
    return (
        <span
            className={`inline-flex items-center rounded-[3px] border font-mono uppercase tracking-wider ${pad} ${STYLES[confidence]}`}
            title={TITLE[confidence]}
        >
            {SHORT[confidence]}
        </span>
    );
}
