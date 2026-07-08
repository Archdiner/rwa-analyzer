// ---------------------------------------------------------------------------
// GET /api/schema
// ---------------------------------------------------------------------------
// Serves the JSON Schema for the AgentVerdict returned by /api/verify, so an
// integrator or agent can validate/type the response without reading source.
// Static: the contract only changes with a deploy.
// ---------------------------------------------------------------------------

import { AGENT_VERDICT_SCHEMA } from "@/lib/agent/schema";

export const dynamic = "force-static";

export function GET() {
    return Response.json(AGENT_VERDICT_SCHEMA, {
        headers: { "cache-control": "public, max-age=3600" },
    });
}
