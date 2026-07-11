"use client";

/* Beat 1 — "the claim, unresolved."
   Full-bleed ASCII static that resolves into the reserve plate as you scroll,
   with the claim pinned over it and a blinking signal-green cursor. */

import { useRef } from "react";
import { useScroll, useTransform } from "framer-motion";
import AsciiField from "../ascii/AsciiField";
import Blueprint from "../chrome/Blueprint";

export default function HeroClaim() {
    const containerRef = useRef<HTMLDivElement>(null);
    const { scrollYProgress } = useScroll({
        target: containerRef,
        offset: ["start start", "end end"],
    });
    // Resolve the field across the pinned scroll; hold a touch of noise at the
    // end so the "claim" never feels fully proven this early.
    const resolve = useTransform(scrollYProgress, [0, 0.85], [0, 0.92]);

    return (
        <div ref={containerRef} className="relative h-[180vh]">
            <div className="sticky top-0 flex h-[100svh] min-h-[560px] w-full items-center overflow-hidden bg-bg">
                <AsciiField
                    src="/vault-dithered.png"
                    progress={resolve}
                    baseCols={116}
                    className="pointer-events-none absolute inset-0 h-full w-full opacity-90"
                />
                {/* legibility scrim, weighted to the text side */}
                <div
                    className="pointer-events-none absolute inset-0"
                    aria-hidden
                    style={{
                        background:
                            "linear-gradient(90deg, rgba(12,12,13,0.92) 0%, rgba(12,12,13,0.78) 42%, rgba(12,12,13,0.30) 72%, rgba(12,12,13,0.55) 100%)",
                    }}
                />

                <Blueprint
                    section="01"
                    label="§ THE CLAIM"
                    tag="LAT 40.7128 / LON -74.0060"
                    grid={false}
                    className="relative z-10 mx-auto flex h-full w-full max-w-6xl flex-col justify-center px-6 sm:px-8"
                >
                    <p className="label mb-7 text-text-faint">OPEN SOURCE / MCP / CLI / HTTP</p>

                    <h1 className="font-display max-w-3xl text-[clamp(2.6rem,7vw,5.4rem)] leading-[0.98] text-text">
                        &ldquo;Backed by real&#8209;world assets.&rdquo;
                        <span
                            className="cursor-blink ml-3 inline-block align-middle"
                            style={{ width: "0.5em", height: "0.86em" }}
                        />
                    </h1>

                    <p className="mt-8 max-w-xl text-[15px] leading-relaxed text-text-muted sm:text-base">
                        Every tokenized yield makes the claim. On&#8209;chain, all you see is a token and a
                        number. This reads the filings, checks the arithmetic, and shows you exactly where the
                        proof stops.
                    </p>

                    <div className="mt-10 flex flex-wrap items-center gap-5">
                        <div className="flex items-center border border-text/25 bg-bg/60 backdrop-blur-sm">
                            <span className="border-r border-text/15 px-4 py-3 font-mono text-sm text-signal">$</span>
                            <span className="px-4 py-3 font-mono text-sm text-text">npx rwa-verify ousg</span>
                        </div>
                        <a
                            href="#reconcile"
                            className="border-b border-text pb-1 font-mono text-sm text-text transition-colors hover:text-signal hover:border-signal"
                        >
                            See a live verdict &#8595;
                        </a>
                    </div>

                    <div className="absolute bottom-10 left-6 flex items-center gap-3 sm:left-8">
                        <span className="label text-text-faint">SCROLL TO RESOLVE</span>
                        <span className="font-mono text-signal">&#8595;</span>
                    </div>
                </Blueprint>
            </div>
        </div>
    );
}
