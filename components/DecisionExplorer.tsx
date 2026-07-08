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

function Select<T extends string>({
    label,
    value,
    onChange,
    options,
}: {
    label: string;
    value: T;
    onChange: (v: T) => void;
    options: { id: T; label: string }[];
}) {
    return (
        <label className="flex-1">
            <span className="eyebrow mb-2 block">{label}</span>
            <div className="relative">
                <select
                    value={value}
                    onChange={(e) => onChange(e.target.value as T)}
                    className="field w-full cursor-pointer appearance-none px-3 py-2.5 pr-9 text-sm text-text"
                >
                    {options.map((o) => (
                        <option key={o.id} value={o.id}>
                            {o.label}
                        </option>
                    ))}
                </select>
                <svg
                    className="pointer-events-none absolute right-3 top-1/2 h-3 w-3 -translate-y-1/2 text-text-faint"
                    viewBox="0 0 12 12"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    aria-hidden
                >
                    <path d="M2.5 4.5L6 8l3.5-3.5" />
                </svg>
            </div>
        </label>
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
        <div>
            <div className="flex flex-col gap-4 rounded-[3px] border border-border bg-bg-elev-2 p-4 sm:flex-row">
                <Select
                    label="Where are you"
                    value={jurisdiction}
                    onChange={setJurisdiction}
                    options={USER_JURISDICTIONS}
                />
                <Select
                    label="How much"
                    value={amount}
                    onChange={setAmount}
                    options={AMOUNT_BANDS.map((b) => ({ id: b.id, label: b.label }))}
                />
            </div>

            <div className="mt-8">
                <div className="flex items-baseline justify-between border-b border-border pb-2">
                    <h3 className="text-sm font-semibold text-text">
                        {reachable.length} option{reachable.length === 1 ? "" : "s"} you can reach
                    </h3>
                    <span className="eyebrow">Ranked by safety, then yield</span>
                </div>

                {reachable.length === 0 ? (
                    <p className="mt-4 rounded-[3px] border border-border bg-bg-elev p-4 text-sm text-text-muted">
                        No assets in the current set match that profile. Try a different location or amount band.
                    </p>
                ) : (
                    <ul className="mt-4 space-y-3">
                        {reachable.map((item) => (
                            <ReachableRow key={item.asset.asset_id} item={item} />
                        ))}
                    </ul>
                )}
            </div>

            {closed.length > 0 && (
                <div className="mt-10">
                    <div className="flex items-baseline justify-between border-b border-border pb-2">
                        <h3 className="text-sm font-semibold text-text-faint">Closed to you</h3>
                        <span className="eyebrow">Eligibility, not risk</span>
                    </div>
                    <ul className="mt-4 space-y-2">
                        {closed.map((item) => (
                            <ClosedRow key={item.asset.asset_id} item={item} />
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
}
