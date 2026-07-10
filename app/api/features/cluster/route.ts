// POST|GET /api/features/cluster - cron-triggered clustering + synthesis pass.
// Fails CLOSED on an unset CRON_SECRET (it spends the OpenAI budget).

import { NextRequest } from "next/server";
import { cronSecret } from "@/lib/env";
import { successResponse, errorResponse } from "@/lib/api-utils";
import { runClustering } from "@/lib/features/cluster";

export const dynamic = "force-dynamic";

function authorized(req: NextRequest): boolean {
    const secret = cronSecret();
    if (!secret) return false; // fail closed
    return req.headers.get("authorization") === `Bearer ${secret}`;
}

async function handle(req: NextRequest) {
    if (!authorized(req)) return errorResponse("Unauthorized", 401);
    return successResponse(await runClustering());
}

export const POST = handle;
export const GET = handle;
