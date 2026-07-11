"use client";

/* Beat 5 — "three axes, never a grade."
   Two specimens. BENJI resolves out of the static into a verified card as it
   enters view; OUSG stays permanent noise — the honest "I cannot prove it." */

import { useRef } from "react";
import { useScroll, useTransform } from "framer-motion";
import AsciiField from "../ascii/AsciiField";
import Blueprint from "../chrome/Blueprint";
import { CornerTicks } from "../Instrument";

type Axis = { k: string; v: string; green?: boolean };

function VerdictPlate({
    symbol,
    name,
    fig,
    outcome,
    proven,
    axes,
    takeaway,
    detail,
    field,
}: {
    symbol: string;
    name: string;
    fig: string;
    outcome: string;
    proven: boolean;
    axes: Axis[];
    takeaway: string;
    detail: string;
    field: React.ReactNode;
}) {
    return (
        <div
            className={`relative flex flex-col border bg-[#0a0a0b]/70 ${
                proven ? "border-signal/40" : "border-text/12"
            }`}
        >
            <CornerTicks accent={proven} />
            {/* specimen field */}
            <div className="relative h-52 w-full overflow-hidden border-b border-text/10">
                {field}
                <div className="pointer-events-none absolute left-3 top-3 flex items-center gap-2">
                    <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-text-faint">{fig}</span>
                </div>
                <div
                    className={`pointer-events-none absolute right-3 top-3 font-mono text-[10px] uppercase tracking-[0.14em] ${
                        proven ? "text-signal" : "text-text-muted"
                    }`}
                >
                    {outcome}
                </div>
            </div>

            <div className="flex flex-1 flex-col p-6">
                <div className="flex items-baseline gap-3">
                    <span className="font-mono text-sm font-medium text-text">{symbol}</span>
                    <span className="truncate text-xs text-text-faint">{name}</span>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                    {axes.map((a) => (
                        <span
                            key={a.k}
                            className={`border px-2 py-1 font-mono text-[11px] tracking-[0.06em] ${
                                a.green ? "border-signal/50 text-signal" : "border-text/15 text-text-muted"
                            }`}
                        >
                            {a.k}={a.v}
                        </span>
                    ))}
                </div>

                <h3 className="font-display mt-6 text-2xl text-text">{takeaway}</h3>
                <p className="mt-3 flex-1 text-sm leading-relaxed text-text-muted">{detail}</p>

                <span
                    className={`mt-6 inline-flex items-center gap-1 font-mono text-[12px] uppercase tracking-[0.12em] ${
                        proven ? "text-signal" : "text-text-faint"
                    }`}
                >
                    Inspect {symbol} <span aria-hidden>→</span>
                </span>
            </div>
        </div>
    );
}

export default function SpecimenPair() {
    const sectionRef = useRef<HTMLDivElement>(null);
    const { scrollYProgress } = useScroll({
        target: sectionRef,
        offset: ["start 0.85", "center 0.4"],
    });
    // BENJI resolves out of the static as the section enters view.
    const benjiResolve = useTransform(scrollYProgress, [0, 1], [0.05, 1]);

    return (
        <div ref={sectionRef} className="bg-bg py-24 sm:py-32">
            <Blueprint
                section="05"
                label="§ THE VERDICT"
                tag="THREE AXES / NEVER A GRADE"
                grid={false}
                className="mx-auto w-full max-w-6xl px-6 pt-16 sm:px-8"
            >
                <h2 className="font-display max-w-2xl text-[clamp(2.2rem,4.4vw,3.4rem)] leading-[1.03] text-text">
                    Same question. Two answers.
                </h2>
                <p className="mt-6 max-w-xl text-[15px] leading-relaxed text-text-muted">
                    Both are tokenized Treasuries. Only one has a public filing to reconcile against. One resolves
                    into proof. The other stays static &mdash; and we say so out loud.
                </p>

                <div className="mt-14 grid items-stretch gap-6 sm:grid-cols-2">
                    <VerdictPlate
                        symbol="BENJI"
                        name="Franklin OnChain U.S. Gov Money Fund"
                        fig="FIG. 05 · RESOLVES"
                        outcome="● VERIFIED_BACKED"
                        proven
                        axes={[
                            { k: "tier", v: "verified_backed", green: true },
                            { k: "confidence", v: "auto" },
                            { k: "freshness", v: "live", green: true },
                        ]}
                        takeaway="You can check the reserves yourself."
                        detail="Holdings are filed with the SEC (N-MFP). On-chain supply reconciles against that filing, so the green here is arithmetic, not a vibe."
                        field={
                            <AsciiField
                                src="/vault-dithered.png"
                                progress={benjiResolve}
                                baseCols={64}
                                className="absolute inset-0 h-full w-full"
                            />
                        }
                    />

                    <VerdictPlate
                        symbol="OUSG"
                        name="Ondo Short-Term U.S. Gov Treasuries"
                        fig="FIG. 06 · STAYS NOISE"
                        outcome="○ UNVERIFIABLE"
                        proven={false}
                        axes={[
                            { k: "tier", v: "unverifiable" },
                            { k: "confidence", v: "unverifiable" },
                            { k: "freshness", v: "unknown" },
                        ]}
                        takeaway="You cannot. We say so out loud."
                        detail="Reserves sit with a custodian, not published on-chain or in a public filing we can read. A higher APY doesn't change that — the answer stays unknown."
                        field={
                            <AsciiField
                                resolvedTo={0.16}
                                baseCols={64}
                                className="absolute inset-0 h-full w-full opacity-70"
                            />
                        }
                    />
                </div>
            </Blueprint>
        </div>
    );
}
