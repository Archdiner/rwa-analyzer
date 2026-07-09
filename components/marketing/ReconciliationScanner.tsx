"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

/* Deterministic reconciliation, drawn as a schematic: two independent sources
   feed a comparator over signal traces; when supply x NAV equals the filing,
   the verdict settles green. Calm blueprint craft, no terminal cosplay. */

type Phase = "reading" | "matched";

/** A horizontal signal trace with a faint board line + a flowing current. */
function Trace({ reversed = false, live }: { reversed?: boolean; live: boolean }) {
    return (
        <svg viewBox="0 0 120 24" preserveAspectRatio="none" className="h-6 w-full" aria-hidden>
            <line x1="0" y1="12" x2="120" y2="12" stroke="rgba(245,244,242,0.12)" strokeWidth="1" />
            <circle cx={reversed ? 118 : 2} cy="12" r="2" fill="rgba(245,244,242,0.28)" />
            {live && (
                <line
                    x1="0"
                    y1="12"
                    x2="120"
                    y2="12"
                    stroke="var(--primary)"
                    strokeWidth="1.5"
                    strokeDasharray="4 10"
                    className="current"
                    style={{ animationDirection: reversed ? "reverse" : "normal" }}
                />
            )}
        </svg>
    );
}

function SourceCard({
    tag,
    title,
    sub,
    value,
    live,
}: {
    tag: string;
    title: string;
    sub: string;
    value: string;
    live: boolean;
}) {
    return (
        <div
            className={`w-full rounded-2xl border p-5 transition-colors duration-500 ${
                live ? "border-border-strong bg-white/[0.03]" : "border-border bg-white/[0.015]"
            }`}
        >
            <span className="pill">{tag}</span>
            <div className="mt-4 text-sm font-medium text-text">{title}</div>
            <div className="mt-1 text-[12px] text-text-faint">{sub}</div>
            <div className="mt-4 font-mono text-xl tracking-tight text-text tabular-nums">{value}</div>
        </div>
    );
}

export default function ReconciliationScanner() {
    const [phase, setPhase] = useState<Phase>("reading");

    useEffect(() => {
        let cancelled = false;
        const loop = async () => {
            while (!cancelled) {
                setPhase("reading");
                await new Promise((r) => setTimeout(r, 2600));
                if (cancelled) return;
                setPhase("matched");
                await new Promise((r) => setTimeout(r, 3400));
            }
        };
        loop();
        return () => {
            cancelled = true;
        };
    }, []);

    const matched = phase === "matched";
    const VALUE = "47,838,681.95";

    return (
        <div className="panel relative mx-auto w-full max-w-4xl overflow-hidden p-8 sm:p-10">
            <div className="flex flex-col items-stretch gap-4 md:flex-row md:items-center">
                <div className="flex-1">
                    <SourceCard
                        tag="Source 01 · on-chain"
                        title="Token supply"
                        sub="Ethereum ERC-20 read"
                        value={VALUE}
                        live
                    />
                </div>

                {/* left trace */}
                <div className="hidden w-16 shrink-0 md:block">
                    <Trace live />
                </div>

                {/* comparator */}
                <div className="flex shrink-0 items-center justify-center py-2 md:py-0">
                    <div className="relative flex h-20 w-20 items-center justify-center">
                        {/* rotated blueprint square */}
                        <motion.div
                            animate={{ rotate: matched ? 45 : 0 }}
                            transition={{ type: "spring", stiffness: 120, damping: 14 }}
                            className={`absolute inset-0 rounded-xl border transition-colors duration-500 ${
                                matched ? "border-green" : "border-border-strong"
                            }`}
                        />
                        <span
                            className={`relative font-mono text-lg transition-colors duration-500 ${
                                matched ? "text-green" : "text-text-faint"
                            }`}
                        >
                            {matched ? "=" : "≈"}
                        </span>
                    </div>
                </div>

                {/* right trace */}
                <div className="hidden w-16 shrink-0 md:block">
                    <Trace reversed live />
                </div>

                <div className="flex-1">
                    <SourceCard
                        tag="Source 02 · filing"
                        title="SEC EDGAR N-MFP"
                        sub="Net asset value x shares"
                        value={VALUE}
                        live
                    />
                </div>
            </div>

            {/* verdict */}
            <div className="mt-8 flex items-center justify-between border-t border-border pt-5">
                <span className="eyebrow">Verdict</span>
                <AnimatePresence mode="wait">
                    {matched ? (
                        <motion.div
                            key="matched"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[13px]"
                        >
                            <span className="text-green">tier verified_backed</span>
                            <span className="text-text-faint">confidence verified</span>
                            <span className="text-text-faint">freshness live</span>
                        </motion.div>
                    ) : (
                        <motion.span
                            key="reading"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="font-mono text-[13px] text-text-faint"
                        >
                            reconciling sources…
                        </motion.span>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}
