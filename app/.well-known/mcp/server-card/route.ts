import { MCP_SERVER, MCP_TOOLS } from "@/mcp/tools";
import { GITHUB_URL } from "@/lib/site";

// Pre-connection MCP discovery card (SEP-2127 direction). This server is a
// LOCAL stdio server (a thin client of the HTTP API) - there is no hosted
// HTTP/SSE endpoint to connect to, so the card advertises how to run it
// locally rather than claiming a network endpoint it doesn't have.
export function GET(): Response {
    const card = {
        name: MCP_SERVER.name,
        version: MCP_SERVER.version,
        description: MCP_SERVER.description,
        transport: { type: "stdio", command: "npm run mcp" },
        repository: GITHUB_URL,
        documentation: GITHUB_URL,
        tools: MCP_TOOLS.map((t) => ({ name: t.name, title: t.title, description: t.description })),
    };
    return Response.json(card, {
        headers: { "cache-control": "public, max-age=3600" },
    });
}
