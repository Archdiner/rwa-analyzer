"use client";

import { useEffect, useRef } from "react";

/* -----------------------------------------------------------------------------
   Hero background - bg-animation.mp4 on first screen only.
   -----------------------------------------------------------------------------
   The looping video lives inside the hero band (100svh), not site-wide. Angled
   fades keep the headline readable on the left while the safe stays visible on
   the right; the bottom dissolves to solid black so everything below is plain.
--------------------------------------------------------------------------------*/

export default function HeroBackground() {
    const videoRef = useRef<HTMLVideoElement>(null);

    useEffect(() => {
        const v = videoRef.current;
        if (!v) return;

        const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
        const sync = () => {
            if (reduced.matches) v.pause();
            else void v.play().catch(() => {});
        };

        sync();
        reduced.addEventListener("change", sync);
        return () => reduced.removeEventListener("change", sync);
    }, []);

    return (
        <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden bg-bg">
            <video
                ref={videoRef}
                autoPlay
                loop
                muted
                playsInline
                preload="auto"
                className="absolute inset-0 h-full w-full object-cover object-[78%_center] opacity-[0.72] sm:object-[72%_center] sm:opacity-[0.78]"
                src="/bg-animation.mp4"
            />

            {/* Text scrim — stronger on mobile where the safe fills more of the frame */}
            <div
                className="absolute inset-0 sm:hidden"
                style={{
                    background:
                        "linear-gradient(112deg, var(--bg) 0%, color-mix(in srgb, var(--bg) 96%, transparent) 38%, color-mix(in srgb, var(--bg) 72%, transparent) 58%, transparent 78%)",
                }}
            />
            <div
                className="absolute inset-0 hidden sm:block"
                style={{
                    background:
                        "linear-gradient(108deg, var(--bg) 0%, color-mix(in srgb, var(--bg) 97%, transparent) 32%, color-mix(in srgb, var(--bg) 82%, transparent) 46%, transparent 58%)",
                }}
            />

            {/* Radial lift behind the copy column */}
            <div
                className="absolute inset-0"
                style={{
                    background:
                        "radial-gradient(ellipse 90% 80% at 18% 48%, color-mix(in srgb, var(--bg) 88%, transparent) 0%, transparent 62%)",
                }}
            />

            {/* Bottom: diagonal dissolve into solid black at the hero edge */}
            <div
                className="absolute inset-0"
                style={{
                    background:
                        "linear-gradient(172deg, transparent 38%, color-mix(in srgb, var(--bg) 55%, transparent) 66%, var(--bg) 94%)",
                }}
            />

            {/* Top: fade under the header */}
            <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-bg via-bg/90 to-transparent" />
        </div>
    );
}
