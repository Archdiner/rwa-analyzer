// ---------------------------------------------------------------------------
// Backing & verification (spec §5.1)
// ---------------------------------------------------------------------------
// Does the token's reserve actually back its supply, and how is that proven?
// The self-reported-vs-attested distinction is the product's edge. NAV is never
// assumed: a missing nav yields `unknown`, not a false green off a hardcoded 1.
// ---------------------------------------------------------------------------

import type { DimensionAssessment, FieldMap, ReservesMethod } from "@/lib/contracts";
import { finalize, read, usable, downgradeFlag, shortDate } from "@/lib/computation/util";

const BACKING_TOLERANCE = 0.05; // 5% supply-vs-reserve divergence tolerance
const FRESH_WINDOW_MS = 3 * 24 * 60 * 60 * 1000; // 3 days

const INPUTS = ["supply", "nav", "reserves_value", "reserves_method"] as const;

export function assessBacking(fields: FieldMap): DimensionAssessment {
    const supply = usable(read<number>(fields, "supply"));
    const nav = usable(read<number>(fields, "nav"));
    const reserves = usable(read<number>(fields, "reserves_value"));
    const method = usable(read<string>(fields, "reserves_method"));
    const auditor = usable(read<string>(fields, "auditor"));

    // NAV and supply are prerequisites for any reconciliation.
    if (!supply || !nav) {
        return finalize(
            "unknown",
            "Net asset value or supply is unavailable, so backing cannot be assessed.",
            [...INPUTS],
            [supply, nav].filter(Boolean) as never[],
        );
    }

    const methodValue = (method?.value as ReservesMethod | undefined) ?? "none";

    if (!reserves || methodValue === "none") {
        return finalize(
            "red",
            "No verifiable reserve data; backing cannot be confirmed.",
            [...INPUTS],
            [supply, nav].filter(Boolean) as never[],
        );
    }

    const used = [supply, nav, reserves, method].filter(Boolean) as never[];
    const expected = supply.value * nav.value;
    const delta = expected === 0 ? 1 : Math.abs(reserves.value - expected) / expected;
    const deltaPct = `${(delta * 100).toFixed(1)}%`;

    if (delta > BACKING_TOLERANCE) {
        return finalize(
            "red",
            `Reported reserves diverge from on-chain value by ${deltaPct}.`,
            [...INPUTS],
            used,
        );
    }

    let flag: "green" | "amber" | "red";
    let reason: string;

    if (methodValue === "auditor_attested") {
        const by = auditor?.value ? ` by ${auditor.value}` : "";
        flag = "green";
        reason = `Fully backed; reserves independently attested${by}. On-chain value reconciles within ${deltaPct}.`;
    } else if (methodValue === "self_reported") {
        flag = "amber";
        reason = "Appears backed, but reserves are self-reported by the issuer, not independently verified.";
    } else {
        // "unknown" — a feed we read but have not classified.
        flag = "amber";
        reason = `Appears backed (reconciles within ${deltaPct}), but the reserve verification method is unconfirmed.`;
    }

    // Staleness downgrade.
    const asOf = reserves.as_of;
    const stale = Date.now() - new Date(asOf).getTime() > FRESH_WINDOW_MS;
    if (stale) {
        flag = downgradeFlag(flag) as typeof flag;
        reason += ` Reserve data is stale (last updated ${shortDate(asOf)}).`;
    }

    return finalize(flag, reason, [...INPUTS], used);
}
