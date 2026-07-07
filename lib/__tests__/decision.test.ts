// The decision engine: reachability filtering + safety-first ranking. These are
// the rules that make the tool "more than a list", so they are tested directly.
import { decide, evaluate, type AssetSummary, type UserProfile } from "@/lib/decision";
import type { Flag, Jurisdiction } from "@/lib/contracts";

function a(
    symbol: string,
    opts: {
        jurisdiction: Jurisdiction | null;
        min?: number | null;
        yield_apy?: number | null;
        flag?: Flag;
    },
): AssetSummary {
    return {
        asset_id: `1:0x${symbol}`,
        symbol,
        name: symbol,
        chain_id: 1,
        jurisdiction: opts.jurisdiction,
        min_investment_usd: opts.min ?? null,
        yield_apy: opts.yield_apy ?? null,
        redemption_speed: null,
        backing_flag: opts.flag ?? "unknown",
        backing_reason: "",
        backing_confidence: "verified",
        trust_boundary: null,
    };
}

const BENJI = a("BENJI", { jurisdiction: "us_retail", yield_apy: 4.2, flag: "green" });
const SDAI = a("sDAI", { jurisdiction: "permissionless", yield_apy: 6.5, flag: "unknown" });
const USDY = a("USDY", { jurisdiction: "non_us_only", yield_apy: 4.65, flag: "amber" });
const BUIDL = a("BUIDL", { jurisdiction: "us_qualified_purchaser", min: 5_000_000, yield_apy: 4.3, flag: "amber" });

const UNIVERSE = [SDAI, BENJI, USDY, BUIDL];

describe("evaluate — reachability", () => {
    it("closes an asset restricted to a jurisdiction the user isn't in", () => {
        const r = evaluate(USDY, { jurisdiction: "us_retail", amount: "1k_10k" });
        expect(r).toMatchObject({ reason: expect.stringMatching(/non-US/i) });
    });

    it("closes an asset whose minimum exceeds the user's amount", () => {
        const r = evaluate(BUIDL, { jurisdiction: "us_qualified_purchaser", amount: "100k_1m" });
        expect(r).toMatchObject({ reason: expect.stringMatching(/\$5M minimum/i) });
    });

    it("opens the same asset when the amount clears the minimum", () => {
        const r = evaluate(BUIDL, { jurisdiction: "us_qualified_purchaser", amount: "over_1m" });
        expect(r).not.toHaveProperty("reason");
    });

    it("permissionless is reachable by anyone but flags an unconfirmed minimum", () => {
        const r = evaluate(SDAI, { jurisdiction: "us_retail", amount: "under_1k" });
        expect(r).not.toHaveProperty("reason");
        expect((r as { caveats: string[] }).caveats).toEqual(
            expect.arrayContaining([expect.stringMatching(/minimum/i)]),
        );
    });
});

describe("decide — safety-first ranking", () => {
    it("US retail: reaches BENJI + sDAI, closes non-US and QP-only", () => {
        const profile: UserProfile = { jurisdiction: "us_retail", amount: "1k_10k" };
        const { reachable, closed } = decide(UNIVERSE, profile);
        expect(reachable.map((r) => r.asset.symbol)).toEqual(["BENJI", "sDAI"]);
        expect(closed.map((c) => c.asset.symbol).sort()).toEqual(["BUIDL", "USDY"]);
    });

    it("safety leads over yield: green BENJI ranks above higher-yield unknown sDAI", () => {
        const { reachable } = decide(UNIVERSE, { jurisdiction: "us_retail", amount: "1k_10k" });
        expect(reachable[0].asset.symbol).toBe("BENJI"); // 4.2%, green
        expect(reachable[1].asset.symbol).toBe("sDAI"); // 6.5%, unknown — yield loses to safety
    });

    it("non-US user reaches USDY + sDAI, not the US funds", () => {
        const { reachable } = decide(UNIVERSE, { jurisdiction: "non_us", amount: "10k_100k" });
        expect(reachable.map((r) => r.asset.symbol).sort()).toEqual(["USDY", "sDAI"].sort());
    });
});
