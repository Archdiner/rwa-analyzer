/* eslint-disable @typescript-eslint/no-explicit-any */
import { enqueueRequest, nextReceived, setTriage } from "@/lib/features/store";
import * as supa from "@/lib/supabase";

jest.mock("@/lib/supabase", () => ({ hasSupabase: jest.fn(), getSupabase: jest.fn() }));
const hasSupabase = supa.hasSupabase as jest.Mock;
const getSupabase = supa.getSupabase as jest.Mock;

// A chainable Supabase query builder mock: every builder method returns the
// builder; single/maybeSingle resolve; the builder itself is awaitable.
function makeClient(result: { data: unknown; error: unknown }) {
    const b: any = {};
    for (const m of ["insert", "select", "update", "eq", "order", "limit"]) b[m] = jest.fn(() => b);
    b.single = jest.fn(() => Promise.resolve(result));
    b.maybeSingle = jest.fn(() => Promise.resolve(result));
    b.then = (res: any) => res(result);
    return { builder: b, from: jest.fn(() => b), rpc: jest.fn(() => Promise.resolve(result)) };
}

afterEach(() => jest.clearAllMocks());

describe("feature store — degradation (unconfigured Supabase)", () => {
    beforeEach(() => hasSupabase.mockReturnValue(false));

    it("no-ops without throwing and never touches the client", async () => {
        expect(await enqueueRequest("hi", "1.2.3.4")).toBeNull();
        expect(await nextReceived(5)).toEqual([]);
        await expect(setTriage("id", "triaged", null)).resolves.toBeUndefined();
        expect(getSupabase).not.toHaveBeenCalled();
    });
});

describe("feature store — configured", () => {
    beforeEach(() => hasSupabase.mockReturnValue(true));

    it("enqueueRequest inserts a received row and returns the id", async () => {
        const cl = makeClient({ data: { id: "req-1" }, error: null });
        getSupabase.mockReturnValue(cl);
        const id = await enqueueRequest("add asset X", "9.9.9.9");
        expect(id).toBe("req-1");
        expect(cl.from).toHaveBeenCalledWith("feature_requests");
        expect(cl.builder.insert).toHaveBeenCalledWith(
            expect.objectContaining({ raw_text: "add asset X", submitter_ip: "9.9.9.9", status: "received" }),
        );
    });

    it("nextReceived reads received rows FIFO (oldest first) with a limit", async () => {
        const rows = [{ id: "a", status: "received" }];
        const cl = makeClient({ data: rows, error: null });
        getSupabase.mockReturnValue(cl);
        const out = await nextReceived(3);
        expect(out).toEqual(rows);
        expect(cl.builder.eq).toHaveBeenCalledWith("status", "received");
        expect(cl.builder.order).toHaveBeenCalledWith("created_at", { ascending: true });
        expect(cl.builder.limit).toHaveBeenCalledWith(3);
    });

    it("setTriage updates status + triage for the id", async () => {
        const cl = makeClient({ data: null, error: null });
        getSupabase.mockReturnValue(cl);
        await setTriage("req-1", "rejected", null);
        expect(cl.builder.update).toHaveBeenCalledWith(expect.objectContaining({ status: "rejected", triage: null }));
        expect(cl.builder.eq).toHaveBeenCalledWith("id", "req-1");
    });
});
