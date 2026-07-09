"use client";

import { useEffect, useState } from "react";

export default function ArtsyBackground() {
    const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            setMousePos({ x: e.clientX, y: e.clientY });
        };
        window.addEventListener("mousemove", handleMouseMove);
        return () => window.removeEventListener("mousemove", handleMouseMove);
    }, []);

    return (
        <div className="fixed inset-0 z-[-1] overflow-hidden bg-[#0a0a0b]">
            {/* Warm top-light: a soft wash from above, like studio lighting. */}
            <div className="absolute inset-0 bg-[radial-gradient(120%_80%_at_50%_-10%,rgba(232,226,214,0.04),transparent_60%)]" />

            {/* Base radial gradient following the cursor for gentle depth. */}
            <div
                className="absolute inset-0 opacity-40 transition-opacity duration-1000"
                style={{
                    background: `radial-gradient(circle 700px at ${mousePos.x}px ${mousePos.y}px, rgba(232, 226, 214, 0.03), transparent 75%)`,
                }}
            />

            {/* Fine blueprint grid - single tier, faint, masked to the center. */}
            <div
                className="absolute inset-0 opacity-[0.5]"
                style={{
                    backgroundImage: `
                        linear-gradient(rgba(255, 255, 255, 0.035) 1px, transparent 1px),
                        linear-gradient(90deg, rgba(255, 255, 255, 0.035) 1px, transparent 1px)
                    `,
                    backgroundSize: "56px 56px, 56px 56px",
                    maskImage: "radial-gradient(ellipse 90% 70% at 50% 30%, black 10%, transparent 75%)",
                    WebkitMaskImage: "radial-gradient(ellipse 90% 70% at 50% 30%, black 10%, transparent 75%)",
                }}
            />

            {/* Noise texture - just enough to kill the flat digital gradient. */}
            <div
                className="absolute inset-0 opacity-[0.035] mix-blend-soft-light"
                style={{
                    backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
                }}
            />

            {/* Vignette to settle the edges into the warm black. */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,#0a0a0b_100%)] opacity-90" />
        </div>
    );
}
