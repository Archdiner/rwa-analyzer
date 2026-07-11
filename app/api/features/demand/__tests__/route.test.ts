/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest } from "next/server";
import { GET } from "@/app/api/features/demand/route";
import * as store from "@/lib/features/store";

jest.mock("@/lib/features/store", () => ({ listDirections: jest.fn() }));
const listDirections = store.listDirections as jest.Mock;

function req(url: string, headers?: Record<string, string>) {
    return new NextRequest(url, headers ? { headers } : undefined);
}

describe("GET /api/features/demand — maintainer-gated, fail-closed", () => {
    const OLD = process.env.MAINTAINER_KEY;
    afterEach(() => {
        if (OLD === undefined) delete process.env.MAINTAINER_KEY;
        else process.env.MAINTAINER_KEY = OLD;
        jest.clearAllMocks();
    });

    it("404s when MAINTAINER_KEY is unset (fail closed) and never reads data", async () => {
        delete process.env.MAINTAINER_KEY;
        const res = await GET(req("http://localhost/api/features/demand?key=whatever"));
        expect(res.status).toBe(404);
        expect(listDirections).not.toHaveBeenCalled();
    });

    it("404s on a wrong key", async () => {
        process.env.MAINTAINER_KEY = "secret";
        const res = await GET(req("http://localhost/api/features/demand?key=nope"));
        expect(res.status).toBe(404);
    });

    it("returns ranked directions with the correct key (query param)", async () => {
        process.env.MAINTAINER_KEY = "secret";
        listDirections.mockResolvedValue([{ cluster_id: "c0", label: "L", synthesis: "S", member_count: 3 }]);
        const res = await GET(req("http://localhost/api/features/demand?key=secret"));
        expect(res.status).toBe(200);
        const json = (await res.json()) as any;
        expect(json.data.directions[0].label).toBe("L");
    });

    it("accepts the key via header", async () => {
        process.env.MAINTAINER_KEY = "secret";
        listDirections.mockResolvedValue([]);
        const res = await GET(req("http://localhost/api/features/demand", { "x-maintainer-key": "secret" }));
        expect(res.status).toBe(200);
    });
});
