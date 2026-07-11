"use client";

/* Beat 8 — the close.
   A full-bleed field resolves out of static into the wordmark as the section
   enters view, under the final line + CTAs. */

import { useRef } from "react";
import { useScroll, useTransform } from "framer-motion";
import AsciiField from "../ascii/AsciiField";
import { GITHUB_URL } from "@/lib/site";

function paintWordmark(ctx: CanvasRenderingContext2D, cols: number, rows: number) {
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, cols, rows);
    ctx.fillStyle = "#fff";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const fs = Math.floor(rows * 0.3);
    ctx.font = `700 ${fs}px Georgia, 'Times New Roman', serif`;
    ctx.fillText("RWA", cols / 2, rows * 0.4);
    ctx.fillText("VERIFY", cols / 2, rows * 0.66);
}

export default function CloseResolve() {
    const ref = useRef<HTMLDivElement>(null);
    const { scrollYProgress } = useScroll({
        target: ref,
        offset: ["start 0.9", "center 0.55"],
    });
    const resolve = useTransform(scrollYProgress, [0, 1], [0.04, 1]);

    return (
        <div ref={ref} className="relative flex min-h-[92vh] items-center overflow-hidden bg-bg">
            <AsciiField
                paint={paintWordmark}
                progress={resolve}
                baseCols={128}
                className="pointer-events-none absolute inset-0 h-full w-full opacity-70"
            />
            <div
                className="pointer-events-none absolute inset-0"
                aria-hidden
                style={{
                    background:
                        "radial-gradient(120% 80% at 50% 50%, rgba(12,12,13,0.55) 0%, rgba(12,12,13,0.86) 70%, #0c0c0d 100%)",
                }}
            />

            <div className="relative z-10 mx-auto w-full max-w-4xl px-6 text-center sm:px-8">
                <p className="label mb-8 text-text-faint">§ THE CLOSE</p>
                <h2 className="font-display text-[clamp(2.4rem,6vw,5rem)] leading-[1.02] text-text">
                    Your earn tab shows an APY.
                    <span className="block text-signal">It should show you this.</span>
                </h2>
                <p className="mx-auto mt-8 max-w-lg text-[15px] leading-relaxed text-text-muted">
                    Open source. Deterministic reconciliation. One call before you route a deposit, and an honest
                    answer when the proof runs out.
                </p>
                <div className="mt-11 flex flex-wrap items-center justify-center gap-5">
                    <div className="flex items-center border border-text/25 bg-bg/60 backdrop-blur-sm">
                        <span className="border-r border-text/15 px-4 py-3 font-mono text-sm text-signal">$</span>
                        <span className="px-4 py-3 font-mono text-sm text-text">npx rwa-verify ousg</span>
                    </div>
                    <a
                        href={GITHUB_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="border-b border-text pb-1 font-mono text-sm text-text transition-colors hover:border-signal hover:text-signal"
                    >
                        View source on GitHub &#8599;
                    </a>
                </div>
            </div>
        </div>
    );
}
