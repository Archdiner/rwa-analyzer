// ---------------------------------------------------------------------------
// Issuer-disclosure fetcher
// ---------------------------------------------------------------------------
// Turns a disclosure into plain text for the extractor. Discovery fallback for
// the on-demand path (spec + review fix #2):
//   1. Use a disclosure URL if one was supplied (seed / rwa.xyz).
//   2. Else attempt ONE web-search (if WEB_SEARCH_API_KEY is set; Serper format).
//   3. Else give up -> qualitative fields resolve to unverifiable.
// Prospectuses are usually PDFs, so a PDF-to-text step is included.
// ---------------------------------------------------------------------------

import { webSearchKey } from "@/lib/env";
import { reserveExternalCall } from "@/lib/budget";

export interface IssuerDoc {
    url: string;
    text: string;
}

const MAX_BYTES = 8 * 1024 * 1024; // 8 MB cap - prospectuses are large but bounded
const MAX_TEXT_CHARS = 120_000; // keep the extraction prompt bounded
const FETCH_TIMEOUT_MS = 15_000; // no unbounded hangs on a slow upstream

/**
 * Guards the server-side fetcher against SSRF: https only, no loopback /
 * private / link-local / cloud-metadata hosts. The URL originates from seed data
 * or a web-search result (not raw user input), so this is defense-in-depth.
 * Note: `fetch` still follows redirects internally; this validates the initial
 * hop. A hardened deploy behind an egress proxy remains the belt-and-suspenders.
 */
function isPubliclyFetchable(raw: string): boolean {
    let u: URL;
    try {
        u = new URL(raw);
    } catch {
        return false;
    }
    if (u.protocol !== "https:") return false;
    const host = u.hostname.toLowerCase();
    if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".internal")) return false;
    if (host === "metadata.google.internal" || host === "169.254.169.254") return false;
    // Literal private / loopback / link-local IPv4 ranges.
    if (/^(10\.|127\.|0\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host)) return false;
    // IPv6 loopback / unique-local / link-local.
    if (host === "::1" || host.startsWith("fc") || host.startsWith("fd") || host.startsWith("fe80")) return false;
    return true;
}

/** Strips HTML to rough text. Good enough to cite against; not a renderer. */
function htmlToText(html: string): string {
    return html
        .replace(/<script[\s\S]*?<\/script>/gi, " ")
        .replace(/<style[\s\S]*?<\/style>/gi, " ")
        .replace(/<[^>]+>/g, " ")
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/\s+/g, " ")
        .trim();
}

async function pdfToText(buf: ArrayBuffer): Promise<string> {
    const { extractText, getDocumentProxy } = await import("unpdf");
    const pdf = await getDocumentProxy(new Uint8Array(buf));
    const { text } = await extractText(pdf, { mergePages: true });
    return (Array.isArray(text) ? text.join("\n") : text).replace(/\s+/g, " ").trim();
}

/** Fetches a URL and returns its text (PDF or HTML), or null on failure. */
export async function fetchDocText(url: string): Promise<string | null> {
    if (!isPubliclyFetchable(url)) {
        console.error(`[issuer-docs] refusing to fetch non-public URL: ${url}`);
        return null;
    }
    try {
        const res = await fetch(url, {
            headers: { "user-agent": "rwa-analyzer/1.0 (+disclosure-reader)" },
            redirect: "follow",
            signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        });
        if (!res.ok) return null;

        const contentType = res.headers.get("content-type")?.toLowerCase() ?? "";
        const buf = await res.arrayBuffer();
        if (buf.byteLength > MAX_BYTES) return null;

        const isPdf = contentType.includes("pdf") || url.toLowerCase().endsWith(".pdf");
        const text = isPdf ? await pdfToText(buf) : htmlToText(new TextDecoder().decode(buf));

        if (!text) return null;
        return text.slice(0, MAX_TEXT_CHARS);
    } catch (err) {
        console.error(`[issuer-docs] fetch failed for ${url}:`, err);
        return null;
    }
}

/** One web-search attempt to find a disclosure URL. Serper.dev format. */
async function discoverDocUrl(name: string, symbol: string): Promise<string | null> {
    const key = webSearchKey();
    if (!key) return null;

    // Cost circuit-breaker: web search is a paid call; respect the daily cap.
    if (!(await reserveExternalCall("web_search"))) {
        console.warn("[issuer-docs] daily web-search budget reached; skipping discovery.");
        return null;
    }

    try {
        const res = await fetch("https://google.serper.dev/search", {
            method: "POST",
            headers: { "X-API-KEY": key, "Content-Type": "application/json" },
            body: JSON.stringify({ q: `${name} ${symbol} prospectus OR terms OR offering filetype:pdf` }),
            signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        });
        if (!res.ok) return null;

        const json = (await res.json()) as { organic?: { link?: string }[] };
        const links = (json.organic ?? []).map((o) => o.link).filter(Boolean) as string[];

        // Prefer a PDF; else the first result.
        return links.find((l) => l.toLowerCase().endsWith(".pdf")) ?? links[0] ?? null;
    } catch (err) {
        console.error("[issuer-docs] discovery failed:", err);
        return null;
    }
}

/**
 * Resolves and fetches an issuer disclosure for an asset. Returns the doc text
 * + resolved URL, or null when nothing usable is found (qualitative fields then
 * resolve to unverifiable and the card renders on-chain + quant only).
 */
export async function resolveIssuerDoc(args: {
    name: string;
    symbol: string;
    disclosureUrl?: string;
}): Promise<IssuerDoc | null> {
    const url = args.disclosureUrl ?? (await discoverDocUrl(args.name, args.symbol));
    if (!url) return null;

    const text = await fetchDocText(url);
    if (!text) return null;

    return { url, text };
}
