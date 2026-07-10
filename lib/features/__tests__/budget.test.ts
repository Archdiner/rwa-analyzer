/* eslint-disable @typescript-eslint/no-explicit-any */
import { remaining, spentOn, debit, canAfford, budgetDate, DAILY_BUDGET_USD } from "@/lib/features/budget";
import * as supa from "@/lib/supabase";

jest.mock("@/lib/supabase", () => ({ hasSupabase: jest.fn(), getSupabase: jest.fn() }));
const hasSupabase = supa.hasSupabase as jest.Mock;
const getSupabase = supa.getSupabase as jest.Mock;

function makeClient(result: { data: unknown; error: unknown }) {
    const b: any = {};
    for (const m of ["select", "eq"]) b[m] = jest.fn(() => b);
    b.maybeSingle = jest.fn(() => Promise.resolve(result));
    return { builder: b, from: jest.fn(() => b), rpc: jest.fn(() => Promise.resolve(result)) };
}

afterEach(() => jest.clearAllMocks());

describe("budget — degradation (unconfigured Supabase)", () => {
    beforeEach(() => hasSupabase.mockReturnValue(false));

    it("reports full budget, zero spend, and echoes debits without a client", async () => {
        expect(await spentOn("2026-07-10")).toBe(0);
        expect(await remaining("2026-07-10")).toBe(DAILY_BUDGET_USD);
        expect(await debit("2026-07-10", 0.02)).toBe(0.02);
        expect(getSupabase).not.toHaveBeenCalled();
    });
});

describe("budget — configured", () => {
    beforeEach(() => hasSupabase.mockReturnValue(true));

    it("remaining subtracts the day's spend", async () => {
        getSupabase.mockReturnValue(makeClient({ data: { spent_usd: 0.4 }, error: null }));
        expect(await remaining("2026-07-10")).toBeCloseTo(0.6);
    });

    it("a fresh day (no row) has the full budget", async () => {
        getSupabase.mockReturnValue(makeClient({ data: null, error: null }));
        expect(await remaining("2026-07-11")).toBe(DAILY_BUDGET_USD);
    });

    it("debit calls the atomic debit_budget rpc and returns the new total", async () => {
        const cl = makeClient({ data: 0.42, error: null });
        getSupabase.mockReturnValue(cl);
        const total = await debit("2026-07-10", 0.02);
        expect(cl.rpc).toHaveBeenCalledWith("debit_budget", { p_date: "2026-07-10", p_amount: 0.02 });
        expect(total).toBe(0.42);
    });

    it("canAfford compares the estimate against remaining", async () => {
        getSupabase.mockReturnValue(makeClient({ data: { spent_usd: 0.95 }, error: null }));
        expect(await canAfford("2026-07-10", 0.02)).toBe(true); // 0.05 left
        getSupabase.mockReturnValue(makeClient({ data: { spent_usd: 0.99 }, error: null }));
        expect(await canAfford("2026-07-10", 0.02)).toBe(false); // 0.01 left
    });
});

describe("budgetDate", () => {
    it("returns a UTC date-only key (the implicit daily reset)", () => {
        expect(budgetDate(new Date("2026-07-10T23:59:00Z"))).toBe("2026-07-10");
    });
});
