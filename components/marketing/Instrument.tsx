"use client";

import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { settle, uiIn } from "./motion-tokens";

export const FAINT = "rgba(245,244,242,0.14)";
export const MID = "rgba(245,244,242,0.28)";
export const SIGNAL = "var(--primary)";

/** 14px blueprint hatch — same ink as YieldExploder plates. */
export function Hatch({ accent = false }: { accent?: boolean }) {
    const line = accent ? "var(--primary)" : "rgba(255,255,255,0.5)";
    return (
        <div
            className="pointer-events-none absolute inset-0 -z-10 opacity-20"
            style={{
                backgroundImage: `linear-gradient(${line} 1px, transparent 1px), linear-gradient(90deg, ${line} 1px, transparent 1px)`,
                backgroundSize: "14px 14px",
            }}
            aria-hidden
        />
    );
}

/** Registration L-brackets — Exploder token-layer language. */
export function CornerTicks({ accent = false }: { accent?: boolean }) {
    const c = accent ? "border-primary" : "border-white/35";
    return (
        <>
            <div className={`absolute -left-[1px] -top-[1px] h-2.5 w-2.5 border-l border-t ${c}`} />
            <div className={`absolute -right-[1px] -top-[1px] h-2.5 w-2.5 border-r border-t ${c}`} />
            <div className={`absolute -bottom-[1px] -left-[1px] h-2.5 w-2.5 border-b border-l ${c}`} />
            <div className={`absolute -bottom-[1px] -right-[1px] h-2.5 w-2.5 border-b border-r ${c}`} />
        </>
    );
}

type PlateTone = "idle" | "live" | "matched" | "blocked";

const plateBorder: Record<PlateTone, string> = {
    idle: "border-white/20",
    live: "border-white/30",
    matched: "border-green/50",
    blocked: "border-amber/45",
};

/** Sharp instrument plate — no rounded-2xl, no pill. */
export function InstrumentPlate({
    children,
    className = "",
    tone = "idle",
    accentTicks = false,
    hatchAccent = false,
}: {
    children: ReactNode;
    className?: string;
    tone?: PlateTone;
    accentTicks?: boolean;
    hatchAccent?: boolean;
}) {
    return (
        <div
            className={`relative border bg-[#050505]/85 backdrop-blur-md ${plateBorder[tone]} ${className}`}
        >
            <Hatch accent={hatchAccent} />
            <CornerTicks accent={accentTicks || tone === "matched"} />
            {children}
        </div>
    );
}

/** Etched mono label at plate edge — replaces .pill inside demos. */
export function PlateLabel({ children }: { children: ReactNode }) {
    return (
        <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/40">
            {children}
        </span>
    );
}

type TraceMode = "idle" | "flow" | "settled" | "broken";

/**
 * Horizontal bus between instrument nodes.
 * flow = dashed current; settled = solid asserted path; broken = ghost + gap.
 */
export function BusTrace({
    mode,
    vertical = false,
    className = "",
}: {
    mode: TraceMode;
    vertical?: boolean;
    className?: string;
}) {
    const flowing = mode === "flow";
    const settled = mode === "settled";
    const broken = mode === "broken";
    const live = flowing || settled;
    const stroke = settled ? "var(--green)" : broken ? "var(--amber)" : SIGNAL;

    if (vertical) {
        return (
            <svg
                viewBox="0 0 24 80"
                preserveAspectRatio="none"
                className={`h-14 w-6 shrink-0 ${className}`}
                aria-hidden
            >
                <line x1="12" y1="0" x2="12" y2="80" stroke={FAINT} strokeWidth="1" />
                {live && (
                    <line
                        x1="12"
                        y1="0"
                        x2="12"
                        y2="80"
                        stroke={stroke}
                        strokeWidth={settled ? 1.75 : 1.5}
                        strokeDasharray={settled ? undefined : "4 10"}
                        className={flowing ? "current" : undefined}
                        opacity={settled ? 1 : 0.9}
                    />
                )}
                {broken && (
                    <>
                        <line x1="12" y1="0" x2="12" y2="28" stroke={stroke} strokeWidth="1.5" strokeDasharray="3 8" opacity="0.55" />
                        <line x1="12" y1="52" x2="12" y2="80" stroke={stroke} strokeWidth="1.5" strokeDasharray="3 8" opacity="0.55" />
                        <text x="12" y="44" textAnchor="middle" fill="var(--amber)" fontSize="14" fontFamily="var(--font-mono), monospace">
                            ×
                        </text>
                    </>
                )}
            </svg>
        );
    }

    return (
        <svg
            viewBox="0 0 120 24"
            preserveAspectRatio="none"
            className={`h-6 w-full min-w-[3rem] ${className}`}
            aria-hidden
        >
            <line x1="0" y1="12" x2="120" y2="12" stroke={FAINT} strokeWidth="1" />
            <circle cx="2" cy="12" r="2" fill={MID} />
            <circle cx="118" cy="12" r="2" fill={settled ? "var(--green)" : MID} />
            {live && (
                <line
                    x1="0"
                    y1="12"
                    x2="120"
                    y2="12"
                    stroke={stroke}
                    strokeWidth={settled ? 1.75 : 1.5}
                    strokeDasharray={settled ? undefined : "4 10"}
                    className={flowing ? "current" : undefined}
                    opacity={settled ? 1 : 0.9}
                />
            )}
            {broken && (
                <>
                    <line x1="0" y1="12" x2="42" y2="12" stroke={stroke} strokeWidth="1.5" strokeDasharray="3 8" opacity="0.55" />
                    <line x1="78" y1="12" x2="120" y2="12" stroke={stroke} strokeWidth="1.5" strokeDasharray="3 8" opacity="0.55" />
                    <text x="60" y="16" textAnchor="middle" fill="var(--amber)" fontSize="12" fontFamily="var(--font-mono), monospace">
                        ×
                    </text>
                </>
            )}
        </svg>
    );
}

/** Schematic board frame — replaces .panel bubble for demos. */
export function InstrumentBoard({
    children,
    fig,
    className = "",
}: {
    children: ReactNode;
    fig: string;
    className?: string;
}) {
    return (
        <div
            className={`relative w-full border border-white/12 bg-[#050505]/70 p-5 sm:p-8 ${className}`}
        >
            <CornerTicks />
            <div className="mb-6 flex items-center justify-between gap-4 border-b border-white/10 pb-3">
                <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/35">{fig}</span>
                <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-white/25">schematic</span>
            </div>
            {children}
        </div>
    );
}

/** Clip-unmask for verdict / status lines — shutter, not opacity fade. */
export function ClipReveal({
    show,
    children,
    className = "",
}: {
    show: boolean;
    children: ReactNode;
    className?: string;
}) {
    return (
        <motion.div
            initial={false}
            animate={{
                clipPath: show ? "inset(0% 0% 0% 0%)" : "inset(0% 0% 0% 100%)",
                opacity: show ? 1 : 0.35,
            }}
            transition={show ? uiIn : { duration: 0.22, ease: [0.4, 0, 1, 1] }}
            className={className}
        >
            {children}
        </motion.div>
    );
}

/** Heavy latch for comparator / gate — no bounce spring. */
export function LatchRotate({
    locked,
    children,
    className = "",
}: {
    locked: boolean;
    children: ReactNode;
    className?: string;
}) {
    return (
        <motion.div
            animate={{ rotate: locked ? 45 : 0 }}
            transition={settle}
            className={className}
        >
            {children}
        </motion.div>
    );
}
