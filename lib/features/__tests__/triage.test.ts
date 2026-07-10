/* eslint-disable @typescript-eslint/no-explicit-any */
import { runTriageWorker } from "@/lib/features/triage";
import * as store from "@/lib/features/store";
import * as budget from "@/lib/features/budget";

jest.mock("@/lib/features/store", () => ({ nextReceived: jest.fn(), setTriage: jest.fn() }));
jest.mock("@/lib/features/budget", () => ({
    canAfford: jest.fn(),
    debit: jest.fn(),
    remaining: jest.fn(),
    budgetDate: jest.fn(() => "2026-07-10"),
}));

const nextReceived = store.nextReceived as jest.Mock;
const setTriage = store.setTriage as jest.Mock;
const canAfford = budget.canAfford as jest.Mock;
const debit = budget.debit as jest.Mock;
const remaining = budget.remaining as jest.Mock;

const good: any = {
    summary: "s",
    area: "new_capability",
    scale: "large",
    merit: "worth exploring",
    themes: ["private-credit"],
    buildable_now: false,
    dedup_hint: "",
};

// Simulate a shrinking FIFO queue: nextReceived(1) returns the next item each call.
function loadQueue(n: number) {
    const rows = Array.from({ length: n }, (_, i) => ({
        id: `r${i}`,
        raw_text: `idea ${i}`,
        status: "received",
        submitter_ip: null,
        triage: null,
        cluster_id: null,
        cluster_label: null,
        created_at: `t${i}`,
    }));
    let idx = 0;
    nextReceived.mockImplementation(async () => (idx < rows.length ? [rows[idx++]] : []));
}

afterEach(() => jest.clearAllMocks());

describe("runTriageWorker — budget-gated FIFO drain", () => {
    it("drains all items when budget allows and marks them triaged", async () => {
        loadQueue(3);
        canAfford.mockResolvedValue(true);
        debit.mockResolvedValue(0.01);
        remaining.mockResolvedValue(0.9);
        const classify = jest.fn().mockResolvedValue(good);

        const res = await runTriageWorker({ date: "2026-07-10", batch: 25 }, classify);

        expect(res.processed).toBe(3);
        expect(res.rejected).toBe(0);
        expect(res.budgetExhausted).toBe(false);
        expect(setTriage).toHaveBeenCalledTimes(3);
        expect(setTriage).toHaveBeenCalledWith("r0", "triaged", good);
        expect(debit).toHaveBeenCalledTimes(3);
    });

    it("stops when the budget runs out, leaving the rest queued", async () => {
        loadQueue(5);
        canAfford.mockResolvedValueOnce(true).mockResolvedValueOnce(true).mockResolvedValue(false);
        debit.mockResolvedValue(0.01);
        remaining.mockResolvedValue(0);
        const classify = jest.fn().mockResolvedValue(good);

        const res = await runTriageWorker({ date: "2026-07-10" }, classify);

        expect(res.processed).toBe(2); // 3 remain in the queue for the next window
        expect(res.budgetExhausted).toBe(true);
        expect(setTriage).toHaveBeenCalledTimes(2);
    });

    it("rejects malformed classifications but still debits (spam can't loop the budget)", async () => {
        loadQueue(2);
        canAfford.mockResolvedValue(true);
        debit.mockResolvedValue(0.01);
        remaining.mockResolvedValue(0.5);
        const classify = jest.fn().mockResolvedValue(null);

        const res = await runTriageWorker({ date: "2026-07-10" }, classify);

        expect(res.processed).toBe(0);
        expect(res.rejected).toBe(2);
        expect(setTriage).toHaveBeenCalledWith("r0", "rejected", null);
        expect(debit).toHaveBeenCalledTimes(2);
    });

    it("does nothing (and calls no LLM) when the budget is already exhausted", async () => {
        loadQueue(3);
        canAfford.mockResolvedValue(false);
        remaining.mockResolvedValue(0);
        const classify = jest.fn().mockResolvedValue(good);

        const res = await runTriageWorker({ date: "2026-07-10" }, classify);

        expect(res.processed).toBe(0);
        expect(res.budgetExhausted).toBe(true);
        expect(classify).not.toHaveBeenCalled();
        expect(nextReceived).not.toHaveBeenCalled();
    });
});
