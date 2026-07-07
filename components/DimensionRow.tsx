import type { DimensionAssessment, FieldMap } from "@/lib/contracts";
import { DIMENSION_TITLES } from "@/lib/display";
import FlagChip from "@/components/FlagChip";
import ConfidenceBadge from "@/components/ConfidenceBadge";
import SourceExpander from "@/components/SourceExpander";

export default function DimensionRow({
    dimensionKey,
    dimension,
    fields,
    noBorder = false,
}: {
    dimensionKey: string;
    dimension: DimensionAssessment;
    fields: FieldMap;
    noBorder?: boolean;
}) {
    const isAccess = dimensionKey === "access";

    return (
        <section className={`py-5 ${noBorder ? "" : "border-t border-border first:border-t-0"}`}>
            <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                    <div className="flex items-center gap-2.5">
                        <FlagChip flag={dimension.flag} isAccess={isAccess} />
                        <h3 className="text-sm font-medium text-text">{DIMENSION_TITLES[dimensionKey] ?? dimensionKey}</h3>
                    </div>
                    <p className="mt-2 text-sm leading-relaxed text-text-muted">{dimension.reason}</p>
                </div>
                <ConfidenceBadge confidence={dimension.confidence} size="md" />
            </div>
            <div className="mt-3">
                <SourceExpander inputs={dimension.inputs} fields={fields} />
            </div>
        </section>
    );
}
