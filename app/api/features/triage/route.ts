// POST|GET /api/features/triage - cron-triggered triage worker.
// Fails CLOSED: an unset CRON_SECRET rejects everything (unlike the refresh
// route's fail-open guard), since this worker spends the OpenAI budget.

import { NextRequest } from "next/server";
import { cronSecret } from "@/lib/env";
import { successResponse, errorResponse } from "@/lib/api-utils";
import { runTriageWorker } from "@/lib/features/triage";

export const dynamic = "force-dynamic";

function authorized(req: NextRequest): boolean {
    const secret = cronSecret();
    if (!secret) return false; // fail closed
    return req.headers.get("authorization") === `Bearer ${secret}`;
}

async function handle(req: NextRequest) {
    if (!authorized(req)) return errorResponse("Unauthorized", 401);
    const result = await runTriageWorker();
    return successResponse(result);
}

export const POST = handle;
export const GET = handle;
