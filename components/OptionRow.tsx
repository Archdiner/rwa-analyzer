import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import type { Flag } from "@/lib/contracts";
import type { AssetSummary, ReachableAsset, ClosedAsset } from "@/lib/decision";
import { REDEMPTION_LABELS, safetyHeadline, yieldKindLabel, asOfShort } from "@/lib/display";
import FlagChip from "@/components/FlagChip";

const FLAG_EDGE: Record<Flag, string> = {
    green: "var(--green)",
    amber: "var(--amber)",
    red: "var(--red)",
    unknown: "var(--unknown)",
};

function Yield({ asset }: { asset: AssetSummary }) {
    const stamp = asOfShort(asset.yield_as_of);
    return (
        <div className="shrink-0 text-right">
            <div className="font-mono text-2xl font-medium tracking-tight text-text">
                {asset.yield_apy != null ? `${asset.yield_apy.toFixed(2)}%` : "—"}
            </div>
            <div className="eyebrow mt-0.5">{yieldKindLabel(asset.yield_kind)}</div>
            {asset.yield_apy != null && stamp && (
                <div className="mt-0.5 text-[10px] text-text-faint">as of {stamp}</div>
            )}
        </div>
    );
}

/** A reachable option. Safety leads (colored edge + flag), yield is weighed against it. */
export function ReachableRow({ item }: { item: ReachableAsset }) {
    const { asset, caveats } = item;
    return (
        <li
            className="panel-link overflow-hidden"
            style={{ borderLeftWidth: 3, borderLeftColor: FLAG_EDGE[asset.backing_flag] }}
        >
            <div className="p-4 sm:p-5">
                <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                        <div className="flex items-center gap-2.5">
                            <FlagChip flag={asset.backing_flag} />
                            <span className="font-mono text-sm font-semibold text-text">{asset.symbol}</span>
                            <span className="truncate text-xs text-text-faint">{asset.name}</span>
                        </div>
                        <p className="mt-2 text-sm text-text">{safetyHeadline(asset.backing_flag)}.</p>
                    </div>
                    <Yield asset={asset} />
                </div>

                {asset.trust_boundary && (
                    <div className="mt-3.5 border-l-2 border-border pl-3">
                        <p className="eyebrow">Trust boundary</p>
                        <p className="mt-1 text-[13px] leading-relaxed text-text-muted">{asset.trust_boundary}</p>
                    </div>
                )}

                {caveats.length > 0 && (
                    <ul className="mt-3 space-y-1">
                        {caveats.map((c) => (
                            <li key={c} className="text-xs text-amber">
                                {c}
                            </li>
                        ))}
                    </ul>
                )}

                <div className="mt-4 flex items-center justify-between border-t border-border pt-3 text-sm">
                    <span className="text-xs text-text-faint">
                        {asset.redemption_speed ? REDEMPTION_LABELS[asset.redemption_speed] : "Exit speed unknown"}
                    </span>
                    <div className="flex items-center gap-5">
                        <Link
                            href={`/a/${encodeURIComponent(asset.asset_id)}`}
                            className="font-medium text-primary hover:underline"
                        >
                            Full read →
                        </Link>
                        {asset.provider_url && (
                            <a
                                href={asset.provider_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-text-muted transition-colors hover:text-text"
                            >
                                Deposit <ArrowUpRight className="h-3.5 w-3.5" />
                            </a>
                        )}
                    </div>
                </div>
            </div>
        </li>
    );
}

/** An option out of reach — quiet, with the single plain reason why. */
export function ClosedRow({ item }: { item: ClosedAsset }) {
    const { asset, reason } = item;
    return (
        <li className="flex items-center justify-between gap-4 rounded-[3px] border border-border bg-bg-elev-2 px-4 py-3">
            <div className="min-w-0">
                <div className="flex items-center gap-2">
                    <span className="font-mono text-sm text-text-muted">{asset.symbol}</span>
                    <span className="truncate text-xs text-text-faint">{asset.name}</span>
                </div>
                <p className="mt-1 text-xs text-text-faint">{reason}</p>
            </div>
            <div className="flex shrink-0 items-center gap-4">
                <span className="font-mono text-sm text-text-faint">
                    {asset.yield_apy != null ? `${asset.yield_apy.toFixed(2)}%` : "—"}
                </span>
                <Link
                    href={`/a/${encodeURIComponent(asset.asset_id)}`}
                    className="text-xs text-text-faint transition-colors hover:text-primary"
                >
                    Why →
                </Link>
            </div>
        </li>
    );
}
