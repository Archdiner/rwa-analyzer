"use client";

import { useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";

/** Vertical Z-axis connector that stretches as the stack pulls apart. */
function Connector({
    height,
    opacity,
    className,
    accent = false,
}: {
    height: ReturnType<typeof useTransform<number, number>>;
    opacity: ReturnType<typeof useTransform<number, number>>;
    className?: string;
    accent?: boolean;
}) {
    return (
        <motion.div
            className={`absolute border-l border-dashed ${
                accent ? "border-signal/45" : "border-white/20"
            } ${className ?? ""}`}
            style={{
                width: 1,
                height,
                opacity,
                transform: "translate(-50%, -50%) rotateX(90deg)",
                transformOrigin: "center",
            }}
        />
    );
}

export default function YieldExploder() {
    const containerRef = useRef<HTMLDivElement>(null);
    const { scrollYProgress } = useScroll({
        target: containerRef,
        offset: ["start end", "end start"],
    });

    // Top Layer (The Token) moves up and left in the isometric plane
    const topX = useTransform(scrollYProgress, [0.3, 0.7], [0, -140]);
    const topY = useTransform(scrollYProgress, [0.3, 0.7], [0, -140]);
    const topZ = useTransform(scrollYProgress, [0.3, 0.7], [80, 160]);

    // Bottom Layer (The Reserve) moves down and right
    const bottomX = useTransform(scrollYProgress, [0.3, 0.7], [0, 140]);
    const bottomY = useTransform(scrollYProgress, [0.3, 0.7], [0, 140]);
    const bottomZ = useTransform(scrollYProgress, [0.3, 0.7], [-80, -160]);

    // Connectors track the stack span (topZ - bottomZ): ~160 → ~320.
    // Visible from the start so the stack reads as one assembly, not three floating cards.
    const connectorHeight = useTransform(scrollYProgress, [0.3, 0.7], [160, 320]);
    const connectorOpacity = useTransform(scrollYProgress, [0.15, 0.3, 0.7, 0.85], [0.35, 0.55, 0.75, 0.55]);

    // Side copy still waits until the stack has opened enough to read.
    const detailsOpacity = useTransform(scrollYProgress, [0.4, 0.6], [0, 1]);

    return (
        <div ref={containerRef} className="relative h-[200vh] w-full sm:h-[250vh]">
            <div className="sticky top-0 flex h-[100svh] min-h-[480px] w-full flex-col items-center justify-center overflow-hidden px-5">
                <motion.div
                    style={{ opacity: detailsOpacity }}
                    className="mb-8 max-w-md text-center lg:hidden"
                >
                    <h3 className="font-display text-2xl text-text sm:text-3xl">Deconstructing yield</h3>
                    <p className="mt-3 text-sm leading-relaxed text-text-muted">
                        A tokenized asset is a stack of trust: token, legal wrapper, underlying reserve.
                    </p>
                </motion.div>

                <div
                    className="relative h-[280px] w-[280px] scale-[0.82] sm:h-[340px] sm:w-[340px] sm:scale-100 md:h-[400px] md:w-[400px]"
                    style={{
                        perspective: "1200px",
                        transformStyle: "preserve-3d",
                    }}
                >
                    <motion.div
                        className="absolute inset-0 flex items-center justify-center"
                        style={{
                            transform: "rotateX(60deg) rotateZ(-45deg)",
                            transformStyle: "preserve-3d",
                        }}
                    >
                        {/* Connecting dashed lines - always present, stretch with separation */}
                        <div className="pointer-events-none absolute inset-0" style={{ transformStyle: "preserve-3d" }}>
                            <Connector
                                height={connectorHeight}
                                opacity={connectorOpacity}
                                accent
                                className="left-1/2 top-1/2"
                            />
                            <Connector
                                height={connectorHeight}
                                opacity={connectorOpacity}
                                className="left-0 top-0"
                            />
                            <Connector
                                height={connectorHeight}
                                opacity={connectorOpacity}
                                className="right-0 top-0"
                            />
                            <Connector
                                height={connectorHeight}
                                opacity={connectorOpacity}
                                className="left-0 bottom-0"
                            />
                            <Connector
                                height={connectorHeight}
                                opacity={connectorOpacity}
                                className="right-0 bottom-0"
                            />
                        </div>

                        {/* Bottom Layer: The Reserve — white/neutral, not the orange dither */}
                        <motion.div
                            style={{ x: bottomX, y: bottomY, z: bottomZ }}
                            className="absolute flex h-56 w-56 flex-col items-center justify-center border border-white/30 bg-[#050505]/90 backdrop-blur-md"
                        >
                            <span className="font-mono text-[10px] uppercase tracking-widest text-white/40">
                                Layer 3
                            </span>
                            <span className="mt-2 font-mono text-sm font-medium text-white">The Reserve</span>
                            <span className="mt-1 text-[10px] text-white/50">T-Bills, Cash, Repo</span>
                            <div
                                className="absolute inset-0 -z-10 opacity-20"
                                style={{
                                    backgroundImage: `linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)`,
                                    backgroundSize: "14px 14px",
                                }}
                            />
                        </motion.div>

                        {/* Middle Layer: The Wrapper */}
                        <motion.div
                            style={{ z: 0 }}
                            className="absolute flex h-56 w-56 flex-col items-center justify-center border border-white/30 bg-[#050505]/80 backdrop-blur-md"
                        >
                            <span className="font-mono text-[10px] uppercase tracking-widest text-white/40">
                                Layer 2
                            </span>
                            <span className="mt-2 font-mono text-sm font-medium text-white">The Wrapper</span>
                            <span className="mt-1 text-[10px] text-white/50">SPV, Trust, Fund</span>
                            <div
                                className="absolute inset-0 -z-10 opacity-20"
                                style={{
                                    backgroundImage: `linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)`,
                                    backgroundSize: "14px 14px",
                                }}
                            />
                        </motion.div>

                        {/* Top Layer: The Token */}
                        <motion.div
                            style={{ x: topX, y: topY, z: topZ }}
                            className="absolute flex h-56 w-56 flex-col items-center justify-center border border-signal/60 bg-[#050505]/80 shadow-[0_0_44px_color-mix(in_srgb,var(--signal)_22%,transparent)] backdrop-blur-md"
                        >
                            <span className="font-mono text-[10px] uppercase tracking-widest text-signal">
                                Layer 1
                            </span>
                            <span className="mt-2 font-mono text-sm font-medium text-white">The Token</span>
                            <span className="mt-1 text-[10px] text-white/50">ERC-20, Yield</span>
                            <div
                                className="absolute inset-0 -z-10 opacity-10"
                                style={{
                                    backgroundImage: `linear-gradient(var(--signal) 1px, transparent 1px), linear-gradient(90deg, var(--signal) 1px, transparent 1px)`,
                                    backgroundSize: "14px 14px",
                                }}
                            />
                            <div className="absolute -left-[1px] -top-[1px] h-3 w-3 border-l border-t border-signal" />
                            <div className="absolute -right-[1px] -top-[1px] h-3 w-3 border-r border-t border-signal" />
                            <div className="absolute -bottom-[1px] -left-[1px] h-3 w-3 border-b border-l border-signal" />
                            <div className="absolute -bottom-[1px] -right-[1px] h-3 w-3 border-b border-r border-signal" />
                        </motion.div>
                    </motion.div>
                </div>

                <motion.div
                    style={{ opacity: detailsOpacity }}
                    className="mt-8 max-w-md text-center lg:hidden"
                >
                    <div className="border-t border-border pt-6">
                        <h4 className="eyebrow text-signal">Verification boundary</h4>
                        <p className="mt-2 text-sm leading-relaxed text-text-muted">
                            On-chain reads only verify Layer 1. SEC filings and auditor attestations reconcile Layer 3
                            reserves against Layer 1 supply.
                        </p>
                    </div>
                </motion.div>

                <motion.div
                    style={{ opacity: detailsOpacity }}
                    className="absolute left-10 top-1/2 hidden max-w-sm -translate-y-1/2 lg:block"
                >
                    <h3 className="font-display text-3xl text-text">Deconstructing yield</h3>
                    <p className="mt-4 text-sm leading-relaxed text-text-muted">
                        A tokenized asset is not a monolith. It is a stack of trust. I break down the token, the
                        legal wrapper, and the underlying reserve to find where verification actually stops.
                    </p>
                </motion.div>

                <motion.div
                    style={{ opacity: detailsOpacity }}
                    className="absolute right-10 top-1/2 hidden max-w-sm -translate-y-1/2 lg:block"
                >
                    <div className="border-l border-signal/30 pl-4">
                        <h4 className="eyebrow text-signal">Verification boundary</h4>
                        <p className="mt-2 text-sm leading-relaxed text-text-muted">
                            On-chain reads only verify Layer 1. To verify the asset, I parse SEC EDGAR filings and
                            auditor attestations to reconcile Layer 3 reserves against Layer 1 supply.
                        </p>
                    </div>
                </motion.div>
            </div>
        </div>
    );
}
