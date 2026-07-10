// POST /api/features/submit - the open suggestion box.
// Anonymous, per-IP rate-limited (anti-spam only). Every valid suggestion is
// ALWAYS enqueued - never dropped on cost; the budget-gated worker decides when
// to process it. No auth, no size ceiling on ambition (only a raw length bound).

import { NextRequest } from "next/server";
import { successResponse, errorResponse, rateLimit, rateLimitedResponse, getClientIp } from "@/lib/api-utils";
import { enqueueRequest } from "@/lib/features/store";

export const dynamic = "force-dynamic";

const MIN_LEN = 3;
const MAX_LEN = 8000; // generous - big ideas welcome; this only bounds abuse

export async function POST(req: NextRequest) {
    const ip = getClientIp(req);
    // Tighter than reads: writes are heavier. ~5 burst, ~3/min sustained.
    const { allowed } = rateLimit(`features-submit:${ip}`, 5, 0.05);
    if (!allowed) return rateLimitedResponse();

    let body: { text?: unknown };
    try {
        body = (await req.json()) as { text?: unknown };
    } catch {
        return errorResponse("Body must be JSON: { text: string }", 400);
    }

    const text = typeof body.text === "string" ? body.text.trim() : "";
    if (text.length < MIN_LEN) return errorResponse("Provide a suggestion in `text`.", 400);
    if (text.length > MAX_LEN) return errorResponse(`Keep the suggestion under ${MAX_LEN} characters.`, 400);

    const id = await enqueueRequest(text, ip);
    if (!id) return errorResponse("Suggestions are temporarily unavailable (storage not configured).", 503);

    return successResponse({ id, status: "received" });
}
