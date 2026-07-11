/* -----------------------------------------------------------------------------
   Blueprint — engineering-drawing registration chrome.
   -----------------------------------------------------------------------------
   Decorative overlay: corner crosshairs, faint grid, a huge faint section number,
   a coordinate tag, and optional leader-line part labels. All chrome is
   pointer-events-none + aria-hidden so it never blocks interaction. Children
   render normally beneath it.
--------------------------------------------------------------------------------*/

import type { ReactNode } from "react";

const LINE = "rgba(244,243,239,0.16)";
const GHOST = "rgba(244,243,239,0.05)";

export type Leader = {
    /** Anchor point of the label text, in % of the frame. */
    at: [number, number];
    /** Point the leader line targets, in % of the frame. */
    to: [number, number];
    text: string;
};

function Crosshair({ style }: { style: React.CSSProperties }) {
    return (
        <svg width="16" height="16" viewBox="0 0 16 16" style={{ position: "absolute", ...style }} aria-hidden>
            <line x1="8" y1="0" x2="8" y2="16" stroke={LINE} strokeWidth="1" />
            <line x1="0" y1="8" x2="16" y2="8" stroke={LINE} strokeWidth="1" />
        </svg>
    );
}

export default function Blueprint({
    children,
    section,
    tag,
    label,
    grid = true,
    leaders = [],
    inset = 20,
    className = "",
}: {
    children?: ReactNode;
    /** Big faint section index, e.g. "01". */
    section?: string;
    /** Coordinate tag, e.g. "X219129". */
    tag?: string;
    /** Small mono caption, e.g. "§ THE CLAIM". */
    label?: string;
    grid?: boolean;
    leaders?: Leader[];
    /** Crosshair inset from the edges, px. */
    inset?: number;
    className?: string;
}) {
    return (
        <div className={`relative ${className}`}>
            {/* faint viewport grid */}
            {grid && (
                <div
                    className="pointer-events-none absolute inset-0"
                    aria-hidden
                    style={{
                        backgroundImage: `linear-gradient(${GHOST} 1px, transparent 1px), linear-gradient(90deg, ${GHOST} 1px, transparent 1px)`,
                        backgroundSize: "72px 72px",
                    }}
                />
            )}

            {/* corner crosshairs */}
            <Crosshair style={{ left: inset - 8, top: inset - 8 }} />
            <Crosshair style={{ right: inset - 8, top: inset - 8 }} />
            <Crosshair style={{ left: inset - 8, bottom: inset - 8 }} />
            <Crosshair style={{ right: inset - 8, bottom: inset - 8 }} />

            {/* huge ghost section number */}
            {section && (
                <span
                    className="font-display pointer-events-none absolute select-none"
                    aria-hidden
                    style={{
                        right: inset + 6,
                        top: inset + 4,
                        fontSize: "clamp(56px, 9vw, 132px)",
                        lineHeight: 1,
                        color: GHOST,
                    }}
                >
                    {section}
                </span>
            )}

            {/* top-left label + top-right coordinate tag */}
            {label && (
                <span
                    className="label pointer-events-none absolute"
                    style={{ left: inset + 6, top: inset - 2 }}
                >
                    {label}
                </span>
            )}
            {tag && (
                <span
                    className="coordinate pointer-events-none absolute"
                    style={{ right: inset + 6, bottom: inset - 2 }}
                >
                    {tag}
                </span>
            )}

            {/* leader-line part labels */}
            {leaders.length > 0 && (
                <svg
                    className="pointer-events-none absolute inset-0 h-full w-full"
                    preserveAspectRatio="none"
                    aria-hidden
                >
                    {leaders.map((l, i) => (
                        <g key={i}>
                            <line
                                x1={`${l.to[0]}%`}
                                y1={`${l.to[1]}%`}
                                x2={`${l.at[0]}%`}
                                y2={`${l.at[1]}%`}
                                stroke={LINE}
                                strokeWidth="1"
                            />
                            <circle cx={`${l.to[0]}%`} cy={`${l.to[1]}%`} r="2" fill={LINE} />
                        </g>
                    ))}
                </svg>
            )}
            {leaders.map((l, i) => (
                <span
                    key={i}
                    className="coordinate pointer-events-none absolute"
                    aria-hidden
                    style={{ left: `${l.at[0]}%`, top: `${l.at[1]}%`, transform: "translate(6px, -50%)" }}
                >
                    {l.text}
                </span>
            ))}

            {children}
        </div>
    );
}
