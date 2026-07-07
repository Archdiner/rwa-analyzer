"use client";

import { useState } from "react";
import { ChevronDown, ExternalLink } from "lucide-react";
import type { FieldMap, FieldName, FieldValue } from "@/lib/contracts";
import { FIELD_LABELS } from "@/lib/display";
import ConfidenceBadge from "@/components/ConfidenceBadge";

function formatValue(v: FieldValue): string {
    if (typeof v === "boolean") return v ? "Yes" : "No";
    if (typeof v === "number") return v.toLocaleString();
    return String(v).replace(/_/g, " ");
}

export default function SourceExpander({ inputs, fields }: { inputs: FieldName[]; fields: FieldMap }) {
    const [open, setOpen] = useState(false);
    const present = inputs.map((name) => ({ name, field: fields[name] })).filter((x) => x.field);

    if (present.length === 0) {
        return <p className="text-xs text-text-faint">No source data available for this dimension.</p>;
    }

    return (
        <div>
            <button
                onClick={() => setOpen((o) => !o)}
                className="flex items-center gap-1 text-xs text-text-muted hover:text-text transition-colors"
            >
                <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
                {open ? "Hide" : "Show"} sources ({present.length})
            </button>

            {open && (
                <ul className="mt-3 space-y-3">
                    {present.map(({ name, field }) => (
                        <li key={name} className="rounded-lg border border-border bg-[color:var(--bg-elev-2)] p-3">
                            <div className="flex items-center justify-between gap-2">
                                <span className="text-xs text-text-muted">{FIELD_LABELS[name] ?? name}</span>
                                <ConfidenceBadge confidence={field!.confidence} />
                            </div>
                            <div className="mt-1 font-mono text-sm text-text">{formatValue(field!.value)}</div>
                            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-text-faint">
                                <span>source: {field!.source}</span>
                                <span>method: {field!.method}</span>
                                <span>as of: {field!.as_of.slice(0, 10)}</span>
                            </div>
                            {field!.citation && (
                                <div className="mt-2 border-l-2 border-[color:var(--auto)] pl-2.5">
                                    <p className="text-xs italic text-text-muted">“{field!.citation.text_span}”</p>
                                    <a
                                        href={field!.citation.url}
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
                    ))}
                </ul>
            )}
        </div>
    );
}
