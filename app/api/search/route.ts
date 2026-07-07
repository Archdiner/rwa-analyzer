// ---------------------------------------------------------------------------
// GET /api/search?q=... — resolve a lookup to an asset_id or candidates
// ---------------------------------------------------------------------------

import { NextRequest } from "next/server";
import { successResponse, errorResponse, rateLimit, rateLimitedResponse, getClientIp } from "@/lib/api-utils";
import { resolveInput } from "@/lib/resolve";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
    const { allowed } = rateLimit(`search:${getClientIp(req)}`);
    if (!allowed) return rateLimitedResponse();

    const q = req.nextUrl.searchParams.get("q") ?? "";
    if (!q.trim()) return errorResponse("Missing query parameter 'q'.", 400);

    const result = await resolveInput(q);
    return successResponse(result);
}
