// ---------------------------------------------------------------------------
// Issuer & structure (spec §5.4)
// ---------------------------------------------------------------------------
// What legal wrapper holds the asset, and what protections come with it? The
// wrapper is usually LLM-extracted, so this dimension is typically `auto` - and
// labeled as such. That is honest, not a weakness.
// ---------------------------------------------------------------------------

import type { DimensionAssessment, FieldMap, WrapperType } from "@/lib/contracts";
import { finalize, read, usable } from "@/lib/computation/util";

const INPUTS = ["wrapper_type", "custodian", "issuer_domicile"] as const;

export function assessStructure(fields: FieldMap): DimensionAssessment {
    const wrapper = usable(read<string>(fields, "wrapper_type"));
    const custodian = usable(read<string>(fields, "custodian"));
    const domicile = usable(read<string>(fields, "issuer_domicile"));

    if (!wrapper) {
        return finalize("unknown", "The legal structure could not be determined.", [...INPUTS], []);
    }

    const used = [wrapper, custodian, domicile].filter(Boolean) as never[];
    const value = wrapper.value as WrapperType;
    const custodianText = custodian?.value ? ` Custodian: ${custodian.value}.` : "";

    switch (value) {
        case "registered_fund_40act":
        case "registered_fund_other":
            return finalize(
                "green",
                `Registered fund structure with investor protections.${custodianText}`,
                [...INPUTS],
                used,
            );
        case "private_fund":
        case "spv":
            return finalize(
                "amber",
                `Private fund/SPV structure; fewer retail protections than a registered fund.${custodianText}`,
                [...INPUTS],
                used,
            );
        case "mirror_token":
            return finalize(
                "red",
                "Mirror token: exposure may be synthetic rather than a direct claim on the underlying.",
                [...INPUTS],
                used,
            );
        case "unbacked":
            return finalize(
                "red",
                "Token is not backed by an underlying real-world asset.",
                [...INPUTS],
                used,
            );
        default:
            return finalize("unknown", "The legal structure could not be determined.", [...INPUTS], []);
    }
}
