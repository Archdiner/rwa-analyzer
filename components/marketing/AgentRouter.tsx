"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
    BusTrace,
    FAINT,
    InstrumentBoard,
    InstrumentPlate,
    MID,
    PlateLabel,
    SIGNAL,
} from "./Instrument";
import { settle, uiIn } from "./motion-tokens";

type State = "idle" | "evaluating" | "approved" | "blocked";

/** Engine as a chip die — state changes fill/stroke, not a settings table. */
function EngineChip({ state }: { state: State }) {
    const evaluating = state === "evaluating";
    const approved = state === "approved";
    const blocked = state === "blocked";
    const coreStroke = approved ? "var(--green)" : blocked ? "var(--amber)" : evaluating ? SIGNAL : MID;
    const coreFill = approved
        ? "color-mix(in srgb, var(--green) 12%, transparent)"
        : blocked
          ? "color-mix(in srgb, var(--amber) 10%, transparent)"
          : evaluating
            ? "color-mix(in srgb, var(--primary) 10%, transparent)"
            : "transparent";

    return (
        <InstrumentPlate
            tone={approved ? "matched" : blocked ? "blocked" : evaluating ? "live" : "idle"}
            accentTicks={approved}
            hatchAccent={evaluating || approved}
            className="flex min-h-[9.5rem] flex-[1.15] flex-col p-5"
        >
            <PlateLabel>Engine</PlateLabel>
            <div className="mt-4 flex flex-1 flex-col items-center justify-center">
                <svg viewBox="0 0 120 72" className="h-16 w-full max-w-[11rem]" aria-hidden>
                    <g stroke={MID} strokeWidth="1">
                        <path d="M18 24 H8 M18 36 H8 M18 48 H8" />
                        <path d="M102 24 H112 M102 36 H112 M102 48 H112" />
                    </g>
                    <rect x="18" y="14" width="84" height="44" stroke={MID} strokeWidth="1.25" fill="color-mix(in srgb, var(--primary) 5%, transparent)" />
                    <rect x="38" y="24" width="44" height="24" stroke={coreStroke} strokeWidth="1.5" fill={coreFill} />
                    {(evaluating || approved) && (
                        <path
                            d="M38 36 H82"
                            stroke={coreStroke}
                            strokeWidth="1.25"
                            strokeDasharray={approved ? undefined : "3 6"}
                            className={evaluating ? "current" : undefined}
                        />
                    )}
                </svg>
                <div className="relative mt-3 h-5 w-full overflow-hidden text-center">
                    <motion.span
                        className="absolute inset-0 flex items-center justify-center font-mono text-[12px]"
                        initial={false}
                        animate={{
                            opacity: state === "idle" ? 1 : 0,
                            y: state === "idle" ? 0 : 4,
                        }}
                        transition={uiIn}
                    >
                        <span className="text-text-faint">awaiting request</span>
                    </motion.span>
                    <motion.span
                        className="absolute inset-0 flex items-center justify-center font-mono text-[12px]"
                        initial={false}
                        animate={{
                            opacity: evaluating ? 1 : 0,
                            y: evaluating ? 0 : 4,
                        }}
                        transition={uiIn}
                    >
                        <span className="text-text-muted">verifying…</span>
                    </motion.span>
                    <motion.span
                        className="absolute inset-0 flex items-center justify-center font-mono text-[12px]"
                        initial={false}
                        animate={{
                            opacity: approved ? 1 : 0,
                            y: approved ? 0 : 4,
                        }}
                        transition={settle}
                    >
                        <span className="text-green">Backing verified</span>
                    </motion.span>
                    <motion.span
                        className="absolute inset-0 flex items-center justify-center font-mono text-[12px]"
                        initial={false}
                        animate={{
                            opacity: blocked ? 1 : 0,
                            y: blocked ? 0 : 4,
                        }}
                        transition={settle}
                    >
                        <span className="text-amber">Not verifiable</span>
                    </motion.span>
                </div>
            </div>
        </InstrumentPlate>
    );
}

/** Vault gate — posts + crossbar. Lifts on approve, drops on block. */
function VaultGate({ state }: { state: State }) {
    const approved = state === "approved";
    const blocked = state === "blocked";
    const barY = approved ? 18 : blocked ? 42 : 34;

    return (
        <InstrumentPlate
            tone={approved ? "matched" : blocked ? "blocked" : "idle"}
            accentTicks={approved}
            className="flex min-h-[9.5rem] flex-1 flex-col p-5"
        >
            <PlateLabel>Protocol</PlateLabel>
            <div className="mt-3 flex flex-1 flex-col items-center justify-center">
                <svg viewBox="0 0 140 72" className="h-[4.5rem] w-full max-w-[12rem]" aria-hidden>
                    <path d="M8 52 H132" stroke={FAINT} strokeWidth="1" />
                    {/* posts */}
                    <path d="M42 58 V22" stroke={MID} strokeWidth="1.5" />
                    <path d="M98 58 V22" stroke={MID} strokeWidth="1.5" />
                    {/* crossbar — mechanical */}
                    <motion.rect
                        x="38"
                        width="64"
                        height="5"
                        rx="0"
                        fill={approved ? "var(--green)" : blocked ? "var(--amber)" : MID}
                        initial={false}
                        animate={{ y: barY, opacity: approved ? 1 : blocked ? 0.9 : 0.55 }}
                        transition={settle}
                    />
                    {/* latch mark */}
                    <motion.circle
                        cx="70"
                        cy="52"
                        r="5"
                        fill="none"
                        stroke={approved ? "var(--green)" : blocked ? "var(--amber)" : MID}
                        strokeWidth="1.25"
                        animate={{ opacity: approved || blocked ? 1 : 0.4 }}
                        transition={uiIn}
                    />
                    {approved && (
                        <path
                            d="M66 52 l2.5 2.5 L75 48"
                            stroke="var(--green)"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            fill="none"
                        />
                    )}
                    {blocked && (
                        <text x="70" y="56" textAnchor="middle" fill="var(--amber)" fontSize="9" fontFamily="var(--font-mono), monospace">
                            ×
                        </text>
                    )}
                </svg>
                <div className="relative mt-2 h-5 w-full overflow-hidden text-center">
                    <motion.span
                        className="absolute inset-0 flex items-center justify-center font-mono text-[12px] text-text-faint"
                        initial={false}
                        animate={{ opacity: state === "idle" || state === "evaluating" ? 1 : 0 }}
                        transition={uiIn}
                    >
                        standing by
                    </motion.span>
                    <motion.span
                        className="absolute inset-0 flex items-center justify-center font-mono text-[12px] text-green"
                        initial={false}
                        animate={{ opacity: approved ? 1 : 0 }}
                        transition={settle}
                    >
                        deposit executed
                    </motion.span>
                    <motion.span
                        className="absolute inset-0 flex items-center justify-center font-mono text-[12px] text-amber"
                        initial={false}
                        animate={{ opacity: blocked ? 1 : 0 }}
                        transition={settle}
                    >
                        deposit held back
                    </motion.span>
                </div>
            </div>
        </InstrumentPlate>
    );
}

export default function AgentRouter() {
    const [state, setState] = useState<State>("idle");
    const [asset, setAsset] = useState<"BENJI" | "OUSG">("BENJI");

    useEffect(() => {
        if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
        let cancelled = false;
        const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
        const run = async () => {
            while (!cancelled) {
                setAsset("BENJI");
                setState("evaluating");
                await wait(2400);
                if (cancelled) return;
                setState("approved");
                await wait(3400);
                if (cancelled) return;
                setState("idle");
                await wait(800);
                setAsset("OUSG");
                setState("evaluating");
                await wait(2400);
                if (cancelled) return;
                setState("blocked");
                await wait(3400);
                if (cancelled) return;
                setState("idle");
                await wait(800);
            }
        };
        run();
        return () => {
            cancelled = true;
        };
    }, []);

    const evaluating = state === "evaluating";
    const approved = state === "approved";
    const blocked = state === "blocked";

    const outMode = approved ? "settled" : blocked ? "broken" : "idle";
    const inLive = state !== "idle";

    return (
        <InstrumentBoard fig="FIG. 03 · GATE" className="mx-auto">
            <div className="flex flex-col items-stretch gap-4 sm:flex-row sm:items-center sm:gap-2 lg:gap-3">
                <InstrumentPlate tone={inLive ? "live" : "idle"} className="flex min-h-[9.5rem] flex-1 flex-col p-5">
                    <PlateLabel>Agent</PlateLabel>
                    <div className="mt-4 flex flex-1 flex-col justify-center">
                        <div className="flex items-center gap-3">
                            <svg width="28" height="28" viewBox="0 0 28 28" aria-hidden>
                                <circle cx="14" cy="14" r="8" stroke={MID} strokeWidth="1.25" fill="none" />
                                <circle cx="14" cy="14" r="3" fill={evaluating || approved ? SIGNAL : MID} className={evaluating ? "trace-node" : undefined} />
                            </svg>
                            <div>
                                <div className="text-sm font-medium text-text">Intent: deposit</div>
                                <div className="mt-0.5 font-mono text-[12px] text-text-faint">target: {asset}</div>
                            </div>
                        </div>
                    </div>
                </InstrumentPlate>

                <div className="flex justify-center sm:hidden">
                    <BusTrace mode={inLive ? "flow" : "idle"} vertical />
                </div>
                <div className="hidden w-10 shrink-0 sm:block lg:w-14">
                    <BusTrace mode={inLive ? "flow" : "idle"} />
                </div>

                <EngineChip state={state} />

                <div className="flex justify-center sm:hidden">
                    <BusTrace mode={outMode === "idle" ? "idle" : outMode} vertical />
                </div>
                <div className="hidden w-10 shrink-0 sm:block lg:w-14">
                    <BusTrace mode={outMode} />
                </div>

                <VaultGate state={state} />
            </div>

            <div className="mt-8 border-t border-white/10 pt-5">
                <div className="relative min-h-[2.75rem] overflow-hidden">
                    {(
                        [
                            {
                                key: "idle",
                                show: state === "idle",
                                text: "Every deposit is checked before it routes.",
                            },
                            {
                                key: "evaluating",
                                show: evaluating,
                                text: `Reading backing and market risk for ${asset}…`,
                            },
                            {
                                key: "approved",
                                show: approved,
                                text: "Backing reconciles against a regulator filing, so I let the deposit through with its trust boundary attached.",
                            },
                            {
                                key: "blocked",
                                show: blocked,
                                text: "I cannot verify the reserves independently, so I hold the deposit and hand back the reason instead of a silent failure.",
                            },
                        ] as const
                    ).map((row) => (
                        <motion.p
                            key={row.key}
                            className="absolute inset-0 text-[13px] leading-relaxed text-text-muted"
                            initial={false}
                            animate={{
                                clipPath: row.show ? "inset(0% 0% 0% 0%)" : "inset(0% 0% 0% 100%)",
                                opacity: row.show ? 1 : 0,
                            }}
                            transition={row.show ? settle : uiIn}
                        >
                            {row.text}
                        </motion.p>
                    ))}
                </div>
            </div>
        </InstrumentBoard>
    );
}
