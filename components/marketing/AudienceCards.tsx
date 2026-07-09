"use client";

import { useState, type ReactNode } from "react";
import { motion } from "framer-motion";
import { CornerTicks, FAINT, MID, SIGNAL } from "./Instrument";
import { settle, uiIn } from "./motion-tokens";

const MONO = "var(--font-mono), monospace";

/** CALL → chip → VERDICT. Signal flows only while hovered. */
function AgentGlyph({ live }: { live: boolean }) {
    return (
        <svg viewBox="0 0 180 96" fill="none" className="h-full w-full" aria-hidden>
            <circle cx="26" cy="48" r="7" stroke={MID} strokeWidth="1.25" />
            <circle cx="26" cy="48" r="2" fill={live ? SIGNAL : MID} />
            <path d="M33 48 H66" stroke={FAINT} strokeWidth="1" />
            <path d="M114 48 H150" stroke={FAINT} strokeWidth="1" />
            {live && (
                <>
                    <path d="M33 48 H66" stroke={SIGNAL} strokeWidth="1.25" strokeDasharray="4 10" className="current" />
                    <path d="M114 48 H150" stroke={SIGNAL} strokeWidth="1.25" strokeDasharray="4 10" className="current" />
                </>
            )}
            <rect
                x="66"
                y="30"
                width="48"
                height="36"
                stroke={live ? SIGNAL : MID}
                strokeWidth="1.25"
                fill="color-mix(in srgb, var(--primary) 6%, transparent)"
            />
            <rect x="80" y="41" width="20" height="14" stroke={SIGNAL} strokeWidth="1.25" opacity={live ? 1 : 0.4} />
            <path d="M66 40 H60 M66 56 H60 M114 40 H120 M114 56 H120" stroke={MID} strokeWidth="1" />
            <circle cx="156" cy="48" r="5.5" fill="none" stroke={SIGNAL} strokeWidth="1" opacity={live ? 0.55 : 0.25} />
            <circle cx="156" cy="48" r="3" fill={live ? SIGNAL : MID} />
            <text x="26" y="74" textAnchor="middle" fontFamily={MONO} fontSize="8" letterSpacing="1" fill="rgba(245,244,242,0.42)">
                CALL
            </text>
            <text x="156" y="74" textAnchor="middle" fontFamily={MONO} fontSize="8" letterSpacing="1" fill="rgba(245,244,242,0.42)">
                VERDICT
            </text>
        </svg>
    );
}

/** Trust boundary draws under APY on hover; beyond the node stays dashed. */
function WalletGlyph({ live }: { live: boolean }) {
    return (
        <svg viewBox="0 0 180 96" fill="none" className="h-full w-full" aria-hidden>
            <rect
                x="16"
                y="18"
                width="148"
                height="60"
                stroke={MID}
                strokeWidth="1.25"
                fill="color-mix(in srgb, var(--primary) 4%, transparent)"
            />
            <rect x="32" y="35" width="58" height="7" fill="rgba(245,244,242,0.75)" />
            <circle
                cx="132"
                cy="38"
                r="9"
                stroke={live ? "var(--green)" : MID}
                strokeWidth="1.25"
                fill={live ? "color-mix(in srgb, var(--green) 8%, transparent)" : "transparent"}
            />
            {live && (
                <path
                    d="M127 38 l3.5 3.5 L138 34"
                    stroke="var(--green)"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />
            )}
            <motion.line
                x1="32"
                y1="58"
                y2="58"
                stroke="var(--green)"
                strokeWidth="2"
                strokeLinecap="round"
                initial={false}
                animate={{ x2: live ? 98 : 32 }}
                transition={settle}
            />
            <motion.circle
                cx="98"
                cy="58"
                r="3"
                fill="var(--green)"
                initial={false}
                animate={{ opacity: live ? 1 : 0 }}
                transition={uiIn}
            />
            <line
                x1="98"
                y1="58"
                x2="148"
                y2="58"
                stroke={MID}
                strokeWidth="1"
                strokeDasharray="2 6"
                opacity={live ? 1 : 0.35}
            />
        </svg>
    );
}

/** Gate crossbar lifts on hover (open), drops on leave. */
function TreasuryGlyph({ live }: { live: boolean }) {
    return (
        <svg viewBox="0 0 180 96" fill="none" className="h-full w-full" aria-hidden>
            <path d="M16 54 H164" stroke={FAINT} strokeWidth="1" />
            {live && (
                <>
                    <path d="M16 54 H74" stroke={SIGNAL} strokeWidth="1.25" strokeDasharray="3 8" className="current" />
                    <path d="M106 54 H164" stroke="var(--green)" strokeWidth="1.25" />
                </>
            )}
            <path d="M66 66 V40" stroke={MID} strokeWidth="1.25" />
            <path d="M114 66 V40" stroke={MID} strokeWidth="1.25" />
            <motion.rect
                x="62"
                width="56"
                height="3"
                initial={false}
                animate={{
                    y: live ? 26 : 44,
                    fill: live ? "var(--green)" : MID,
                }}
                transition={settle}
            />
            <circle
                cx="90"
                cy="54"
                r="9"
                fill="color-mix(in srgb, var(--primary) 8%, transparent)"
                stroke={live ? SIGNAL : MID}
                strokeWidth="1.25"
            />
            {live && (
                <path
                    d="M85 54 l3.5 3.5 L96 50"
                    stroke="var(--green)"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />
            )}
            <text x="16" y="80" fontFamily={MONO} fontSize="8" letterSpacing="1" fill="rgba(245,244,242,0.42)">
                DEPOSIT
            </text>
            <text x="90" y="18" textAnchor="middle" fontFamily={MONO} fontSize="8" letterSpacing="1" fill="rgba(245,244,242,0.42)">
                GATE
            </text>
        </svg>
    );
}

const CARDS: {
    who: string;
    why: string;
    Glyph: (p: { live: boolean }) => ReactNode;
}[] = [
    {
        who: "Agents & MCP hosts",
        why: "Call check_asset_backing before routing. Get tier, freshness, and caveats back - not a vibe check.",
        Glyph: AgentGlyph,
    },
    {
        who: "Wallets & earn UIs",
        why: "Show the trust boundary under the APY, so a user sees exactly what they are trusting for that yield.",
        Glyph: WalletGlyph,
    },
    {
        who: "Treasury & ops",
        why: "Gate large deposits on independent proof. When reserves cannot be verified, hold and explain.",
        Glyph: TreasuryGlyph,
    },
];

function AudiencePlate({
    who,
    why,
    Glyph,
}: {
    who: string;
    why: string;
    Glyph: (p: { live: boolean }) => ReactNode;
}) {
    const [live, setLive] = useState(false);

    return (
        <article
            className="relative flex flex-col border border-white/12 bg-[#050505]/70 p-5 outline-none transition-[border-color] duration-150 focus-visible:border-white/30"
            style={{ borderColor: live ? "rgba(255,255,255,0.22)" : undefined }}
            onMouseEnter={() => setLive(true)}
            onMouseLeave={() => setLive(false)}
            onFocus={() => setLive(true)}
            onBlur={() => setLive(false)}
            tabIndex={0}
        >
            <CornerTicks accent={live} />
            <div className="relative h-28 w-full border border-white/10 bg-white/[0.015] p-3">
                <Glyph live={live} />
            </div>
            <h3 className="mt-5 font-mono text-[11px] uppercase tracking-[0.14em] text-text">{who}</h3>
            <p className="mt-2 text-[13px] leading-relaxed text-text-muted">{why}</p>
        </article>
    );
}

export default function AudienceCards() {
    return (
        <div className="grid gap-4 sm:grid-cols-3">
            {CARDS.map(({ who, why, Glyph }) => (
                <AudiencePlate key={who} who={who} why={why} Glyph={Glyph} />
            ))}
        </div>
    );
}
