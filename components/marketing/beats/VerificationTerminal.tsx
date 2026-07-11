"use client";

/* Beat 4 — "we check the receipts. live."
   A pinned, scroll-scrubbed terminal that types out the real BENJI reconciliation
   and locks supply × NAV into a green "=" once the scrub completes. */

import { useRef, useState } from "react";
import { motion, useScroll, useTransform, useMotionValueEvent } from "framer-motion";
import Blueprint from "../chrome/Blueprint";
import { useReducedMotion } from "../hooks/useReducedMotion";
import {
    BENJI_TRANSCRIPT as LINES,
    BENJI_LOCK,
    type TranscriptTone,
} from "@/lib/marketing/benji-transcript";

const toneClass: Record<TranscriptTone, string> = {
    prompt: "text-text",
    step: "text-text-muted",
    data: "text-text",
    cite: "text-signal",
    ok: "text-signal",
};

function Gutter({ tone }: { tone: TranscriptTone }) {
    const mark = tone === "prompt" ? "" : tone === "cite" ? "❝" : tone === "ok" ? "✓" : "›";
    return (
        <span
            className={`inline-block w-4 shrink-0 select-none ${
                tone === "step" ? "text-signal/70" : tone === "cite" || tone === "ok" ? "text-signal" : "text-text-faint"
            }`}
        >
            {mark}
        </span>
    );
}

export default function VerificationTerminal() {
    const reduced = useReducedMotion();
    const containerRef = useRef<HTMLDivElement>(null);
    const { scrollYProgress } = useScroll({
        target: containerRef,
        offset: ["start start", "end end"],
    });
    const lineMV = useTransform(scrollYProgress, [0.06, 0.88], [0, LINES.length]);

    const [shown, setShown] = useState(reduced ? LINES.length : 0);
    const [locked, setLocked] = useState(reduced);
    const shownRef = useRef(shown);
    const curRef = useRef<HTMLSpanElement>(null);

    useMotionValueEvent(lineMV, "change", (v) => {
        const idx = Math.min(Math.floor(v), LINES.length);
        if (idx !== shownRef.current) {
            shownRef.current = idx;
            setShown(idx);
        }
        setLocked(idx >= LINES.length);
        const cur = LINES[idx];
        if (cur && curRef.current) {
            const frac = v - idx;
            curRef.current.textContent = cur.text.slice(0, Math.ceil(frac * cur.text.length));
        }
    });

    return (
        <div id="reconcile" ref={containerRef} className="relative h-[340vh] bg-bg">
            <div className="sticky top-0 flex h-[100svh] min-h-[620px] w-full items-center overflow-hidden">
                <Blueprint
                    section="04"
                    label="§ THE RECONCILIATION"
                    tag="ARITHMETIC, NOT OPINION"
                    grid
                    className="mx-auto grid h-full w-full max-w-6xl grid-cols-1 items-center gap-10 px-6 sm:px-8 lg:grid-cols-[0.85fr_1.15fr]"
                >
                    {/* Left — the thesis */}
                    <div className="relative z-10">
                        <h2 className="font-display text-[clamp(2.2rem,4.6vw,3.6rem)] leading-[1.02] text-text">
                            We check the receipts.
                            <span className="block text-signal">Live.</span>
                        </h2>
                        <p className="mt-6 max-w-md text-[15px] leading-relaxed text-text-muted">
                            No model votes on the answer. We read the on&#8209;chain supply, pull the SEC filing,
                            quote the net asset value word for word, and multiply. If the two numbers don&#8217;t
                            meet, there is no green.
                        </p>
                        <p className="label mt-8 text-text-faint">
                            {locked ? "RECONCILED" : "SCROLL TO RUN THE CHECK"}
                        </p>
                    </div>

                    {/* Right — the terminal */}
                    <div className="relative z-10 border border-text/15 bg-[#0a0a0b]/85 backdrop-blur-sm">
                        <div className="flex items-center gap-2 border-b border-text/12 px-4 py-3">
                            <span className="h-2.5 w-2.5 rounded-full border border-text/25" />
                            <span className="h-2.5 w-2.5 rounded-full border border-text/25" />
                            <span className="h-2.5 w-2.5 rounded-full border border-text/25" />
                            <span className="ml-3 font-mono text-[11px] tracking-[0.14em] text-text-faint">
                                rwa-verify — reconcile
                            </span>
                            <span
                                className={`ml-auto font-mono text-[11px] tracking-[0.14em] ${
                                    locked ? "text-signal" : "text-text-faint"
                                }`}
                            >
                                {locked ? "● VERIFIED" : "○ running"}
                            </span>
                        </div>

                        <div className="min-h-[19rem] px-5 py-5 font-mono text-[13px] leading-[1.9] sm:text-sm">
                            {LINES.map((l, i) => {
                                if (i > shown) return null;
                                const isCurrent = i === shown && shown < LINES.length;
                                return (
                                    <div
                                        key={i}
                                        className={`flex gap-2 ${l.cite ? "my-1 border-l border-signal/60 bg-signal/[0.07] py-1 pr-2" : ""}`}
                                    >
                                        <Gutter tone={l.tone} />
                                        <span className={`whitespace-pre-wrap ${toneClass[l.tone]}`}>
                                            {isCurrent ? <span ref={curRef} /> : l.text}
                                            {isCurrent && (
                                                <span
                                                    className="cursor-blink ml-0.5 inline-block align-middle"
                                                    style={{ width: "0.5em", height: "1em" }}
                                                />
                                            )}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Supply × NAV lock */}
                        <motion.div
                            initial={false}
                            animate={{ opacity: locked ? 1 : 0.25 }}
                            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                            className="border-t border-text/12 px-5 py-4"
                        >
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-sm tabular-nums">
                                <span className="text-text">{BENJI_LOCK.left}</span>
                                <span className="text-text-faint">×</span>
                                <span className="text-text">{BENJI_LOCK.nav}</span>
                                <motion.span
                                    animate={{ color: locked ? "var(--signal)" : "rgba(244,243,239,0.36)" }}
                                    transition={{ duration: 0.5 }}
                                    className="px-1 text-lg"
                                >
                                    =
                                </motion.span>
                                <span className={locked ? "text-signal" : "text-text"}>{BENJI_LOCK.product}</span>
                            </div>
                            <div className="mt-3 flex flex-wrap gap-2">
                                {[
                                    ["tier", BENJI_LOCK.tier, true],
                                    ["confidence", BENJI_LOCK.confidence, false],
                                    ["freshness", BENJI_LOCK.freshness, true],
                                ].map(([k, v, green]) => (
                                    <span
                                        key={k as string}
                                        className={`border px-2 py-1 font-mono text-[11px] tracking-[0.08em] ${
                                            locked && green
                                                ? "border-signal/50 text-signal"
                                                : "border-text/15 text-text-muted"
                                        }`}
                                    >
                                        {k}={v}
                                    </span>
                                ))}
                            </div>
                            <motion.div
                                aria-hidden
                                animate={{ opacity: locked ? 0.6 : 0 }}
                                transition={{ duration: 0.6 }}
                                className="pointer-events-none mt-4 h-px w-full"
                                style={{ background: "linear-gradient(90deg, transparent, var(--signal), transparent)" }}
                            />
                        </motion.div>
                    </div>
                </Blueprint>
            </div>
        </div>
    );
}
