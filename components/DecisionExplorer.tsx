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
            <div className="flex items-baseline justify-between">
                <span className="text-sm font-medium text-text">{label}</span>
                <span className="text-[11px] text-text-faint">{hint}</span>
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
                            className={`rounded-full px-3.5 py-2 text-[13px] transition-colors ${
                                active
                                    ? "border border-primary/60 bg-primary/10 text-text"
                                    : "border border-border text-text-muted hover:border-border-strong hover:text-text"
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

export default function DecisionExplorer({ universe }: { universe: AssetSummary[] }) {
    const [jurisdiction, setJurisdiction] = useState<UserJurisdiction>("us_retail");
    const [amount, setAmount] = useState<AmountBand>("1k_10k");

    const { reachable, closed } = useMemo(
        () => decide(universe, { jurisdiction, amount }),
        [universe, jurisdiction, amount],
    );

    return (
        <div className="grid gap-8 lg:grid-cols-[320px_1fr] lg:gap-10">
            {/* Controls */}
            <div className="lg:sticky lg:top-24 lg:self-start">
                <div className="panel space-y-7 p-6">
                    <Segmented
                        label="Where are you"
                        hint="jurisdiction"
                        value={jurisdiction}
                        onChange={setJurisdiction}
                        options={USER_JURISDICTIONS}
                    />
                    <div className="h-px bg-border" />
                    <Segmented
                        label="How much"
                        hint="amount"
                        value={amount}
                        onChange={setAmount}
                        options={AMOUNT_BANDS.map((b) => ({ id: b.id, label: b.label }))}
                    />
                </div>
                <p className="mt-4 px-1 text-[12px] leading-relaxed text-text-faint">
                    Ranked safety first: backing you can verify comes before higher yield you cannot.
                </p>
            </div>

            {/* Results */}
            <div>
                <div className="flex items-baseline justify-between px-1">
                    <h3 className="text-sm font-medium text-text">
                        What you can reach{" "}
                        <span className="text-text-faint">({reachable.length})</span>
                    </h3>
                </div>

                {reachable.length === 0 ? (
                    <div className="panel mt-4 p-8 text-center">
                        <p className="text-sm text-text-muted">
                            Nothing here matches that profile. Try a different amount or location.
                        </p>
                    </div>
                ) : (
                    <div className="panel mt-4 divide-y divide-border overflow-hidden">
                        {reachable.map((item) => (
                            <ReachableRow key={item.asset.asset_id} item={item} />
                        ))}
                    </div>
                )}

                {closed.length > 0 && (
                    <div className="mt-10">
                        <div className="flex items-baseline justify-between px-1">
                            <h3 className="text-sm font-medium text-text-muted">
                                Out of reach here{" "}
                                <span className="text-text-faint">({closed.length})</span>
                            </h3>
                        </div>
                        <div className="panel mt-4 divide-y divide-border overflow-hidden opacity-90">
                            {closed.map((item) => (
                                <ClosedRow key={item.asset.asset_id} item={item} />
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
