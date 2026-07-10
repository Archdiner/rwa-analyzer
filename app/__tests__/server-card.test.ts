import { GET } from "@/app/.well-known/mcp/server-card/route";
import { MCP_SERVER, MCP_TOOLS } from "@/mcp/tools";

describe("mcp server-card route", () => {
    it("advertises the server identity and every registered tool", async () => {
        const card = (await GET().json()) as {
            name: string;
            version: string;
            tools: Array<{ name: string }>;
        };
        expect(card.name).toBe(MCP_SERVER.name);
        expect(card.version).toBe(MCP_SERVER.version);
        const toolNames = card.tools.map((t) => t.name);
        for (const t of MCP_TOOLS) expect(toolNames).toContain(t.name);
        // guards against drift from the shared constant
        expect(toolNames).toContain("check_asset_backing");
        expect(toolNames).toContain("list_verified_assets");
    });

    it("describes a local stdio server, not a hosted HTTP/SSE endpoint", async () => {
        const card = (await GET().json()) as { transport: { type: string; command: string } };
        expect(card.transport.type).toBe("stdio");
        expect(card.transport.command).toMatch(/mcp/);
        // must not fabricate a network endpoint the stdio server doesn't have
        expect(JSON.stringify(card)).not.toMatch(/\/sse|\/mcp\b.*https?:/i);
    });
});
