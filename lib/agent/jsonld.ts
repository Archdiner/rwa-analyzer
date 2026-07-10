// ---------------------------------------------------------------------------
// Schema.org JSON-LD for an asset verdict page
// ---------------------------------------------------------------------------
// Emits a minimal, valid structured-data block so agents extract the verdict
// facts (tier / confidence / freshness) rather than guessing from prose. Pure
// and rendering-free so it is unit-testable without a React tree.
// ---------------------------------------------------------------------------

import type { Assessment, NormalizedAssetRecord } from "@/lib/contracts";

export function assetJsonLd(
    record: NormalizedAssetRecord,
    assessment: Assessment,
    url: string,
): Record<string, unknown> {
    const id = record.identifiers;
    const backing = assessment.dimensions.backing;

    const additionalProperty: Array<Record<string, string>> = [];
    if (backing) {
        additionalProperty.push({ "@type": "PropertyValue", name: "backing_tier", value: backing.flag });
        additionalProperty.push({ "@type": "PropertyValue", name: "backing_confidence", value: backing.confidence });
        if (backing.freshness) {
            additionalProperty.push({ "@type": "PropertyValue", name: "backing_freshness", value: backing.freshness });
        }
    }

    const jsonld: Record<string, unknown> = {
        "@context": "https://schema.org",
        "@type": "FinancialProduct",
        name: id.name,
        identifier: id.symbol,
        url,
        dateModified: assessment.computed_at,
        additionalProperty,
    };

    // Omit the field entirely when unknown - never emit a null/empty issuer.
    if (id.issuer_name) {
        jsonld.provider = { "@type": "Organization", name: id.issuer_name };
    }

    return jsonld;
}
