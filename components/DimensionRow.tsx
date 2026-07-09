import type { DimensionAssessment, FieldMap } from "@/lib/contracts";
import { DIMENSION_TITLES } from "@/lib/display";
import FlagChip from "@/components/FlagChip";
import FreshnessPill from "@/components/FreshnessPill";
import ConfidenceBadge from "@/components/ConfidenceBadge";
import SourceExpander from "@/components/SourceExpander";

export default function DimensionRow({
    dimensionKey,
    dimension,
    fields,
    noBorder = false,
    freshnessNextUpdate = null,
}: {
    dimensionKey: string;
    dimension: DimensionAssessment;
    fields: FieldMap;
    noBorder?: boolean;
    freshnessNextUpdate?: string | null;
}) {
    const isAccess = dimensionKey === "access";

    return (
        <section className={`py-5 ${noBorder ? "" : "border-t border-border first:border-t-0"}`}>
            <div className="flex items-center justify-between gap-3">
                <span className="eyebrow">{DIMENSION_TITLES[dimensionKey] ?? dimensionKey}</span>
                <ConfidenceBadge confidence={dimension.confidence} />
            </div>

            <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5">
                <FlagChip flag={dimension.flag} isAccess={isAccess} />
                {dimension.freshness && (
                    <FreshnessPill freshness={dimension.freshness} nextUpdate={freshnessNextUpdate} />
                )}
            </div>

            <p className="mt-2 text-sm leading-relaxed text-text-muted">{dimension.reason}</p>

            <SourceExpander inputs={dimension.inputs} fields={fields} />
        </section>
    );
}
