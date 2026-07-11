/* Beat 2 — "a color is not a proof."
   The false binary: green / red / nothing. Type-only, no canvas. */

import Blueprint from "../chrome/Blueprint";

const COLS = [
    {
        k: "GREEN",
        body: "Implies a proof that, most of the time, was never actually published anywhere you can read.",
    },
    {
        k: "RED",
        body: "Punishes an asset for being private, not for being fraudulent. Unproven is not the same as unsafe.",
    },
    {
        k: "NOTHING",
        body: "Most tools skip backing altogether and just show you a big number: the yield.",
    },
];

export default function FalseBinary() {
    return (
        <div className="border-y border-border bg-bg py-24 sm:py-32">
            <Blueprint
                section="02"
                label="§ THE PROBLEM"
                tag="A COLOR IS NOT A PROOF"
                grid={false}
                className="mx-auto w-full max-w-6xl px-6 pt-16 sm:px-8"
            >
                <h2 className="font-display max-w-4xl text-[clamp(2.3rem,5vw,4rem)] leading-[1.02] text-text">
                    Everyone else hands you a color. Green, red, or nothing at all.
                </h2>

                <div className="mt-16 grid gap-px border-t border-border sm:grid-cols-3">
                    {COLS.map((c, i) => (
                        <div
                            key={c.k}
                            className={`flex flex-col gap-4 py-7 sm:pr-8 ${
                                i > 0 ? "sm:border-l sm:border-border sm:pl-8" : ""
                            }`}
                        >
                            <span className="label text-text">{c.k}</span>
                            <p className="max-w-xs text-lg leading-snug text-text-muted">{c.body}</p>
                        </div>
                    ))}
                </div>

                <div className="mt-16 flex flex-col gap-4 sm:flex-row sm:items-baseline sm:gap-6">
                    <span className="label shrink-0 text-text-faint">THE GAP</span>
                    <p className="font-display max-w-3xl text-[clamp(1.5rem,3vw,2.1rem)] italic leading-[1.28] text-text">
                        None of them tell you the one thing that matters: where the proof actually stops.
                    </p>
                </div>
            </Blueprint>
        </div>
    );
}
