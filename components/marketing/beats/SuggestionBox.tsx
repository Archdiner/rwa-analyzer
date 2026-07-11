/* Beat 7b — "the open box."
   Embeds the real suggestion form (posts to /api/features/submit) beside a view
   of how suggestions cluster into ranked directions. The directions shown are a
   curated illustration — live demand is maintainer-gated. */

import RequestForm from "@/components/features/RequestForm";
import Blueprint from "../chrome/Blueprint";

const DIRECTIONS = [
    { label: "Cover more tokenized T-bill funds", signals: 24 },
    { label: "Verify staking-derivative backing", signals: 17 },
    { label: "Attestation freshness alerts", signals: 11 },
    { label: "Lending-market collateral proofs", signals: 9 },
];

export default function SuggestionBox() {
    const max = DIRECTIONS[0].signals;
    return (
        <div className="border-t border-border bg-bg py-24 sm:py-32">
            <Blueprint
                section="09"
                label="§ THE OPEN BOX"
                tag="COMMUNITY-DRAWN FRONTIER"
                grid={false}
                className="mx-auto w-full max-w-6xl px-6 pt-16 sm:px-8"
            >
                <h2 className="font-display max-w-2xl text-[clamp(2.1rem,4.4vw,3.4rem)] leading-[1.03] text-text">
                    Tell it what to verify next.
                </h2>
                <p className="mt-6 max-w-xl text-[15px] leading-relaxed text-text-muted">
                    This is open. Every suggestion gets read, embedded, and clustered by meaning &mdash; and the
                    clusters become the directions the product actually moves. Nothing is too big.
                </p>

                <div className="mt-14 grid gap-10 lg:grid-cols-2">
                    {/* the box */}
                    <div>
                        <p className="label mb-4 text-text-faint">DROP A SUGGESTION</p>
                        <RequestForm />
                    </div>

                    {/* the directions it clusters into */}
                    <div className="flex flex-col">
                        <p className="label mb-4 text-text-faint">EMERGENT DIRECTIONS</p>
                        <div className="flex flex-col gap-px border border-text/12 bg-[#0a0a0b]/60">
                            {DIRECTIONS.map((d, i) => (
                                <div key={d.label} className="flex flex-col gap-2 p-4">
                                    <div className="flex items-baseline justify-between gap-4">
                                        <span className="font-mono text-[13px] text-text">
                                            <span className="mr-3 text-text-faint">{String(i + 1).padStart(2, "0")}</span>
                                            {d.label}
                                        </span>
                                        <span className="shrink-0 font-mono text-[11px] tracking-[0.08em] text-signal">
                                            {d.signals} signals
                                        </span>
                                    </div>
                                    <div className="h-px w-full bg-text/10">
                                        <div
                                            className="h-px bg-signal/70"
                                            style={{ width: `${(d.signals / max) * 100}%` }}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                        <p className="coordinate mt-4">
                            Ranked by backing count · synthesized from clustered suggestions
                        </p>
                    </div>
                </div>
            </Blueprint>
        </div>
    );
}
