import type { MetadataRoute } from "next";
import robots from "@/app/robots";
import sitemap from "@/app/sitemap";
import { GET as llmsTxt } from "@/app/llms.txt/route";
import { allSeeds } from "@/lib/seed/assets";

function toRuleArray(
    rules: MetadataRoute.Robots["rules"],
): Array<{ userAgent?: string | string[]; disallow?: string | string[] }> {
    if (!rules) return [];
    return Array.isArray(rules) ? rules : [rules];
}

function disallowPatterns(rules: MetadataRoute.Robots["rules"]): string[] {
    return toRuleArray(rules).flatMap((r) =>
        !r.disallow ? [] : Array.isArray(r.disallow) ? r.disallow : [r.disallow],
    );
}

describe("robots.ts", () => {
    const result = robots();

    it("explicitly allowlists the four AI crawlers", () => {
        const named = toRuleArray(result.rules)
            .map((r) => r.userAgent)
            .flatMap((ua) => (Array.isArray(ua) ? ua : ua ? [ua] : []));
        for (const agent of ["GPTBot", "ClaudeBot", "PerplexityBot", "Google-Extended"]) {
            expect(named).toContain(agent);
        }
    });

    it("does not disallow /api/verify or /llms.txt", () => {
        const blocked = disallowPatterns(result.rules).filter((p) => p && p !== "");
        for (const path of ["/api/verify", "/llms.txt"]) {
            for (const pattern of blocked) {
                expect(path.startsWith(pattern)).toBe(false);
            }
        }
    });

    it("links an absolute sitemap", () => {
        expect(result.sitemap).toMatch(/^https?:\/\/.+\/sitemap\.xml$/);
    });
});

describe("sitemap.ts", () => {
    const entries = sitemap();
    const base = entries[0].url;
    const urls = entries.map((e) => e.url);

    it("includes the landing page plus every seeded asset (and nothing else)", () => {
        expect(entries.length).toBe(1 + allSeeds().length);
        for (const { assetId } of allSeeds()) {
            expect(urls).toContain(`${base}/a/${encodeURIComponent(assetId)}`);
        }
    });

    it("uses the canonical encoded asset_id link shape", () => {
        const anAsset = allSeeds()[0].assetId;
        expect(urls).toContain(`${base}/a/${encodeURIComponent(anAsset)}`);
        // encoded colon, matching app/page.tsx and components/SearchBar.tsx
        expect(encodeURIComponent(anAsset)).toContain("%3A");
    });
});

describe("llms.txt route", () => {
    it("is a non-empty text/plain index linking API, MCP, and CLI", async () => {
        const res = llmsTxt();
        const text = await res.text();
        expect(res.headers.get("content-type")).toMatch(/text\/plain/);
        expect(text.length).toBeGreaterThan(0);
        expect(text).toMatch(/\/api\/verify/);
        expect(text.toLowerCase()).toContain("mcp");
        expect(text.toLowerCase()).toContain("cli");
    });

    it("lists the seeded assets", async () => {
        const text = await llmsTxt().text();
        for (const { seed } of allSeeds()) {
            expect(text).toContain(seed.identifiers.symbol);
        }
    });

    it("does not reference an llms-full.txt mirror", async () => {
        const text = await llmsTxt().text();
        expect(text).not.toMatch(/llms-full/i);
    });
});
