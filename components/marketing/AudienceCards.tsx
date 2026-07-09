/* -----------------------------------------------------------------------------
   Audience cards - "Who this is for".
   -----------------------------------------------------------------------------
   Each audience gets a small hand-placed schematic in the same blueprint
   vocabulary as the rest of the site (faint board layer, one live brass signal
   carrying a slow current). Server component: pure SVG + CSS, no JS.
--------------------------------------------------------------------------------*/

const FAINT = "rgba(245,244,242,0.14)";
const MID = "rgba(245,244,242,0.3)";
const SIGNAL = "var(--primary)";
const MONO = "var(--font-mono), monospace";

/** A call goes into the engine, a verdict comes back, a gate acts on it. */
function AgentGlyph() {
    return (
        <svg viewBox="0 0 180 96" fill="none" className="h-full w-full" aria-hidden>
            {/* agent */}
            <circle cx="26" cy="48" r="7" stroke={MID} strokeWidth="1.25" />
            <circle cx="26" cy="48" r="2" fill={MID} />
            {/* wire in */}
            <path d="M33 48 H66" stroke={FAINT} strokeWidth="1" />
            <path d="M33 48 H66" stroke={SIGNAL} strokeWidth="1.25" strokeDasharray="3 8" className="current" />
            {/* engine chip */}
            <rect x="66" y="30" width="48" height="36" rx="6" stroke={MID} strokeWidth="1.25" fill="color-mix(in srgb, var(--primary) 6%, transparent)" />
            <rect x="80" y="41" width="20" height="14" rx="2" stroke={SIGNAL} strokeWidth="1.25" />
            <path d="M66 40 H60 M66 56 H60 M114 40 H120 M114 56 H120" stroke={MID} strokeWidth="1" />
            {/* wire out */}
            <path d="M114 48 H150" stroke={FAINT} strokeWidth="1" />
            <path d="M114 48 H150" stroke={SIGNAL} strokeWidth="1.25" strokeDasharray="3 8" className="current" />
            {/* verdict node */}
            <circle cx="156" cy="48" r="5.5" fill="none" stroke={SIGNAL} strokeWidth="1" opacity="0.4" />
            <circle cx="156" cy="48" r="3" fill={SIGNAL} className="trace-node" />
            {/* labels */}
            <text x="26" y="74" textAnchor="middle" fontFamily={MONO} fontSize="8" letterSpacing="1" fill="rgba(245,244,242,0.42)">CALL</text>
            <text x="156" y="74" textAnchor="middle" fontFamily={MONO} fontSize="8" letterSpacing="1" fill="rgba(245,244,242,0.42)">VERDICT</text>
        </svg>
    );
}

/** A wallet earn-row: a yield value, a verified seal, and the trust boundary
    drawn right beneath the number - the thing an earn tab never shows. */
function WalletGlyph() {
    return (
        <svg viewBox="0 0 180 96" fill="none" className="h-full w-full" aria-hidden>
            {/* the earn-row panel */}
            <rect x="16" y="18" width="148" height="60" rx="10" stroke={MID} strokeWidth="1.25" fill="color-mix(in srgb, var(--primary) 4%, transparent)" />
            {/* the yield value (abstracted as a solid bar) */}
            <rect x="32" y="35" width="58" height="7" rx="3.5" fill="rgba(245,244,242,0.75)" />
            {/* verified seal beside the value */}
            <circle cx="132" cy="38" r="9" stroke="var(--green)" strokeWidth="1.25" fill="color-mix(in srgb, var(--green) 8%, transparent)" />
            <path d="M127 38 l3.5 3.5 L138 34" stroke="var(--green)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            {/* trust boundary drawn under the value */}
            <line x1="32" y1="58" x2="98" y2="58" stroke="var(--green)" strokeWidth="2" strokeLinecap="round" />
            <circle cx="98" cy="58" r="3" fill="var(--green)" />
            <line x1="98" y1="58" x2="148" y2="58" stroke={MID} strokeWidth="1" strokeDasharray="2 6" />
        </svg>
    );
}

/** A gate on the deposit path that only opens on proof. */
function TreasuryGlyph() {
    return (
        <svg viewBox="0 0 180 96" fill="none" className="h-full w-full" aria-hidden>
            {/* deposit flow */}
            <path d="M16 54 H164" stroke={FAINT} strokeWidth="1" />
            <path d="M16 54 H74" stroke={SIGNAL} strokeWidth="1.25" strokeDasharray="3 8" className="current" />
            <path d="M106 54 H164" stroke={SIGNAL} strokeWidth="1.25" strokeDasharray="3 8" className="current" />
            {/* gate posts + lifted crossbar (open) */}
            <path d="M66 66 V40" stroke={MID} strokeWidth="1.25" />
            <path d="M114 66 V40" stroke={MID} strokeWidth="1.25" />
            <path d="M62 30 H118" stroke={MID} strokeWidth="1.25" />
            <path d="M66 40 V34 M114 40 V34" stroke={FAINT} strokeWidth="1" />
            {/* proof check at the gate */}
            <circle cx="90" cy="54" r="9" fill="color-mix(in srgb, var(--primary) 8%, transparent)" stroke={SIGNAL} strokeWidth="1.25" />
            <path d="M85 54 l3.5 3.5 L96 50" stroke="var(--green)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            {/* labels */}
            <text x="16" y="80" fontFamily={MONO} fontSize="8" letterSpacing="1" fill="rgba(245,244,242,0.42)">DEPOSIT</text>
            <text x="90" y="22" textAnchor="middle" fontFamily={MONO} fontSize="8" letterSpacing="1" fill="rgba(245,244,242,0.42)">GATE</text>
        </svg>
    );
}

const CARDS = [
    {
        who: "Agents & MCP hosts",
        why: "Call check_asset_backing before routing. Get tier, market_risk, freshness, and caveats back, not a vibe check.",
        Glyph: AgentGlyph,
    },
    {
        who: "Wallets & earn UIs",
        why: "Show the trust boundary right under the APY, so a user sees exactly what they are trusting for that yield.",
        Glyph: WalletGlyph,
    },
    {
        who: "Treasury & ops",
        why: "Gate large deposits on independent proof. When reserves cannot be verified, hold and explain instead of guessing green.",
        Glyph: TreasuryGlyph,
    },
];

export default function AudienceCards() {
    return (
        <div className="grid gap-5 sm:grid-cols-3">
            {CARDS.map(({ who, why, Glyph }) => (
                <div key={who} className="card flex flex-col p-6">
                    <div className="h-24 w-full rounded-xl border border-border bg-white/[0.015] p-3">
                        <Glyph />
                    </div>
                    <h3 className="mt-5 text-sm font-medium text-text">{who}</h3>
                    <p className="mt-2 text-[13px] leading-relaxed text-text-muted">{why}</p>
                </div>
            ))}
        </div>
    );
}
