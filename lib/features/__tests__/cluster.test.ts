/* eslint-disable @typescript-eslint/no-explicit-any */
import { cosine, greedyCluster, runClustering } from "@/lib/features/cluster";
import * as store from "@/lib/features/store";
import * as budget from "@/lib/features/budget";

jest.mock("@/lib/features/store", () => ({
    triagedForClustering: jest.fn(),
    saveEmbedding: jest.fn(),
    setCluster: jest.fn(),
    upsertDirection: jest.fn(),
}));
jest.mock("@/lib/features/budget", () => ({
    canAfford: jest.fn(),
    debit: jest.fn(),
    remaining: jest.fn(),
    budgetDate: jest.fn(() => "2026-07-10"),
}));

const triagedForClustering = store.triagedForClustering as jest.Mock;
const saveEmbedding = store.saveEmbedding as jest.Mock;
const setCluster = store.setCluster as jest.Mock;
const upsertDirection = store.upsertDirection as jest.Mock;
const canAfford = budget.canAfford as jest.Mock;
const debit = budget.debit as jest.Mock;
const remaining = budget.remaining as jest.Mock;

afterEach(() => jest.clearAllMocks());

describe("cosine", () => {
    it("is 1 for identical, ~0 for orthogonal, 0 for a zero vector", () => {
        expect(cosine([1, 2, 3], [1, 2, 3])).toBeCloseTo(1);
        expect(cosine([1, 0], [0, 1])).toBeCloseTo(0);
        expect(cosine([0, 0], [1, 1])).toBe(0);
    });
});

describe("greedyCluster", () => {
    it("groups similar vectors and separates dissimilar ones", () => {
        const res = greedyCluster(
            [
                { id: "a", vec: [1, 0, 0] },
                { id: "b", vec: [0.98, 0.02, 0] },
                { id: "c", vec: [0, 1, 0] },
            ],
            0.9,
        );
        const byId = Object.fromEntries(res.map((r) => [r.id, r.cluster]));
        expect(byId.a).toBe(byId.b);
        expect(byId.c).not.toBe(byId.a);
    });
});

describe("runClustering", () => {
    it("returns zeros for an empty corpus", async () => {
        triagedForClustering.mockResolvedValue([]);
        remaining.mockResolvedValue(1);
        const res = await runClustering({ date: "2026-07-10" }, { embed: jest.fn(), synthesize: jest.fn() } as any);
        expect(res).toMatchObject({ rows: 0, clusters: 0, directions: 0 });
    });

    it("embeds, clusters, and synthesizes one direction per cluster", async () => {
        triagedForClustering.mockResolvedValue([
            { id: "a", text: "add asset X", themes: ["registry"], embedding: null },
            { id: "b", text: "add asset Y", themes: ["registry"], embedding: null },
            { id: "c", text: "build a risk graph", themes: ["risk"], embedding: null },
        ]);
        canAfford.mockResolvedValue(true);
        debit.mockResolvedValue(0.01);
        remaining.mockResolvedValue(0.9);
        const embed = jest.fn().mockResolvedValue([
            [1, 0, 0],
            [0.99, 0.01, 0],
            [0, 1, 0],
        ]);
        const synthesize = jest.fn().mockResolvedValue({ label: "Direction", synthesis: "do the thing" });

        const res = await runClustering({ date: "2026-07-10", threshold: 0.9 }, { embed, synthesize } as any);

        expect(embed).toHaveBeenCalledWith(["add asset X", "add asset Y", "build a risk graph"]);
        expect(saveEmbedding).toHaveBeenCalledTimes(3);
        expect(res.clusters).toBe(2); // {a,b} and {c}
        expect(res.directions).toBe(2);
        expect(synthesize).toHaveBeenCalledTimes(2);
        expect(upsertDirection).toHaveBeenCalledTimes(2);
        const byId = Object.fromEntries(setCluster.mock.calls.map((c: any[]) => [c[0], c[1]]));
        expect(byId.a).toBe(byId.b);
        expect(byId.c).not.toBe(byId.a);
    });

    it("stops synthesizing when the budget is exhausted (still records the cluster via a theme label)", async () => {
        triagedForClustering.mockResolvedValue([{ id: "a", text: "x", themes: ["carbon"], embedding: [1, 0, 0] }]);
        canAfford.mockResolvedValue(false); // no missing embeddings, and can't afford synth
        remaining.mockResolvedValue(0);
        const embed = jest.fn();
        const synthesize = jest.fn();

        const res = await runClustering({ date: "2026-07-10" }, { embed, synthesize } as any);

        expect(embed).not.toHaveBeenCalled();
        expect(synthesize).not.toHaveBeenCalled();
        expect(res.budgetExhausted).toBe(true);
        expect(upsertDirection).toHaveBeenCalledTimes(1);
        expect(setCluster).toHaveBeenCalledWith("a", "c0", "carbon");
    });
});
