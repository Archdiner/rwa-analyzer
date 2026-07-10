/* eslint-disable @typescript-eslint/no-explicit-any */
import { POST } from "@/app/api/features/triage/route";
import * as triage from "@/lib/features/triage";
import * as env from "@/lib/env";

jest.mock("@/lib/features/triage", () => ({ runTriageWorker: jest.fn() }));
jest.mock("@/lib/env", () => ({ cronSecret: jest.fn() }));
const runTriageWorker = triage.runTriageWorker as jest.Mock;
const cronSecret = env.cronSecret as jest.Mock;

function req(auth?: string) {
    return new Request("http://localhost/api/features/triage", {
        method: "POST",
        headers: auth ? { authorization: auth } : {},
    }) as any;
}

afterEach(() => jest.clearAllMocks());

describe("POST /api/features/triage — fail-closed cron auth", () => {
    it("401s when CRON_SECRET is UNSET (fail closed, unlike the refresh guard)", async () => {
        cronSecret.mockReturnValue(undefined);
        const res = await POST(req("Bearer anything"));
        expect(res.status).toBe(401);
        expect(runTriageWorker).not.toHaveBeenCalled();
    });

    it("401s on a wrong secret", async () => {
        cronSecret.mockReturnValue("s3cret");
        const res = await POST(req("Bearer nope"));
        expect(res.status).toBe(401);
        expect(runTriageWorker).not.toHaveBeenCalled();
    });

    it("runs the worker with the correct secret", async () => {
        cronSecret.mockReturnValue("s3cret");
        runTriageWorker.mockResolvedValue({ processed: 1, rejected: 0, budgetExhausted: false, remaining: 0.9 });
        const res = await POST(req("Bearer s3cret"));
        expect(res.status).toBe(200);
        expect(runTriageWorker).toHaveBeenCalled();
    });
});
