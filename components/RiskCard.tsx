import { AlertTriangle, Loader2 } from "lucide-react";
import { coverageTier, type Assessment, type NormalizedAssetRecord } from "@/lib/contracts";
import { chainDisplay, FIELD_LABELS } from "@/lib/display";
import { nextExpectedUpdate, nextExpectedAt } from "@/lib/computation/freshness";
import DimensionRow from "@/components/DimensionRow";
import BackingEvidence from "@/components/BackingEvidence";
import PendingRefresher from "@/components/PendingRefresher";

const TIER_STYLE: Record<string, string> = {
    Verified: "border-[color:var(--verified)] text-[color:var(--verified)]",
    Auto: "border-[color:var(--auto)] text-[color:var(--auto)] confidence-auto",
    Unverifiable: "border-[color:var(--unverifiable)] text-text-faint",
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
    // (most independent) usable evidence item - the same one the verdict rests on.
    const usableEvidence = (record.backing_evidence ?? []).filter((e) => e.confidence !== "unverifiable");
    const strongestEvidence = usableEvidence.length
        ? usableEvidence.reduce((a, b) => (b.independence > a.independence ? b : a))
        : null;
    const backingNextUpdate =
        dims.backing.freshness && strongestEvidence ? nextExpectedUpdate(strongestEvidence) : null;

    // v1.2 on-chain dimensions render only for lending assets (data present).
    // Their next-refresh date comes from the read's as_of + a daily cadence.
    const DAY_MS = 24 * 60 * 60 * 1000;
    const hasYieldSource = dims.yield_source && dims.yield_source.flag !== "unknown";
    const hasMarketRisk = dims.market_risk && dims.market_risk.flag !== "unknown";
    const yieldNextUpdate =
        hasYieldSource && dims.yield_source.freshness && record.yield_source_data
            ? nextExpectedAt(record.yield_source_data.organic_apy.as_of, DAY_MS)
            : null;
    const marketRiskNextUpdate =
        hasMarketRisk && dims.market_risk.freshness && record.market_risk_data
            ? nextExpectedAt(record.market_risk_data.utilization.as_of, DAY_MS)
            : null;

    return (
        <article className="rounded-2xl border border-border bg-[color:var(--bg-elev)] overflow-hidden">
            {/* Header */}
            <div className="px-6 py-5 border-b border-border">
                <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                        <h1 className="text-lg font-semibold text-text truncate">{identifiers.name}</h1>
                        <div className="mt-1 flex items-center gap-2 text-sm text-text-muted">
                            <span className="font-mono">{identifiers.symbol}</span>
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
                    <div className="text-right">
                        <div
                            className={`inline-flex items-center rounded-lg border px-3 py-1.5 text-sm font-mono uppercase tracking-wide ${TIER_STYLE[tier]}`}
                            title="Coverage tier = lowest confidence among assessed dimensions. Not a risk grade."
                        >
                            {tier}
                        </div>
                        <p className="mt-1 text-[10px] text-text-faint">coverage tier</p>
                    </div>
                </div>
            </div>

            {qualitativePending && (
                <div className="flex items-center gap-2 px-6 py-2.5 bg-[color:var(--bg-elev-2)] border-b border-border text-xs text-text-muted">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Analyzing issuer documents - structure, redemption, and eligibility will fill in shortly.
                    <PendingRefresher />
                </div>
            )}

            {conflicts.length > 0 && (
                <div className="flex items-start gap-2 px-6 py-3 bg-[color:var(--amber-bg)] border-b border-border text-xs text-amber">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    <span>
                        Sources disagree on{" "}
                        {conflicts.map((c) => FIELD_LABELS[c.field] ?? c.field).join(", ")} - treated as a risk signal
                        and confidence downgraded.
                    </span>
                </div>
            )}

            {/* Access first - you need to know if you can even touch it. */}
            <div className="px-6">
                <div className="my-4 rounded-xl border border-[color:var(--gate-bg)] bg-[color:var(--bg-elev-2)] px-4">
                    <DimensionRow dimensionKey="access" dimension={dims.access} fields={fields} />
                </div>
            </div>

            {/* Remaining dimensions */}
            <div className="px-6 pb-2">
                <div className="border-t border-border first:border-t-0">
                    <DimensionRow
                        dimensionKey="backing"
                        dimension={dims.backing}
                        fields={fields}
                        noBorder
                        freshnessNextUpdate={backingNextUpdate}
                    />
                    {record.backing_evidence?.length > 0 && (
                        <div className="-mt-2 pb-5">
                            <p className="mb-1 text-[11px] uppercase tracking-wide text-text-faint">Backing evidence</p>
                            <BackingEvidence evidence={record.backing_evidence} />
                        </div>
                    )}
                </div>
                <DimensionRow dimensionKey="redemption" dimension={dims.redemption} fields={fields} />
                <DimensionRow dimensionKey="structure" dimension={dims.structure} fields={fields} />
                {/* v1.2 on-chain yield/risk dimensions - shown only for lending assets. */}
                {hasYieldSource && (
                    <DimensionRow
                        dimensionKey="yield_source"
                        dimension={dims.yield_source}
                        fields={fields}
                        freshnessNextUpdate={yieldNextUpdate}
                    />
                )}
                {hasMarketRisk && (
                    <DimensionRow
                        dimensionKey="market_risk"
                        dimension={dims.market_risk}
                        fields={fields}
                        freshnessNextUpdate={marketRiskNextUpdate}
                    />
                )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-border flex items-center justify-between text-[11px] text-text-faint">
                <span>Information, not financial advice. We rate assets, not decisions.</span>
                <span>computed {new Date(computedAt).toISOString().slice(0, 16).replace("T", " ")}Z</span>
            </div>
        </article>
    );
}
