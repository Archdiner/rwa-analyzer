/* -----------------------------------------------------------------------------
   Blueprint line-art
   -----------------------------------------------------------------------------
   Hand-placed SVG schematics. Faint board layer always; signal current only when
   `active` (hover / live status) - never ambient screensaver loops.
--------------------------------------------------------------------------------*/

const FAINT = "rgba(245,244,242,0.14)";
const MID = "rgba(245,244,242,0.28)";
const SIGNAL = "var(--primary)";

type ArtProps = { className?: string; active?: boolean };

/** PCB traces routing to a central chip. For the "RWA backing" card. */
export function CircuitTraces({ className = "", active = false }: ArtProps) {
    return (
        <svg viewBox="0 0 240 200" fill="none" className={className} aria-hidden>
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
            {active && (
                <>
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
                </>
            )}
            {!active && (
                <path d="M4 96 H40 V120 H96" stroke={MID} strokeWidth="1" strokeDasharray="3 8" opacity="0.5" />
            )}
            <rect
                x="96"
                y="76"
                width="48"
                height="48"
                stroke={active ? SIGNAL : MID}
                strokeWidth="1.25"
                fill="color-mix(in srgb, var(--primary) 8%, transparent)"
            />
            <rect x="108" y="88" width="24" height="24" stroke={SIGNAL} strokeWidth="1.25" opacity={active ? 1 : 0.45} />
            <g stroke={MID} strokeWidth="1">
                <path d="M96 88 H90 M96 100 H90 M96 112 H90" />
                <path d="M144 88 H150 M144 100 H150 M144 112 H150" />
            </g>
        </svg>
    );
}

/** A branching node network. For the "Lending markets" card. */
export function NodeFlow({ className = "", active = false }: ArtProps) {
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
            {active ? (
                <path
                    d="M40 100 H80 V52 H110 H150 V90 H180"
                    stroke={SIGNAL}
                    strokeWidth="1.5"
                    strokeDasharray="4 10"
                    className="current"
                />
            ) : (
                <path d="M40 100 H80 V52 H110 H150 V90 H180" stroke={MID} strokeWidth="1" strokeDasharray="3 8" opacity="0.45" />
            )}
            {nodes.map(([x, y], i) => (
                <g key={i}>
                    <circle
                        cx={x}
                        cy={y}
                        r="4"
                        fill="color-mix(in srgb, var(--primary) 10%, transparent)"
                        stroke={i === 0 && active ? SIGNAL : MID}
                        strokeWidth="1.25"
                    />
                    {i === 0 && active && <circle cx={x} cy={y} r="8" stroke={SIGNAL} strokeWidth="1" opacity="0.4" />}
                </g>
            ))}
        </svg>
    );
}

/** Concentric squares spiralling inward. For the "Staking / reserve" card. */
export function ConcentricVault({ className = "", active = false }: ArtProps) {
    const rings = [0, 1, 2, 3, 4];
    return (
        <svg viewBox="0 0 240 200" fill="none" className={className} aria-hidden>
            {rings.map((r) => {
                const inset = 24 + r * 16;
                const core = r === rings.length - 1;
                return (
                    <rect
                        key={r}
                        x={inset}
                        y={inset - 12}
                        width={240 - inset * 2}
                        height={200 - (inset - 12) * 2}
                        stroke={core && active ? SIGNAL : FAINT}
                        strokeWidth={core && active ? 1.5 : 1}
                    />
                );
            })}
            <path d="M4 100 H24" stroke={MID} strokeWidth="1" />
            {active && (
                <path d="M120 88 V112" stroke={SIGNAL} strokeWidth="1.5" strokeDasharray="3 8" className="current" />
            )}
            <circle cx="120" cy="100" r="3" fill={active ? SIGNAL : MID} />
        </svg>
    );
}

/** A signal-schedule / emissions decay staircase. For the "Emissions" card. */
export function EmissionSteps({ className = "", active = false }: ArtProps) {
    return (
        <svg viewBox="0 0 240 200" fill="none" className={className} aria-hidden>
            <g stroke={FAINT} strokeWidth="1">
                <path d="M20 40 H60 V72 H100 V104 H140 V136 H180 V168 H220" />
            </g>
            {active ? (
                <path
                    d="M20 40 H60 V72 H100 V104 H140 V136 H180 V168 H220"
                    stroke={SIGNAL}
                    strokeWidth="1.5"
                    strokeDasharray="4 10"
                    className="current"
                    opacity="0.85"
                />
            ) : (
                <path
                    d="M20 40 H60 V72 H100 V104 H140 V136 H180 V168 H220"
                    stroke={MID}
                    strokeWidth="1"
                    strokeDasharray="3 8"
                    opacity="0.4"
                />
            )}
            <path d="M20 176 H220" stroke={FAINT} strokeWidth="1" strokeDasharray="2 6" />
            {[
                [60, 72],
                [100, 104],
                [140, 136],
                [180, 168],
            ].map(([x, y], i) => (
                <circle key={i} cx={x} cy={y} r="3" fill={MID} />
            ))}
            <circle
                cx="20"
                cy="40"
                r="4"
                fill="color-mix(in srgb, var(--primary) 14%, transparent)"
                stroke={active ? SIGNAL : MID}
                strokeWidth="1.25"
            />
        </svg>
    );
}
