import { ExternalLink } from "lucide-react";
import { GREEN_INDEPENDENCE_FLOOR, type EvidenceItem } from "@/lib/contracts";
import {
    EVIDENCE_SOURCE_LABELS,
    EVIDENCE_EXTRACTION_LABELS,
    independenceLabel,
} from "@/lib/display";
import ConfidenceBadge from "@/components/ConfidenceBadge";

function usd(n: number): string {
    if (n >= 1_000_000) return `$${(n / 1_000_000).toLocaleString(undefined, { maximumFractionDigits: 1 })}M`;
    if (n >= 1_000) return `$${(n / 1_000).toLocaleString(undefined, { maximumFractionDigits: 0 })}K`;
    return `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

/**
 * The backing dimension's provenance panel. Makes the two axes legible:
 * INDEPENDENCE (green-eligible only at >= 3) drives the ring color; EXTRACTION +
 * confidence describe how the number was obtained.
 */
export default function BackingEvidence({ evidence }: { evidence: EvidenceItem[] }) {
    if (!evidence || evidence.length === 0) return null;

    return (
        <ul className="mt-3 space-y-2">
            {evidence.map((e, i) => {
                const independent = e.independence >= GREEN_INDEPENDENCE_FLOOR;
                return (
                    <li
                        key={`${e.source_type}-${i}`}
                        className="rounded-lg border border-border bg-[color:var(--bg-elev-2)] p-3 text-xs"
                    >
                        <div className="flex items-center justify-between gap-2">
                            <span className="font-medium text-text">{EVIDENCE_SOURCE_LABELS[e.source_type]}</span>
                            <ConfidenceBadge confidence={e.confidence} />
                        </div>
                        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-text-faint">
                            <span
                                className={independent ? "text-[color:var(--green)]" : "text-amber"}
                                title="Independence sets the ceiling color. Green-eligible at 3+."
                            >
                                independence {e.independence}/5 · {independenceLabel(e.independence)}
                            </span>
                            <span>coverage: {Math.round(e.coverage_pct)}%</span>
                            <span>reserves: {usd(e.reserves_value)}</span>
                            <span>{EVIDENCE_EXTRACTION_LABELS[e.extraction]}</span>
                            <span>as of: {e.as_of.slice(0, 10)}</span>
                            {e.parse_confidence != null && <span>parse conf: {e.parse_confidence.toFixed(2)}</span>}
                        </div>
                        {e.note && <p className="mt-2 text-[11px] leading-relaxed text-text-muted">{e.note}</p>}
                        {e.citation && (
                            <div className="mt-2 border-l-2 border-[color:var(--auto)] pl-2.5">
                                <p className="italic text-text-muted">“{e.citation.text_span}”</p>
                                <a
                                    href={e.citation.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="mt-1 inline-flex items-center gap-1 text-[11px] text-verified hover:underline"
                                >
                                    <ExternalLink className="h-3 w-3" />
                                    source document
                                </a>
                            </div>
                        )}
                    </li>
                );
            })}
        </ul>
    );
}
