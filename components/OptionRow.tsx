import Link from "next/link";
import { ExternalLink, Lock } from "lucide-react";
import type { Flag } from "@/lib/contracts";
import type { AssetSummary, ReachableAsset, ClosedAsset } from "@/lib/decision";
import { REDEMPTION_LABELS, safetyHeadline, yieldKindLabel, asOfShort } from "@/lib/display";
import FlagChip from "@/components/FlagChip";

const FLAG_BORDER: Record<Flag, string> = {
    green: "var(--green)",
    amber: "var(--amber)",
    red: "var(--red)",
    unknown: "var(--unknown)",
};

function Yield({ asset }: { asset: AssetSummary }) {
    const stamp = asOfShort(asset.yield_as_of);
    return (
        <div className="text-right shrink-0">
            <div className="font-mono text-lg text-text">
                {asset.yield_apy != null ? `${asset.yield_apy.toFixed(2)}%` : "—"}
            </div>
            <div className="text-[10px] uppercase tracking-wide text-text-faint">
                {yieldKindLabel(asset.yield_kind)}
            </div>
            {asset.yield_apy != null && stamp && (
                <div className="text-[10px] text-text-faint">as of {stamp}</div>
            )}
        </div>
    );
}

/** A reachable option. Safety leads (colored edge + flag), yield is weighed against it. */
export function ReachableRow({ item }: { item: ReachableAsset }) {
    const { asset, caveats } = item;
    return (
        <li
            className="rounded-xl border border-border bg-[color:var(--bg-elev)] p-4"
            style={{ borderLeftWidth: 3, borderLeftColor: FLAG_BORDER[asset.backing_flag] }}
        >
            <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                    <div className="flex items-center gap-2.5">
                        <FlagChip flag={asset.backing_flag} />
                        <span className="font-mono text-sm text-text">{asset.symbol}</span>
                        <span className="truncate text-xs text-text-faint">{asset.name}</span>
                    </div>
                    <p className="mt-2 text-sm text-text-muted">{safetyHeadline(asset.backing_flag)}.</p>
                </div>
                <Yield asset={asset} />
            </div>

            {asset.trust_boundary && (
                <div className="mt-2.5 flex items-start gap-1.5 border-l-2 border-[color:var(--gate-bg)] pl-2.5">
                    <span className="shrink-0 text-[10px] font-medium uppercase tracking-wide text-text-faint">
                        Trust boundary
                    </span>
                    <p className="text-[11px] leading-relaxed text-text-muted">{asset.trust_boundary}</p>
                </div>
            )}

            {caveats.length > 0 && (
                <ul className="mt-2 space-y-0.5">
                    {caveats.map((c) => (
                        <li key={c} className="text-[11px] text-amber">
                            {c}
                        </li>
                    ))}
                </ul>
            )}

            <div className="mt-3 flex items-center justify-between text-xs">
                <span className="text-text-faint">
                    {asset.redemption_speed ? REDEMPTION_LABELS[asset.redemption_speed] : "Exit speed unknown"}
                </span>
                <div className="flex items-center gap-4">
                    <Link
                        href={`/a/${encodeURIComponent(asset.asset_id)}`}
                        className="text-verified hover:underline"
                    >
                        Full read →
                    </Link>
                    {asset.provider_url && (
                        <a
                            href={asset.provider_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-text-muted hover:text-text"
                        >
                            Deposit at provider <ExternalLink className="h-3 w-3" />
                        </a>
                    )}
                </div>
            </div>
        </li>
    );
}

/** An option out of reach — greyed, with the single plain reason why. */
export function ClosedRow({ item }: { item: ClosedAsset }) {
    const { asset, reason } = item;
    return (
        <li className="rounded-xl border border-border bg-[color:var(--bg-elev-2)] px-4 py-3 opacity-70">
            <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                    <div className="flex items-center gap-2">
                        <Lock className="h-3.5 w-3.5 text-text-faint shrink-0" />
                        <span className="font-mono text-sm text-text-muted">{asset.symbol}</span>
                        <span className="truncate text-xs text-text-faint">{asset.name}</span>
                    </div>
                    <p className="mt-1 text-xs text-text-faint">{reason}</p>
                </div>
                <div className="text-right shrink-0">
                    <div className="font-mono text-sm text-text-faint">
                        {asset.yield_apy != null ? `${asset.yield_apy.toFixed(2)}%` : "—"}
                    </div>
                    <Link
                        href={`/a/${encodeURIComponent(asset.asset_id)}`}
                        className="text-[11px] text-text-faint hover:text-text hover:underline"
                    >
                        why →
                    </Link>
                </div>
            </div>
        </li>
    );
}
