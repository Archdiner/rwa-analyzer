// ---------------------------------------------------------------------------
// Reliability computation (Module 2)
// ---------------------------------------------------------------------------
// NormalizedAssetRecord (Contract A) -> Assessment (Contract B). Pure,
// deterministic, no LLM, no composite grade. overall_confidence is the lowest
// dimension confidence used — a tier label, never a risk score.
// ---------------------------------------------------------------------------

import {
    minConfidence,
    type Assessment,
    type NormalizedAssetRecord,
} from "@/lib/contracts";
import { assessBacking } from "@/lib/computation/backing";
import { assessRedemption } from "@/lib/computation/redemption";
import { assessAccess } from "@/lib/computation/access";
import { assessStructure } from "@/lib/computation/structure";

export function computeAssessment(record: NormalizedAssetRecord): Assessment {
    const dimensions = {
        backing: assessBacking(record.fields),
        redemption: assessRedemption(record.fields),
        access: assessAccess(record.fields),
        structure: assessStructure(record.fields),
    };

    // Lowest confidence among dimensions actually assessed. An `unknown`
    // dimension (missing inputs) is not a "dimension used" and is excluded; if
    // nothing could be assessed at all, the asset is Unverifiable.
    const assessed = Object.values(dimensions).filter((d) => d.flag !== "unknown");
    const overall_confidence = assessed.length
        ? minConfidence(...assessed.map((d) => d.confidence))
        : "unverifiable";

    return {
        asset_id: record.asset_id,
        overall_confidence,
        dimensions,
        computed_at: new Date().toISOString(),
    };
}

export { assessBacking, assessRedemption, assessAccess, assessStructure };
