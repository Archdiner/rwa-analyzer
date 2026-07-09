"use client";

import { useMemo, useState } from "react";
import {
    decide,
    AMOUNT_BANDS,
    USER_JURISDICTIONS,
    type AmountBand,
    type AssetSummary,
    type UserJurisdiction,
} from "@/lib/decision";
import { ReachableRow, ClosedRow } from "@/components/OptionRow";

function Segmented<T extends string>({
    label,
    hint,
    value,
    onChange,
    options,
}: {
    label: string;
    hint: string;
    value: T;
    onChange: (v: T) => void;
    options: { id: T; label: string }[];
}) {
    return (
        <div>
            <div className="flex items-baseline justify-between gap-3">
                <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-white/45">{label}</span>
                <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-white/25">{hint}</span>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
                {options.map((o) => {
                    const active = value === o.id;
                    return (
                        <button
                            key={o.id}
                            type="button"
                            onClick={() => onChange(o.id)}
                            aria-pressed={active}
                            className={`border px-3 py-2 font-mono text-[12px] transition-colors ${
                                active
                                    ? "border-white/35 bg-white/[0.06] text-text"
                                    : "border-white/12 text-text-muted hover:border-white/25 hover:text-text"
                            }`}
                        >
                            {o.label}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

function Board({
    children,
    fig,
    className = "",
}: {
    children: React.ReactNode;
    fig?: string;
    className?: string;
}) {
    return (
        <div className={`relative border border-white/12 bg-[#050505]/70 ${className}`}>
            <span className="pointer-events-none absolute -left-px -top-px h-2.5 w-2.5 border-l border-t border-white/35" />
            <span className="pointer-events-none absolute -right-px -top-px h-2.5 w-2.5 border-r border-t border-white/35" />
            <span className="pointer-events-none absolute -bottom-px -left-px h-2.5 w-2.5 border-b border-l border-white/35" />
            <span className="pointer-events-none absolute -bottom-px -right-px h-2.5 w-2.5 border-b border-r border-white/35" />
            {fig && (
                <div className="flex items-center justify-between gap-3 border-b border-white/10 px-5 py-3">
                    <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/35">{fig}</span>
                    <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-white/25">filter</span>
                </div>
            )}
            {children}
        </div>
    );
}

export default function DecisionExplorer({ universe }: { universe: AssetSummary[] }) {
    const [jurisdiction, setJurisdiction] = useState<UserJurisdiction>("us_retail");
    const [amount, setAmount] = useState<AmountBand>("1k_10k");

    const { reachable, closed } = useMemo(
        () => decide(universe, { jurisdiction, amount }),
        [universe, jurisdiction, amount],
    );

    return (
        <div className="grid gap-8 lg:grid-cols-[300px_1fr] lg:gap-10">
            <div className="lg:sticky lg:top-24 lg:self-start">
                <Board fig="FIG. 07 · PROFILE" className="space-y-6 p-5 sm:p-6">
                    <Segmented
                        label="Where you are"
                        hint="eligibility"
                        value={jurisdiction}
                        onChange={setJurisdiction}
                        options={USER_JURISDICTIONS}
                    />
                    <div className="h-px bg-white/10" />
                    <Segmented
                        label="How much"
                        hint="size"
                        value={amount}
                        onChange={setAmount}
                        options={AMOUNT_BANDS.map((b) => ({ id: b.id, label: b.label }))}
                    />
                </Board>
                <p className="mt-4 px-1 text-[12px] leading-relaxed text-text-faint">
                    Verified backing sorts above higher APY you would have to take on trust.
                </p>
            </div>

            <div className="space-y-8">
                <Board>
                    <div className="flex items-center justify-between gap-3 border-b border-white/10 px-5 py-3">
                        <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/35">
                            Open to you
                        </span>
                        <span className="font-mono text-[10px] tabular-nums text-white/35">{reachable.length}</span>
                    </div>

                    {reachable.length === 0 ? (
                        <div className="px-5 py-10 text-center">
                            <p className="text-sm text-text-muted">
                                Nothing matches that profile. Change location or size.
                            </p>
                        </div>
                    ) : (
                        <div className="divide-y divide-white/10">
                            {reachable.map((item) => (
                                <ReachableRow key={item.asset.asset_id} item={item} />
                            ))}
                        </div>
                    )}
                </Board>

                {closed.length > 0 && (
                    <Board>
                        <div className="flex items-center justify-between gap-3 border-b border-white/10 px-5 py-3">
                            <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/35">
                                Blocked here
                            </span>
                            <span className="font-mono text-[10px] tabular-nums text-white/35">{closed.length}</span>
                        </div>
                        <div className="divide-y divide-white/10 opacity-90">
                            {closed.map((item) => (
                                <ClosedRow key={item.asset.asset_id} item={item} />
                            ))}
                        </div>
                    </Board>
                )}
            </div>
        </div>
    );
}
