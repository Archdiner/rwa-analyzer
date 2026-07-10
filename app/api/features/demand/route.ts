// GET /api/features/demand - ranked synthesized directions. Maintainer-only
// (MAINTAINER_KEY via ?key= or x-maintainer-key header). Fails CLOSED: unset key
// or mismatch returns 404 (don't advertise the endpoint). Advisory data only.

import { NextRequest } from "next/server";
import { successResponse, errorResponse } from "@/lib/api-utils";
import { listDirections } from "@/lib/features/store";

export const dynamic = "force-dynamic";

function authorized(req: NextRequest): boolean {
    const key = process.env.MAINTAINER_KEY;
    if (!key) return false; // fail closed
    const provided = req.headers.get("x-maintainer-key") ?? req.nextUrl.searchParams.get("key");
    return provided === key;
}

export async function GET(req: NextRequest) {
    if (!authorized(req)) return errorResponse("Not found.", 404);
    const directions = await listDirections();
    return successResponse({ directions });
}
