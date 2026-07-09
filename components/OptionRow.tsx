import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import type { Flag } from "@/lib/contracts";
import type { AssetSummary, ReachableAsset, ClosedAsset } from "@/lib/decision";
import { REDEMPTION_LABELS, asOfShort, yieldKindLabel } from "@/lib/display";

/* Verdict word carries the only color, and only in a restrained shade. No dots,
   no spines, no pills - a quiet ledger that lets the type do the work. */
const VERDICT: Record<Flag, { label: string; className: string }> = {
    green: { label: "Backing verified", className: "text-green" },
    amber: { label: "Partly verified", className: "text-amber" },
    red: { label: "Does not reconcile", className: "text-red" },
    unknown: { label: "Not yet verifiable", className: "text-text-muted" },
};

function Yield({ asset }: { asset: AssetSummary }) {
    const stamp = asOfShort(asset.yield_as_of);
    return (
        <div className="text-right">
            <div className="font-mono text-lg tracking-tight text-text tabular-nums">
                {asset.yield_apy != null ? `${asset.yield_apy.toFixed(2)}%` : "-"}
            </div>
            <div className="mt-1 text-[11px] text-text-faint">
                {yieldKindLabel(asset.yield_kind)}
                {stamp ? ` · ${stamp}` : ""}
            </div>
        </div>
    );
}

/** A reachable option: a quiet, editorial ledger row. */
export function ReachableRow({ item }: { item: ReachableAsset }) {
    const { asset, caveats } = item;
    const verdict = VERDICT[asset.backing_flag];

    return (
        <Link
            href={`/a/${encodeURIComponent(asset.asset_id)}`}
            className="group flex items-start justify-between gap-6 px-5 py-5 transition-colors hover:bg-white/[0.03] sm:px-6"
        >
            <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-3">
                    <span className="font-mono text-sm font-semibold text-text">{asset.symbol}</span>
                    <span className="truncate text-sm text-text-muted">{asset.name}</span>
                </div>

                <div className={`mt-1.5 text-[13px] ${verdict.className}`}>{verdict.label}</div>

                {asset.trust_boundary && (
                    <p className="mt-2.5 max-w-xl text-[13px] leading-relaxed text-text-faint">
                        {asset.trust_boundary}
                    </p>
                )}

                {caveats.length > 0 && (
                    <div className="mt-3 space-y-1 border-l border-white/15 pl-3">
                        {caveats.map((c) => (
                            <p key={c} className="text-[12px] leading-relaxed text-text-faint">
                                {c}
                            </p>
                        ))}
                    </div>
                )}
            </div>

            <div className="flex shrink-0 items-start gap-5">
                <div className="text-right">
                    <Yield asset={asset} />
                    <div className="mt-2 text-[11px] text-text-faint">
                        {asset.redemption_speed ? REDEMPTION_LABELS[asset.redemption_speed] : "Exit speed unknown"}
                    </div>
                </div>
                <ArrowUpRight className="mt-1 h-4 w-4 text-text-faint transition-colors group-hover:text-primary" />
            </div>
        </Link>
    );
}

/** An option out of reach: one quiet line with the plain reason. */
export function ClosedRow({ item }: { item: ClosedAsset }) {
    const { asset, reason } = item;
    return (
        <Link
            href={`/a/${encodeURIComponent(asset.asset_id)}`}
            className="group flex items-center justify-between gap-4 px-5 py-4 transition-colors hover:bg-white/[0.03] sm:px-6"
        >
            <div className="flex min-w-0 items-baseline gap-3">
                <span className="font-mono text-sm text-text-muted">{asset.symbol}</span>
                <span className="truncate text-[13px] text-text-faint">{reason}</span>
            </div>
            <div className="flex shrink-0 items-center gap-5">
                <span className="font-mono text-[13px] text-text-faint tabular-nums">
                    {asset.yield_apy != null ? `${asset.yield_apy.toFixed(2)}%` : "-"}
                </span>
                <span className="text-[11px] text-text-faint transition-colors group-hover:text-text">Why</span>
            </div>
        </Link>
    );
}
