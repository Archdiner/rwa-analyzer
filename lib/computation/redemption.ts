// ---------------------------------------------------------------------------
// Redemption & liquidity (spec §5.2)
// ---------------------------------------------------------------------------
// How quickly can a holder exit at NAV? (Secondary-market depth is v2.)
// ---------------------------------------------------------------------------

import type { DimensionAssessment, FieldMap, RedemptionSpeed } from "@/lib/contracts";
import { finalize, read, usable } from "@/lib/computation/util";

const INPUTS = ["redemption_speed", "redemption_cap"] as const;

function prettyCap(raw?: string): string | null {
    if (!raw) return null;
    // Machine strings like "50000000_per_24h" -> "$50M per 24h".
    const m = raw.match(/^(\d+)_per_(\d+)([a-z]+)$/i);
    if (m) {
        const amount = Number(m[1]);
        const compact =
            amount >= 1_000_000 ? `$${amount / 1_000_000}M` : amount >= 1_000 ? `$${amount / 1_000}K` : `$${amount}`;
        return `${compact} per ${m[2]}${m[3]}`;
    }
    return raw;
}

export function assessRedemption(fields: FieldMap): DimensionAssessment {
    const speed = usable(read<string>(fields, "redemption_speed"));
    const cap = usable(read<string>(fields, "redemption_cap"));

    if (!speed) {
        return finalize("unknown", "Redemption terms could not be determined.", [...INPUTS], []);
    }

    const used = [speed, cap].filter(Boolean) as never[];
    const value = speed.value as RedemptionSpeed;
    const capText = prettyCap(cap?.value);

    switch (value) {
        case "instant":
            return finalize("green", "Redeemable on demand.", [...INPUTS], [speed] as never[]);
        case "instant_capped":
            return finalize(
                "amber",
                `Instant redemption but capped${capText ? ` at ${capText}` : ""}; exit may be delayed under stress.`,
                [...INPUTS],
                used,
            );
        case "daily":
            return finalize(
                "amber",
                "Redemptions are processed daily; exit may be delayed under stress.",
                [...INPUTS],
                [speed] as never[],
            );
        case "t_plus_n":
            return finalize(
                "amber",
                "Redemptions settle after a fixed delay; funds are not instantly available.",
                [...INPUTS],
                [speed] as never[],
            );
        case "none":
            return finalize(
                "red",
                "No redemption mechanism; exit only via the secondary market.",
                [...INPUTS],
                [speed] as never[],
            );
        default:
            return finalize("unknown", "Redemption terms could not be determined.", [...INPUTS], []);
    }
}
