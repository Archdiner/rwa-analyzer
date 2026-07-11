/* Deterministic transcript for the beat-4 verification terminal. Derived from
   the real BENJI reconciliation (supply × NAV against the SEC N-MFP filing).
   Kept static so the landing renders instantly and identically every time. */

export type TranscriptTone = "prompt" | "step" | "data" | "cite" | "ok";

export type TranscriptLine = {
    text: string;
    tone: TranscriptTone;
    /** Marks the verbatim-citation line (rendered as a green highlight). */
    cite?: boolean;
};

export const BENJI_SUPPLY = "47,838,681.95";
export const BENJI_NAV = "1.0000";
export const BENJI_PRODUCT = "$47,838,681.95";

export const BENJI_TRANSCRIPT: TranscriptLine[] = [
    { text: "$ rwa-verify benji --explain", tone: "prompt" },
    { text: "resolving asset  BENJI · Franklin OnChain U.S. Gov Money Fund", tone: "step" },
    { text: "reading on-chain supply  ethereum erc-20", tone: "step" },
    { text: `  supply = ${BENJI_SUPPLY} BENJI`, tone: "data" },
    { text: "locating filing  sec edgar", tone: "step" },
    { text: "  found N-MFP · Franklin Templeton · series S000073580", tone: "data" },
    { text: "extracting net asset value  verbatim", tone: "step" },
    { text: '  "…seeks to maintain a stable $1.00 net asset value per share."', tone: "cite", cite: true },
    { text: `  nav = $${BENJI_NAV} / share`, tone: "data" },
    { text: "reconciling  supply × nav", tone: "step" },
];

/** The final lock line, revealed once the scrub completes. */
export const BENJI_LOCK = {
    left: BENJI_SUPPLY,
    nav: `$${BENJI_NAV}`,
    product: BENJI_PRODUCT,
    tier: "verified_backed",
    confidence: "auto",
    freshness: "live",
};
