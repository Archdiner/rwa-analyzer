import type { MetadataRoute } from "next";
import { appUrl } from "@/lib/env";

// AI crawlers assume *disallow* unless explicitly named (unlike Googlebot's
// permissive default). Name them so the agent surface - /api/verify, /llms.txt,
// and asset pages - is reachable rather than silently invisible.
const AI_AGENTS = ["GPTBot", "ClaudeBot", "PerplexityBot", "Google-Extended"];

export default function robots(): MetadataRoute.Robots {
    const base = appUrl();
    return {
        rules: [
            { userAgent: "*", allow: "/" },
            ...AI_AGENTS.map((userAgent) => ({ userAgent, allow: "/" })),
        ],
        sitemap: `${base}/sitemap.xml`,
        host: base,
    };
}
