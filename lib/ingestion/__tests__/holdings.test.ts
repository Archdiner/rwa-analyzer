import {
    leafBackingIndependence,
    instrumentsIndependence,
    buildHoldingsEvidence,
    type ValuedHolding,
} from "@/lib/ingestion/holdings";
import type { HeldInstrument, ReserveWalletEntry } from "@/lib/ingestion/adapters/reserves-registry";

function entry(instruments: HeldInstrument[]): ReserveWalletEntry {
    return { walletChainId: 1, wallets: ["0x0000000000000000000000000000000000000001"], instruments, note: "test" };
}
function inst(over: Partial<HeldInstrument> & Pick<HeldInstrument, "kind">): HeldInstrument {
    return {
        label: over.label ?? "X",
        token: over.token ?? "0x0000000000000000000000000000000000000002",
        chainId: over.chainId ?? 1,
        kind: over.kind,
        assetId: over.assetId,
        usdPerToken: over.usdPerToken,
    };
}

const FUND = "1:0xfund";
const BUIDL = "1:0xbuidl";
const PROVEN = "1:0xproven";

describe("leafBackingIndependence (anti-laundering ceiling)", () => {
    it("a proven leaf confers full independence", () => {
        expect(leafBackingIndependence(PROVEN, new Set([PROVEN]), {})).toBe(5);
    });

    it("an untracked RWA token cannot be independently proven (1)", () => {
        expect(leafBackingIndependence(BUIDL, new Set(), {})).toBe(1);
    });

    it("holding an unproven RWA (BUIDL) ceilings the holder at 1 - no laundering", () => {
        const wallets = { [FUND]: entry([inst({ kind: "rwa_token", assetId: BUIDL, label: "BUIDL" })]) };
        expect(leafBackingIndependence(FUND, new Set(), wallets)).toBe(1);
    });

    it("holding cash/Treasuries with proof reaches 5", () => {
        const wallets = { [FUND]: entry([inst({ kind: "cash_treasury_proven", label: "T-bills" })]) };
        expect(leafBackingIndependence(FUND, new Set(), wallets)).toBe(5);
    });

    it("weakest link governs a mixed reserve", () => {
        const wallets = {
            [FUND]: entry([
                inst({ kind: "cash_treasury_proven", label: "T-bills" }),
                inst({ kind: "rwa_token", assetId: BUIDL, label: "BUIDL" }),
            ]),
        };
        expect(leafBackingIndependence(FUND, new Set(), wallets)).toBe(1);
    });

    it("is cycle-safe (A holds B, B holds A -> finite, proves nothing)", () => {
        const A = "1:0xaaa";
        const B = "1:0xbbb";
        const wallets = {
            [A]: entry([inst({ kind: "rwa_token", assetId: B, label: "B" })]),
            [B]: entry([inst({ kind: "rwa_token", assetId: A, label: "A" })]),
        };
        expect(leafBackingIndependence(A, new Set(), wallets)).toBe(0);
    });

    it("instrumentsIndependence of an empty reserve is 0", () => {
        expect(instrumentsIndependence([], new Set(), {})).toBe(0);
    });
});

describe("buildHoldingsEvidence", () => {
    it("returns null when nothing is readable", () => {
        expect(buildHoldingsEvidence([], 100, "2026-07-07T00:00:00Z")).toBeNull();
        expect(
            buildHoldingsEvidence([{ label: "X", balanceUsd: 0, independence: 5 }], 100, "2026-07-07T00:00:00Z"),
        ).toBeNull();
    });

    it("sums reserves, takes the weakest-link independence, and measures coverage", () => {
        const holdings: ValuedHolding[] = [
            { label: "BUIDL", balanceUsd: 88, independence: 1 },
            { label: "USDC", balanceUsd: 3, independence: 2 },
        ];
        const e = buildHoldingsEvidence(holdings, 100, "2026-07-07T00:00:00Z")!;
        expect(e.reserves_value).toBe(91);
        expect(e.independence).toBe(1);
        expect(Math.round(e.coverage_pct)).toBe(91);
        expect(e.source_type).toBe("onchain_holdings");
        expect(e.extraction).toBe("onchain_read");
        expect(e.note).toMatch(/not independently proven/i);
    });

    it("caps coverage at 100% and marks proven composition", () => {
        const e = buildHoldingsEvidence(
            [{ label: "T-bills", balanceUsd: 120, independence: 5 }],
            100,
            "2026-07-07T00:00:00Z",
        )!;
        expect(e.coverage_pct).toBe(100);
        expect(e.independence).toBe(5);
    });
});
