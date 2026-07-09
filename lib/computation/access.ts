// ---------------------------------------------------------------------------
// Access & eligibility (spec §5.3)
// ---------------------------------------------------------------------------
// "Can you even touch it?" A red here is an ELIGIBILITY restriction, not a
// danger signal - the reason wording makes that explicit so it doesn't muddy
// the risk read. The UI styles access-red distinctly from a backing/structure
// red.
// ---------------------------------------------------------------------------

import type { DimensionAssessment, FieldMap, Jurisdiction } from "@/lib/contracts";
import { finalize, read, usable, usd } from "@/lib/computation/util";

const INPUTS = ["jurisdiction", "min_investment_usd", "kyc_required"] as const;
const RETAIL_LOW_MIN = 1_000; // below this a us_retail asset is "green"

export function assessAccess(fields: FieldMap): DimensionAssessment {
    const jurisdiction = usable(read<string>(fields, "jurisdiction"));
    const minInv = usable(read<number>(fields, "min_investment_usd"));
    const kyc = usable(read<boolean>(fields, "kyc_required"));

    if (!jurisdiction && !minInv && !kyc) {
        return finalize("unknown", "Access and eligibility terms could not be determined.", [...INPUTS], []);
    }

    const used = [jurisdiction, minInv, kyc].filter(Boolean) as never[];
    const jur = jurisdiction?.value as Jurisdiction | undefined;
    const minText = minInv ? `${usd(minInv.value)} minimum` : null;
    const kycText = kyc?.value ? "KYC and whitelisting required" : null;

    const parts = (extra: string[]) => [extra, minText, kycText].flat().filter(Boolean).join("; ");

    switch (jur) {
        case "permissionless":
            return finalize(
                "green",
                "Open to anyone; self-custodial, no eligibility gating.",
                [...INPUTS],
                used,
            );
        case "us_retail": {
            const low = !minInv || minInv.value < RETAIL_LOW_MIN;
            return finalize(
                low ? "green" : "amber",
                `Open to US retail investors${minText ? `; ${minText}` : ""}${kycText ? `; ${kycText}` : ""}.`,
                [...INPUTS],
                used,
            );
        }
        case "non_us_only":
            return finalize(
                "amber",
                `Eligibility: restricted to non-US persons${kycText ? `; ${kycText}` : ""}.`,
                [...INPUTS],
                used,
            );
        case "eu_only":
            return finalize(
                "amber",
                `Eligibility: restricted to EU persons${kycText ? `; ${kycText}` : ""}.`,
                [...INPUTS],
                used,
            );
        case "us_accredited":
            return finalize(
                "red",
                `Eligibility restriction (not a risk warning): limited to US accredited investors${parts([]) ? `; ${parts([])}` : ""}.`,
                [...INPUTS],
                used,
            );
        case "us_qualified_purchaser":
            return finalize(
                "red",
                `Eligibility restriction (not a risk warning): limited to US qualified purchasers${parts([]) ? `; ${parts([])}` : ""}.`,
                [...INPUTS],
                used,
            );
        default: {
            // No jurisdiction, but we know something (min and/or KYC).
            if (kyc?.value || minInv) {
                return finalize(
                    "amber",
                    `Eligibility: ${parts([]) || "gated access"}.`,
                    [...INPUTS],
                    used,
                );
            }
            return finalize("unknown", "Access and eligibility terms could not be determined.", [...INPUTS], []);
        }
    }
}
