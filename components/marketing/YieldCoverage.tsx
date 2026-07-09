"use client";

import { useRef, useState, type ReactNode } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import {
    CircuitTraces,
    NodeFlow,
    ConcentricVault,
    EmissionSteps,
} from "./Blueprints";
import { CornerTicks, FAINT, MID, SIGNAL } from "./Instrument";

type Status = "live" | "researching" | "planned";
type SourceId = "backing" | "lending" | "staking" | "emissions";

interface Source {
    id: SourceId;
    label: string;
    title: string;
    desc: string;
    status: Status;
    art: (active: boolean) => ReactNode;
}

const STATUS_COPY: Record<Status, string> = {
    live: "Live",
    researching: "Building",
    planned: "Planned",
};

const SOURCES: Source[] = [
    {
        id: "backing",
        label: "Backing",
        title: "Tokenized funds and treasuries",
        desc: "Reconcile on-chain supply against a fund's filed NAV, or name the auditor when a regulator is not in the loop.",
        status: "live",
        art: (active) => <CircuitTraces className="h-full w-full" active={active} />,
    },
    {
        id: "lending",
        label: "Lending",
        title: "Aave, Morpho and money markets",
        desc: "Read the reserve on-chain. Split organic borrow interest from reward emissions, then grade utilization and oracle risk.",
        status: "researching",
        art: (active) => <NodeFlow className="h-full w-full" active={active} />,
    },
    {
        id: "staking",
        label: "Staking",
        title: "Liquid staking derivatives",
        desc: "Pooled ETH against token supply is arithmetic. Forward risk is slashing and validator exposure - named, not hidden.",
        status: "planned",
        art: (active) => <ConcentricVault className="h-full w-full" active={active} />,
    },
    {
        id: "emissions",
        label: "Emissions",
        title: "Incentive-driven yield",
        desc: "The part of a headline APY that ends when the program does. Separated from real yield, stamped with an end date.",
        status: "planned",
        art: (active) => <EmissionSteps className="h-full w-full" active={active} />,
    },
];

function BuildMeter({ status }: { status: Status }) {
    const filled = status === "live" ? 3 : status === "researching" ? 2 : 1;
    return (
        <span className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-text-faint">
            <span className="flex h-[15px] w-[15px] items-end justify-center gap-[3px]">
                {[0, 1, 2].map((i) => (
                    <span
                        key={i}
                        className={`w-[3px] ${i < filled ? "bg-text-muted" : "bg-border-strong"}`}
                        style={{ height: 6 + i * 3 }}
                    />
                ))}
            </span>
            {STATUS_COPY[status]}
        </span>
    );
}

function InteractiveRadial({
    activeId,
    onSelect,
}: {
    activeId: SourceId | null;
    onSelect: (id: SourceId | null) => void;
}) {
    const labels: { id: SourceId; label: string }[] = [
        { id: "backing", label: "backing" },
        { id: "lending", label: "lending" },
        { id: "staking", label: "staking" },
        { id: "emissions", label: "emissions" },
    ];
    const cx = 200;
    const cy = 200;
    const rDots = 168;
    const rLines = 162;
    const dotCount = 72;
    const dots = Array.from({ length: dotCount }, (_, i) => {
        const a = (i / dotCount) * Math.PI * 2;
        return [cx + Math.cos(a) * rDots, cy + Math.sin(a) * rDots] as const;
    });
    const lineCount = 64;
    const lines = Array.from({ length: lineCount }, (_, i) => {
        const a = (i / lineCount) * Math.PI * 2 + (i % 3) * 0.04;
        const rr = rLines * (0.62 + ((i * 37) % 40) / 100);
        return [cx + Math.cos(a) * rr, cy + Math.sin(a) * rr] as const;
    });

    const angleFor = (id: SourceId) => {
        const i = labels.findIndex((l) => l.id === id);
        return (i / labels.length) * Math.PI * 2 - Math.PI / 2;
    };

    return (
        <svg viewBox="0 0 400 400" fill="none" className="h-auto w-full">
            <g stroke={FAINT} strokeWidth="0.75" aria-hidden>
                {lines.map(([x, y], i) => {
                    const lineA = (i / lineCount) * Math.PI * 2 + (i % 3) * 0.04;
                    const isActiveSpoke =
                        activeId != null &&
                        Math.abs(Math.atan2(Math.sin(lineA - angleFor(activeId)), Math.cos(lineA - angleFor(activeId)))) < 0.18;
                    return (
                        <line
                            key={i}
                            x1={cx}
                            y1={cy}
                            x2={x}
                            y2={y}
                            stroke={isActiveSpoke ? SIGNAL : FAINT}
                            strokeWidth={isActiveSpoke ? 1.25 : 0.75}
                            opacity={activeId && !isActiveSpoke ? 0.22 : 1}
                        />
                    );
                })}
            </g>
            {activeId && (
                <line
                    aria-hidden
                    x1={cx}
                    y1={cy}
                    x2={cx + Math.cos(angleFor(activeId)) * rLines}
                    y2={cy + Math.sin(angleFor(activeId)) * rLines}
                    stroke={SIGNAL}
                    strokeWidth="1.5"
                    strokeDasharray="4 10"
                    className="current"
                />
            )}
            <g fill={MID} aria-hidden>
                {dots.map(([x, y], i) => (
                    <circle key={i} cx={x} cy={y} r={i % 6 === 0 ? 1.6 : 1} opacity={activeId ? 0.45 : 1} />
                ))}
            </g>
            <circle
                aria-hidden
                cx={cx}
                cy={cy}
                r="6"
                fill="color-mix(in srgb, var(--primary) 16%, transparent)"
                stroke={SIGNAL}
                strokeWidth="1.25"
            />
            <circle aria-hidden cx={cx} cy={cy} r="2.5" fill={SIGNAL} />
            {labels.map((n, i) => {
                const a = (i / labels.length) * Math.PI * 2 - Math.PI / 2;
                const x = cx + Math.cos(a) * (rDots + 8);
                const y = cy + Math.sin(a) * (rDots + 8);
                const on = activeId === n.id;
                return (
                    <text
                        key={n.id}
                        x={x}
                        y={y}
                        textAnchor={Math.cos(a) < -0.3 ? "end" : Math.cos(a) > 0.3 ? "start" : "middle"}
                        dominantBaseline="middle"
                        fill={on ? "rgba(245,244,242,0.95)" : "rgba(245,244,242,0.45)"}
                        fontSize="9"
                        fontFamily="var(--font-mono), monospace"
                        letterSpacing="1"
                        className="cursor-pointer"
                        role="button"
                        tabIndex={0}
                        onMouseEnter={() => onSelect(n.id)}
                        onMouseLeave={() => onSelect(null)}
                        onFocus={() => onSelect(n.id)}
                        onBlur={() => onSelect(null)}
                        onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                onSelect(on ? null : n.id);
                            }
                        }}
                    >
                        {n.label.toUpperCase()}
                    </text>
                );
            })}
        </svg>
    );
}

function SourcePlate({
    source,
    active,
    dimmed,
    onEnter,
    onLeave,
}: {
    source: Source;
    active: boolean;
    dimmed: boolean;
    onEnter: () => void;
    onLeave: () => void;
}) {
    const incomplete = source.status !== "live";
    return (
        <article
            className="relative flex flex-col border border-white/12 bg-[#050505]/70 p-5 outline-none transition-[border-color,opacity] duration-200"
            style={{
                borderColor: active ? "rgba(255,255,255,0.28)" : undefined,
                opacity: dimmed ? 0.4 : incomplete && !active ? 0.7 : 1,
            }}
            onMouseEnter={onEnter}
            onMouseLeave={onLeave}
            onFocus={onEnter}
            onBlur={onLeave}
            tabIndex={0}
        >
            <CornerTicks accent={active || source.status === "live"} />
            <div className="flex items-center justify-between gap-3">
                <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/40">{source.label}</span>
                <BuildMeter status={source.status} />
            </div>
            <div className="relative my-5 h-36 w-full">
                <div className="absolute inset-0 [mask-image:radial-gradient(ellipse_at_center,black_55%,transparent_100%)]">
                    {source.art(active || source.status === "live")}
                </div>
            </div>
            <h3 className="text-base font-medium text-text">{source.title}</h3>
            <p className="mt-2 text-[13px] leading-relaxed text-text-muted">{source.desc}</p>
        </article>
    );
}

export default function YieldCoverage() {
    const [activeId, setActiveId] = useState<SourceId | null>(null);
    const sectionRef = useRef<HTMLDivElement>(null);
    const { scrollYProgress } = useScroll({
        target: sectionRef,
        offset: ["start end", "end start"],
    });
    // Light parallax on the hub only — subordinate to Exploder
    const hubY = useTransform(scrollYProgress, [0.15, 0.55], [28, -12]);
    const hubOpacity = useTransform(scrollYProgress, [0.05, 0.2, 0.75, 0.95], [0.35, 1, 1, 0.55]);

    return (
        <div ref={sectionRef} className="grid items-start gap-10 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.2fr)] lg:gap-14">
            <motion.div style={{ y: hubY, opacity: hubOpacity }} className="mx-auto w-full max-w-[380px] lg:sticky lg:top-28">
                <div className="relative border border-white/10 bg-[#050505]/50 p-4">
                    <CornerTicks />
                    <div className="mb-3 flex items-center justify-between">
                        <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/35">FIG. 04 · COVERAGE</span>
                        <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-white/25">
                            {activeId ? activeId : "hover a spoke"}
                        </span>
                    </div>
                    <InteractiveRadial activeId={activeId} onSelect={setActiveId} />
                </div>
            </motion.div>

            <div className="grid gap-4 sm:grid-cols-2">
                {SOURCES.map((s) => (
                    <SourcePlate
                        key={s.id}
                        source={s}
                        active={activeId === s.id}
                        dimmed={activeId != null && activeId !== s.id}
                        onEnter={() => setActiveId(s.id)}
                        onLeave={() => setActiveId(null)}
                    />
                ))}
            </div>
        </div>
    );
}
