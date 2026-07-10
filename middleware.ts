// ---------------------------------------------------------------------------
// Content negotiation for asset pages (agent-readable surface)
// ---------------------------------------------------------------------------
// Agents fetch, they don't click. When something requests /a/{id} with an
// Accept preference for JSON or markdown, serve the structured form instead of
// the HTML page - without a human-facing "agent mode" toggle:
//   Accept: application/json -> rewrite to /api/verify?asset={id} (existing JSON)
//   Accept: text/markdown    -> rewrite to /a/{id}/verdict.md
//   otherwise                -> the HTML page, unchanged
// Every response Varies on Accept so a CDN can't cross-serve the wrong type.
// ---------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";

// Does the Accept header prefer `type` over text/html? Cheap check: `type`
// appears and text/html does not appear earlier (good enough for agent clients,
// which send a specific Accept rather than a browser's long list).
function prefers(accept: string, type: string): boolean {
    const a = accept.toLowerCase();
    if (!a.includes(type)) return false;
    const htmlIdx = a.indexOf("text/html");
    if (htmlIdx === -1) return true;
    return a.indexOf(type) <= htmlIdx;
}

export function middleware(req: NextRequest): NextResponse {
    const accept = req.headers.get("accept") ?? "";
    // Keep the raw (still percent-encoded) id segment - it is a {chainId}:{address}
    // whose colon is encoded; re-encoding a decoded value would double-encode.
    const match = req.nextUrl.pathname.match(/^\/a\/([^/]+)\/?$/);

    if (!match) return NextResponse.next();
    const idSegment = match[1];

    const wantsJson = prefers(accept, "application/json");
    const wantsMd = !wantsJson && prefers(accept, "text/markdown");

    if (!wantsJson && !wantsMd) {
        const passthrough = NextResponse.next();
        passthrough.headers.set("Vary", "Accept");
        return passthrough;
    }

    const url = req.nextUrl.clone();
    if (wantsJson) {
        url.pathname = "/api/verify";
        url.search = `?asset=${idSegment}`;
    } else {
        url.pathname = `/a/${idSegment}/verdict.md`;
        url.search = "";
    }

    const res = NextResponse.rewrite(url);
    res.headers.set("Vary", "Accept");
    return res;
}

// Only run on the asset-page route; leave everything else untouched.
export const config = { matcher: "/a/:assetId" };
