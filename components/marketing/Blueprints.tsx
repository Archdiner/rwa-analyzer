/* -----------------------------------------------------------------------------
   Blueprint line-art
   -----------------------------------------------------------------------------
   Hand-drawn SVG illustrations in the spirit of a PCB / schematic. These are the
   crafted centerpiece of the visual language: orthogonal traces, vias, a chip,
   a converging node graph. Deliberately not generated - every path is placed.

   Convention: a very faint white "board" trace layer, one brass "signal" trace
   that draws in and carries a slow current. Everything scales with the viewBox.
--------------------------------------------------------------------------------*/

const FAINT = "rgba(245,244,242,0.14)";
const MID = "rgba(245,244,242,0.28)";
const SIGNAL = "var(--primary)";

/** PCB traces routing to a central chip. For the "RWA backing" card. */
export function CircuitTraces({ className = "" }: { className?: string }) {
    return (
        <svg viewBox="0 0 240 200" fill="none" className={className} aria-hidden>
            {/* board traces */}
            <g stroke={FAINT} strokeWidth="1">
                <path d="M4 40 H60 V70 H96" />
                <path d="M4 96 H40 V120 H96" />
                <path d="M4 160 H72 V132 H96" />
                <path d="M236 44 H188 V72 H144" />
                <path d="M236 110 H200 V96 H144" />
                <path d="M236 168 H176 V128 H144" />
                <path d="M120 4 V32 H96" />
                <path d="M120 196 V168 H108 V144" />
            </g>
            {/* vias */}
            <g fill={MID}>
                <circle cx="4" cy="40" r="2.5" />
                <circle cx="4" cy="96" r="2.5" />
                <circle cx="4" cy="160" r="2.5" />
                <circle cx="236" cy="44" r="2.5" />
                <circle cx="236" cy="110" r="2.5" />
                <circle cx="236" cy="168" r="2.5" />
                <circle cx="120" cy="4" r="2.5" />
                <circle cx="120" cy="196" r="2.5" />
            </g>
            {/* signal trace: a live path that draws in + carries current */}
            <path
                d="M4 96 H40 V120 H96"
                stroke={SIGNAL}
                strokeWidth="1.5"
                className="trace"
                style={{ ["--len" as string]: 120 }}
            />
            <path
                d="M4 96 H40 V120 H96"
                stroke={SIGNAL}
                strokeWidth="1.5"
                strokeDasharray="4 10"
                className="current"
                opacity="0.9"
            />
            {/* the chip */}
            <rect x="96" y="76" width="48" height="48" rx="6" stroke={MID} strokeWidth="1.25" fill="color-mix(in srgb, var(--primary) 8%, transparent)" />
            <rect x="108" y="88" width="24" height="24" rx="3" stroke={SIGNAL} strokeWidth="1.25" />
            {/* chip pins */}
            <g stroke={MID} strokeWidth="1">
                <path d="M96 88 H90 M96 100 H90 M96 112 H90" />
                <path d="M144 88 H150 M144 100 H150 M144 112 H150" />
            </g>
        </svg>
    );
}

/** A branching node network. For the "Lending markets" card. */
export function NodeFlow({ className = "" }: { className?: string }) {
    const nodes = [
        [40, 100],
        [110, 52],
        [110, 148],
        [180, 30],
        [180, 90],
        [180, 130],
        [180, 172],
    ] as const;
    return (
        <svg viewBox="0 0 240 200" fill="none" className={className} aria-hidden>
            <g stroke={FAINT} strokeWidth="1">
                <path d="M40 100 H80 V52 H110" />
                <path d="M40 100 H80 V148 H110" />
                <path d="M110 52 H150 V30 H180" />
                <path d="M110 52 H150 V90 H180" />
                <path d="M110 148 H150 V130 H180" />
                <path d="M110 148 H150 V172 H180" />
            </g>
            <path
                d="M40 100 H80 V52 H110 H150 V90 H180"
                stroke={SIGNAL}
                strokeWidth="1.5"
                strokeDasharray="4 10"
                className="current"
            />
            {nodes.map(([x, y], i) => (
                <g key={i}>
                    <circle cx={x} cy={y} r="4" fill="color-mix(in srgb, var(--primary) 10%, transparent)" stroke={i === 0 ? SIGNAL : MID} strokeWidth="1.25" />
                    {i === 0 && <circle cx={x} cy={y} r="8" stroke={SIGNAL} strokeWidth="1" opacity="0.4" />}
                </g>
            ))}
        </svg>
    );
}

/** Concentric squares spiralling inward. For the "Staking / reserve" card. */
export function ConcentricVault({ className = "" }: { className?: string }) {
    const rings = [0, 1, 2, 3, 4];
    return (
        <svg viewBox="0 0 240 200" fill="none" className={className} aria-hidden>
            {rings.map((r) => {
                const inset = 24 + r * 16;
                return (
                    <rect
                        key={r}
                        x={inset}
                        y={inset - 12}
                        width={240 - inset * 2}
                        height={200 - (inset - 12) * 2}
                        rx="4"
                        stroke={r === rings.length - 1 ? SIGNAL : FAINT}
                        strokeWidth={r === rings.length - 1 ? 1.5 : 1}
                    />
                );
            })}
            {/* connector from edge into the core */}
            <path d="M4 100 H24" stroke={MID} strokeWidth="1" />
            <path
                d="M120 88 V112"
                stroke={SIGNAL}
                strokeWidth="1.5"
                strokeDasharray="3 8"
                className="current"
            />
            <circle cx="120" cy="100" r="3" fill={SIGNAL} className="trace-node" />
        </svg>
    );
}

/** A signal-schedule / emissions decay staircase. For the "Emissions" card. */
export function EmissionSteps({ className = "" }: { className?: string }) {
    return (
        <svg viewBox="0 0 240 200" fill="none" className={className} aria-hidden>
            <g stroke={FAINT} strokeWidth="1">
                <path d="M20 40 H60 V72 H100 V104 H140 V136 H180 V168 H220" />
            </g>
            <path
                d="M20 40 H60 V72 H100 V104 H140 V136 H180 V168 H220"
                stroke={SIGNAL}
                strokeWidth="1.5"
                strokeDasharray="4 10"
                className="current"
                opacity="0.85"
            />
            {/* baseline */}
            <path d="M20 176 H220" stroke={FAINT} strokeWidth="1" strokeDasharray="2 6" />
            {[
                [60, 72],
                [100, 104],
                [140, 136],
                [180, 168],
            ].map(([x, y], i) => (
                <circle key={i} cx={x} cy={y} r="3" fill={MID} />
            ))}
            <circle cx="20" cy="40" r="4" fill="color-mix(in srgb, var(--primary) 14%, transparent)" stroke={SIGNAL} strokeWidth="1.25" />
        </svg>
    );
}

/* -----------------------------------------------------------------------------
   RadialGraph - the Cantor8-style converging node graph. Thin lines from a
   dotted perimeter into a bright core, with a handful of mono labels.
--------------------------------------------------------------------------------*/

export function RadialGraph({
    className = "",
    labels = ["backing", "lending", "staking", "emissions", "amm fees", "perp funding"],
}: {
    className?: string;
    labels?: string[];
}) {
    const cx = 200;
    const cy = 200;
    const rDots = 176;
    const rLines = 170;

    // perimeter dots
    const dotCount = 72;
    const dots = Array.from({ length: dotCount }, (_, i) => {
        const a = (i / dotCount) * Math.PI * 2;
        return [cx + Math.cos(a) * rDots, cy + Math.sin(a) * rDots] as const;
    });

    // converging lines - deterministic pseudo-spread so it's dense but placed
    const lineCount = 64;
    const lines = Array.from({ length: lineCount }, (_, i) => {
        const a = (i / lineCount) * Math.PI * 2 + (i % 3) * 0.04;
        const rr = rLines * (0.62 + ((i * 37) % 40) / 100);
        return [cx + Math.cos(a) * rr, cy + Math.sin(a) * rr] as const;
    });

    // label anchors around the ring
    const anchors = labels.map((label, i) => {
        const a = (i / labels.length) * Math.PI * 2 - Math.PI / 2;
        return { label, x: cx + Math.cos(a) * (rDots + 8), y: cy + Math.sin(a) * (rDots + 8), a };
    });

    return (
        <svg viewBox="0 0 400 400" fill="none" className={className} aria-hidden>
            {/* converging lines */}
            <g stroke={FAINT} strokeWidth="0.75">
                {lines.map(([x, y], i) => (
                    <line key={i} x1={cx} y1={cy} x2={x} y2={y} />
                ))}
            </g>
            {/* a few live signal lines */}
            <g stroke={SIGNAL} strokeWidth="1" opacity="0.7">
                {lines
                    .filter((_, i) => i % 11 === 0)
                    .map(([x, y], i) => (
                        <line
                            key={i}
                            x1={cx}
                            y1={cy}
                            x2={x}
                            y2={y}
                            strokeDasharray="3 9"
                            className="current"
                        />
                    ))}
            </g>
            {/* perimeter dots */}
            <g fill={MID}>
                {dots.map(([x, y], i) => (
                    <circle key={i} cx={x} cy={y} r={i % 6 === 0 ? 1.6 : 1} />
                ))}
            </g>
            {/* bright core */}
            <circle cx={cx} cy={cy} r="6" fill="color-mix(in srgb, var(--primary) 16%, transparent)" stroke={SIGNAL} strokeWidth="1.25" />
            <circle cx={cx} cy={cy} r="2.5" fill={SIGNAL} className="trace-node" />
            {/* labels */}
            <g fill="rgba(245,244,242,0.5)" fontSize="9" fontFamily="var(--font-mono), monospace" letterSpacing="1">
                {anchors.map((n) => (
                    <text
                        key={n.label}
                        x={n.x}
                        y={n.y}
                        textAnchor={Math.cos(n.a) < -0.3 ? "end" : Math.cos(n.a) > 0.3 ? "start" : "middle"}
                        dominantBaseline="middle"
                    >
                        {n.label.toUpperCase()}
                    </text>
                ))}
            </g>
        </svg>
    );
}
