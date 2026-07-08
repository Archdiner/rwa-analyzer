"use client";

import { useState } from "react";
import { ChevronRight, ExternalLink } from "lucide-react";
import type { FieldMap, FieldName, FieldValue } from "@/lib/contracts";
import { FIELD_LABELS } from "@/lib/display";
import ConfidenceBadge from "@/components/ConfidenceBadge";

function formatValue(v: FieldValue): string {
    if (typeof v === "boolean") return v ? "Yes" : "No";
    if (typeof v === "number") return v.toLocaleString();
    return String(v).replace(/_/g, " ");
}

/** A quiet, expandable source log. Shows the exact fields behind a dimension —
 *  value, provenance, and any verbatim citation — as legible records. */
export default function SourceExpander({ inputs, fields }: { inputs: FieldName[]; fields: FieldMap }) {
    const [open, setOpen] = useState(false);
    const present = inputs.map((name) => ({ name, field: fields[name] })).filter((x) => x.field);

    if (present.length === 0) {
        return <p className="mt-3 text-xs text-text-faint">No source data available for this dimension.</p>;
    }

    return (
        <div className="mt-3">
            <button
                onClick={() => setOpen((o) => !o)}
                className="inline-flex items-center gap-1 text-xs font-medium text-text-muted transition-colors hover:text-text"
            >
                <ChevronRight className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-90" : ""}`} />
                {open ? "Hide" : "Show"} sources ({present.length})
            </button>

            {open && (
                <ul className="mt-3 divide-y divide-border overflow-hidden rounded-[3px] border border-border">
                    {present.map(({ name, field }) => (
                        <li key={name} className="bg-bg-elev p-3">
                            <div className="flex items-center justify-between gap-2">
                                <span className="eyebrow">{FIELD_LABELS[name] ?? name}</span>
                                <ConfidenceBadge confidence={field!.confidence} />
                            </div>
                            <div className="mt-1.5 font-mono text-sm text-text">{formatValue(field!.value)}</div>
                            <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[11px] text-text-faint">
                                <span>source: {field!.source}</span>
                                <span>method: {field!.method}</span>
                                <span>as of: {field!.as_of.slice(0, 10)}</span>
                            </div>
                            {field!.citation && (
                                <blockquote className="mt-2.5 border-l-2 border-primary pl-3">
                                    <p className="text-[13px] italic leading-relaxed text-text-muted">
                                        &ldquo;{field!.citation.text_span}&rdquo;
                                    </p>
                                    <a
                                        href={field!.citation.url}
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
                    ))}
                </ul>
            )}
        </div>
    );
}
