// The cost circuit-breaker: with no Supabase configured it uses the per-instance
// counter, and it must stop returning `true` once the daily cap is reached.
import { reserveExternalCall } from "@/lib/budget";

describe("reserveExternalCall (in-memory fallback)", () => {
    const OLD = process.env.OPENAI_DAILY_CAP;
    afterAll(() => {
        if (OLD === undefined) delete process.env.OPENAI_DAILY_CAP;
        else process.env.OPENAI_DAILY_CAP = OLD;
    });

    it("allows up to the cap, then denies", async () => {
        process.env.OPENAI_DAILY_CAP = "3";
        const results = [];
        for (let i = 0; i < 5; i++) results.push(await reserveExternalCall("openai"));
        // First 3 within budget, the rest denied.
        expect(results).toEqual([true, true, true, false, false]);
    });

    it("a zero cap denies everything (kill switch)", async () => {
        process.env.WEB_SEARCH_DAILY_CAP = "0";
        expect(await reserveExternalCall("web_search")).toBe(false);
        delete process.env.WEB_SEARCH_DAILY_CAP;
    });
});
