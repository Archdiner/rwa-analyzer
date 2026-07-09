import { ExternalLink } from "lucide-react";
import { GREEN_INDEPENDENCE_FLOOR, type EvidenceItem } from "@/lib/contracts";
import {
    EVIDENCE_SOURCE_LABELS,
    EVIDENCE_EXTRACTION_LABELS,
    EVIDENCE_TRUST_BOUNDARY,
    independenceLabel,
} from "@/lib/display";
import ConfidenceBadge from "@/components/ConfidenceBadge";

function usd(n: number): string {
    if (n >= 1_000_000) return `$${(n / 1_000_000).toLocaleString(undefined, { maximumFractionDigits: 1 })}M`;
    if (n >= 1_000) return `$${(n / 1_000).toLocaleString(undefined, { maximumFractionDigits: 0 })}K`;
    return `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: string }) {
    return (
        <div>
            <div className="eyebrow">{label}</div>
            <div className={`mt-0.5 font-mono text-xs ${tone ?? "text-text"}`}>{value}</div>
        </div>
    );
}

/**
 * The backing dimension's provenance panel. Makes the two axes legible:
 * INDEPENDENCE (green-eligible only at >= 3) is the ceiling; EXTRACTION +
 * confidence describe how the number was obtained.
 */
export default function BackingEvidence({ evidence }: { evidence: EvidenceItem[] }) {
    if (!evidence || evidence.length === 0) return null;

    return (
        <ul className="space-y-3">
            {evidence.map((e, i) => {
                const independent = e.independence >= GREEN_INDEPENDENCE_FLOOR;
                return (
                    <li key={`${e.source_type}-${i}`} className="rounded-[3px] border border-border bg-bg-elev p-4">
                        <div className="flex items-center justify-between gap-2">
                            <span className="text-sm font-semibold text-text">
                                {EVIDENCE_SOURCE_LABELS[e.source_type]}
                            </span>
                            <ConfidenceBadge confidence={e.confidence} />
                        </div>

                        <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
                            <Stat
                                label="Independence"
                                value={`${e.independence}/5`}
                                tone={independent ? "text-green" : "text-amber"}
                            />
                            <Stat label="Coverage" value={`${Math.round(e.coverage_pct)}%`} />
                            <Stat label="Reserves" value={usd(e.reserves_value)} />
                            <Stat label="As of" value={e.as_of.slice(0, 10)} />
                        </div>
                        <p className="mt-2 font-mono text-[11px] text-text-faint">
                            {independenceLabel(e.independence)} · {EVIDENCE_EXTRACTION_LABELS[e.extraction]}
                            {e.parse_confidence != null && ` · parse ${e.parse_confidence.toFixed(2)}`}
                        </p>

                        {e.note && <p className="mt-2.5 text-[13px] leading-relaxed text-text-muted">{e.note}</p>}

                        <div className="mt-3 border-l-2 border-border pl-3">
                            <p className="eyebrow">Trust boundary</p>
                            <p className="mt-1 text-[13px] leading-relaxed text-text-muted">
                                {EVIDENCE_TRUST_BOUNDARY[e.source_type]}
                            </p>
                        </div>

                        {e.citation && (
                            <blockquote className="mt-3 border-l-2 border-primary pl-3">
                                <p className="text-[13px] italic leading-relaxed text-text-muted">
                                    &ldquo;{e.citation.text_span}&rdquo;
                                </p>
                                <a
                                    href={e.citation.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"
                                >
                                    <ExternalLink className="h-3 w-3" />
                                    Source document
                                </a>
                            </blockquote>
                        )}
                    </li>
                );
            })}
        </ul>
    );
}
