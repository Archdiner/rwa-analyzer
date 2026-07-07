// ---------------------------------------------------------------------------
// GET /api/universe — the assessed universe as decision-ready summaries
// ---------------------------------------------------------------------------
// Powers the landing decision surface and doubles as a public read for anyone
// building diligence tooling on top. Optionally filters to a user profile via
// ?jurisdiction=&amount= (returns { reachable, closed }); with no params it
// returns the raw ranked-nothing summaries.
// ---------------------------------------------------------------------------

import { NextRequest } from "next/server";
import { successResponse, rateLimit, rateLimitedResponse, getClientIp } from "@/lib/api-utils";
import { getUniverse } from "@/lib/service";
import {
    decide,
    AMOUNT_BANDS,
    USER_JURISDICTIONS,
    type AmountBand,
    type UserJurisdiction,
} from "@/lib/decision";

export const dynamic = "force-dynamic";

function isJurisdiction(v: string | null): v is UserJurisdiction {
    return USER_JURISDICTIONS.some((j) => j.id === v);
}
function isAmount(v: string | null): v is AmountBand {
    return AMOUNT_BANDS.some((b) => b.id === v);
}

export async function GET(req: NextRequest) {
    const { allowed } = rateLimit(`universe:${getClientIp(req)}`);
    if (!allowed) return rateLimitedResponse();

    const universe = await getUniverse();

    const jurisdiction = req.nextUrl.searchParams.get("jurisdiction");
    const amount = req.nextUrl.searchParams.get("amount");
    if (isJurisdiction(jurisdiction) && isAmount(amount)) {
        return successResponse(decide(universe, { jurisdiction, amount }));
    }

    return successResponse({ universe });
}
