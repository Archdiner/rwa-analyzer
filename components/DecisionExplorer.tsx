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
            <span className="mb-1.5 block text-xs uppercase tracking-wide text-text-faint">{label}</span>
            <select
                value={value}
                onChange={(e) => onChange(e.target.value as T)}
                className="w-full rounded-xl border border-border bg-[color:var(--bg-elev)] px-3 py-3 text-sm text-text focus:border-[color:var(--verified)] focus:outline-none"
            >
                {options.map((o) => (
                    <option key={o.id} value={o.id}>
                        {o.label}
                    </option>
                ))}
            </select>
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
            <div className="flex flex-col gap-3 sm:flex-row">
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
                <div className="flex items-baseline justify-between">
                    <h2 className="text-sm font-medium text-text">
                        {reachable.length} option{reachable.length === 1 ? "" : "s"} you can actually reach
                    </h2>
                    <span className="text-[11px] text-text-faint">ranked by safety, then yield</span>
                </div>

                {reachable.length === 0 ? (
                    <p className="mt-4 rounded-xl border border-border bg-[color:var(--bg-elev)] p-4 text-sm text-text-muted">
                        Nothing in the current set is reachable from that profile. That&apos;s an honest result, not a
                        bug — the tappable menu for some profiles is genuinely thin. Try a different location or amount.
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
                <div className="mt-8">
                    <h2 className="text-sm font-medium text-text-faint">Closed to you</h2>
                    <ul className="mt-3 space-y-2">
                        {closed.map((item) => (
                            <ClosedRow key={item.asset.asset_id} item={item} />
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
}
