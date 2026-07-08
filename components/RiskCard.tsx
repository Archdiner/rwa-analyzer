import { AlertTriangle, Loader2 } from "lucide-react";
import { coverageTier, type Assessment, type NormalizedAssetRecord } from "@/lib/contracts";
import { chainDisplay, FIELD_LABELS } from "@/lib/display";
import { nextExpectedUpdate } from "@/lib/computation/freshness";
import DimensionRow from "@/components/DimensionRow";
import BackingEvidence from "@/components/BackingEvidence";
import PendingRefresher from "@/components/PendingRefresher";

const TIER_TONE: Record<string, string> = {
    Verified: "text-text",
    Auto: "text-amber",
    Unverifiable: "text-text-faint",
};

export default function RiskCard({
    record,
    assessment,
    computedAt,
    qualitativePending,
}: {
    record: NormalizedAssetRecord;
    assessment: Assessment;
    computedAt: string;
    qualitativePending: boolean;
}) {
    const { identifiers, fields, conflicts } = record;
    const tier = coverageTier(assessment.overall_confidence);
    const dims = assessment.dimensions;

    // The backing freshness pill's "updates ~date" comes from the strongest
    // (most independent) usable evidence item — the same one the verdict rests on.
    const usableEvidence = (record.backing_evidence ?? []).filter((e) => e.confidence !== "unverifiable");
    const strongestEvidence = usableEvidence.length
        ? usableEvidence.reduce((a, b) => (b.independence > a.independence ? b : a))
        : null;
    const backingNextUpdate =
        dims.backing.freshness && strongestEvidence ? nextExpectedUpdate(strongestEvidence) : null;

    return (
        <article className="panel overflow-hidden">
            {/* Header */}
            <div className="border-b border-border bg-bg-elev-2 px-6 py-6">
                <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                        <h1 className="text-xl font-semibold tracking-tight text-text">{identifiers.name}</h1>
                        <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-sm text-text-muted">
                            <span className="font-medium text-text">{identifiers.symbol}</span>
                            <span className="text-text-faint">·</span>
                            <span>{chainDisplay(identifiers.chain_id)}</span>
                            {identifiers.issuer_name && (
                                <>
                                    <span className="text-text-faint">·</span>
                                    <span>{identifiers.issuer_name}</span>
                                </>
                            )}
                        </div>
                    </div>
                    <div className="shrink-0 text-right">
                        <span className={`font-mono text-sm font-semibold uppercase tracking-wide ${TIER_TONE[tier]}`}>
                            {tier}
                        </span>
                        <p className="eyebrow mt-0.5">Coverage tier</p>
                    </div>
                </div>
            </div>

            {qualitativePending && (
                <div className="flex items-center gap-2 border-b border-border bg-bg-elev px-6 py-2.5 text-xs text-text-muted">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Analyzing issuer documents — structure, redemption, and eligibility will fill in shortly.
                    <PendingRefresher />
                </div>
            )}

            {conflicts.length > 0 && (
                <div className="flex items-start gap-2 border-b border-border bg-amber-bg px-6 py-3 text-xs text-amber">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>
                        Sources disagree on {conflicts.map((c) => FIELD_LABELS[c.field] ?? c.field).join(", ")} —
                        treated as a risk signal and confidence downgraded.
                    </span>
                </div>
            )}

            {/* Backing leads — it is the whole point. */}
            <div className="px-6">
                <DimensionRow
                    dimensionKey="backing"
                    dimension={dims.backing}
                    fields={fields}
                    noBorder
                    freshnessNextUpdate={backingNextUpdate}
                />
                {record.backing_evidence?.length > 0 && (
                    <div className="pb-5">
                        <p className="eyebrow mb-2">Backing evidence</p>
                        <BackingEvidence evidence={record.backing_evidence} />
                    </div>
                )}
            </div>

            {/* Can you use it? */}
            <div className="border-t border-border bg-bg-elev-2 px-6 py-2">
                <p className="eyebrow py-2">Can you use it?</p>
            </div>
            <div className="px-6">
                <DimensionRow dimensionKey="access" dimension={dims.access} fields={fields} noBorder />
                <DimensionRow dimensionKey="redemption" dimension={dims.redemption} fields={fields} />
                <DimensionRow dimensionKey="structure" dimension={dims.structure} fields={fields} />
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between border-t border-border px-6 py-3.5 text-[11px] text-text-faint">
                <span>Information, not financial advice. We rate assets, not decisions.</span>
                <span className="font-mono">
                    computed {new Date(computedAt).toISOString().slice(0, 16).replace("T", " ")}Z
                </span>
            </div>
        </article>
    );
}
