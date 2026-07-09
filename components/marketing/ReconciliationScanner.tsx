"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
    BusTrace,
    InstrumentBoard,
    InstrumentPlate,
    LatchRotate,
    MID,
    PlateLabel,
    SIGNAL,
} from "./Instrument";
import { settle } from "./motion-tokens";

type Phase = "reading" | "matched";

function SourcePlate({
    id,
    title,
    sub,
    value,
    matched,
}: {
    id: string;
    title: string;
    sub: string;
    value: string;
    matched: boolean;
}) {
    return (
        <InstrumentPlate
            tone={matched ? "matched" : "live"}
            accentTicks={matched}
            className="flex min-h-[9.5rem] flex-1 flex-col justify-between p-5"
        >
            <div>
                <PlateLabel>{id}</PlateLabel>
                <div className="mt-3 font-mono text-sm font-medium tracking-tight text-text">{title}</div>
                <div className="mt-1 text-[11px] leading-snug text-text-faint">{sub}</div>
            </div>
            <div className="mt-5 font-mono text-lg tracking-tight text-text tabular-nums sm:text-xl">{value}</div>
        </InstrumentPlate>
    );
}

/** Comparator die — chip with pins, locks 45° on match with heavy settle. */
function ComparatorDie({ matched }: { matched: boolean }) {
    return (
        <div className="relative flex h-[5.5rem] w-[5.5rem] shrink-0 items-center justify-center">
            {/* pin stubs */}
            <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 88 88" aria-hidden>
                <g stroke={MID} strokeWidth="1">
                    <path d="M0 28 H10 M0 44 H10 M0 60 H10" />
                    <path d="M88 28 H78 M88 44 H78 M88 60 H78" />
                    <path d="M28 0 V10 M44 0 V10 M60 0 V10" />
                    <path d="M28 88 V78 M44 88 V78 M60 88 V78" />
                </g>
            </svg>
            <LatchRotate locked={matched} className="absolute inset-3">
                <div
                    className={`h-full w-full border ${
                        matched ? "border-green bg-green/5" : "border-white/30 bg-[#050505]/90"
                    }`}
                />
            </LatchRotate>
            <motion.span
                animate={{ color: matched ? "var(--green)" : "rgba(245,244,242,0.36)" }}
                transition={settle}
                className="relative z-10 font-mono text-lg"
            >
                {matched ? "=" : "≈"}
            </motion.span>
        </div>
    );
}

export default function ReconciliationScanner() {
    const [phase, setPhase] = useState<Phase>("reading");

    useEffect(() => {
        if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
        let cancelled = false;
        const loop = async () => {
            while (!cancelled) {
                setPhase("reading");
                await new Promise((r) => setTimeout(r, 2800));
                if (cancelled) return;
                setPhase("matched");
                await new Promise((r) => setTimeout(r, 3600));
            }
        };
        loop();
        return () => {
            cancelled = true;
        };
    }, []);

    const matched = phase === "matched";
    const VALUE = "47,838,681.95";
    const railMode = matched ? "settled" : "flow";

    return (
        <InstrumentBoard fig="FIG. 02 · RECONCILE" className="mx-auto">
            <div className="flex flex-col items-stretch gap-4 sm:flex-row sm:items-center sm:gap-2 lg:gap-3">
                <SourcePlate
                    id="Src 01 · on-chain"
                    title="Token supply"
                    sub="Ethereum ERC-20 read"
                    value={VALUE}
                    matched={matched}
                />

                <div className="flex items-center justify-center sm:hidden">
                    <BusTrace mode={railMode} vertical />
                </div>
                <div className="hidden w-10 shrink-0 sm:block md:w-14 lg:w-20">
                    <BusTrace mode={railMode} />
                </div>

                <div className="flex justify-center py-1 sm:py-0">
                    <ComparatorDie matched={matched} />
                </div>

                <div className="hidden w-10 shrink-0 sm:block md:w-14 lg:w-20">
                    <BusTrace mode={railMode} />
                </div>
                <div className="flex items-center justify-center sm:hidden">
                    <BusTrace mode={railMode} vertical />
                </div>

                <SourcePlate
                    id="Src 02 · filing"
                    title="SEC EDGAR N-MFP"
                    sub="Net asset value × shares"
                    value={VALUE}
                    matched={matched}
                />
            </div>

            <div className="mt-8 flex flex-col gap-3 border-t border-white/10 pt-5 sm:flex-row sm:items-center sm:justify-between">
                <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/35">Verdict</span>
                <div className="relative h-6 min-w-0 flex-1 overflow-hidden sm:text-right">
                    <motion.div
                        className="absolute inset-0 flex items-center sm:justify-end"
                        initial={false}
                        animate={{
                            clipPath: matched ? "inset(0 100% 0 0)" : "inset(0 0% 0 0)",
                            opacity: matched ? 0 : 1,
                        }}
                        transition={settle}
                        style={{ pointerEvents: matched ? "none" : "auto" }}
                    >
                        <span className="font-mono text-[13px] text-text-faint">reconciling sources…</span>
                    </motion.div>
                    <motion.div
                        className="absolute inset-0 flex flex-wrap items-center gap-x-4 gap-y-1 sm:justify-end"
                        initial={false}
                        animate={{
                            clipPath: matched ? "inset(0 0% 0 0)" : "inset(0 0 0 100%)",
                            opacity: matched ? 1 : 0,
                        }}
                        transition={settle}
                        style={{ pointerEvents: matched ? "auto" : "none" }}
                    >
                        <span className="font-mono text-[13px] text-green">Backing verified</span>
                        <span className="font-mono text-[13px] text-text-faint">sources match</span>
                        <span className="font-mono text-[13px] text-text-faint">filing is current</span>
                    </motion.div>
                </div>
            </div>

            {/* latent signal accent when matched */}
            <motion.div
                aria-hidden
                animate={{ opacity: matched ? 0.55 : 0 }}
                transition={settle}
                className="pointer-events-none absolute bottom-0 left-0 h-px w-full"
                style={{ background: `linear-gradient(90deg, transparent, ${SIGNAL}, transparent)` }}
            />
        </InstrumentBoard>
    );
}
