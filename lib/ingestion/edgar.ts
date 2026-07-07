// ---------------------------------------------------------------------------
// EDGAR N-MFP parsing — pure logic (no network, fully testable)
// ---------------------------------------------------------------------------
// Form N-MFP3 is the monthly portfolio-holdings report every money-market fund
// files with the SEC. It is regulator-grade, independent, and machine-readable
// (structured XML) — the strongest evidence in the hierarchy, and the only path
// to a genuine green for the registered-fund (BENJI) class.
//
// This module turns the filing XML into a NormalizedAssetRecord's nav field +
// one regulator_filing EvidenceItem. It is deliberately network-free so the
// exact number-shaping that can flip a green is unit-tested against a fixture.
//
// EXTRACTION is "structured", NOT "llm_extracted": these are typed XML leaves we
// read by tag name, so there is no parse-confidence and no citation to validate
// (the guards that gate LLM figures do not apply — the read itself is the proof,
// like an on-chain balance). INDEPENDENCE is 5 (a regulator filing).
// ---------------------------------------------------------------------------

import { XMLParser } from "fast-xml-parser";
import type { EvidenceItem } from "@/lib/contracts";

export interface NmfpData {
    /** Fund series the filing is for — checked against the registry entry. */
    seriesId: string;
    seriesName: string;
    /** Report ("as of") date — month end. NOT the later filing date. */
    reportDate: string;
    /** Whole-fund net assets (USD). The token may be only a slice of this. */
    netAssets: number;
    /** Target stable price ($1.0000 for a stable-NAV MMF). */
    stablePrice: number | null;
    /** Most recent market-based (shadow) NAV/share — the real integrity signal. */
    marketNav: number | null;
    /** MMF category, e.g. "Government". */
    category: string | null;
    /** Count of portfolio lines per investment category (composition proof). */
    categories: Record<string, number>;
    /** Weighted average maturity in days (Rule 2a-7 caps it at 60). */
    wamDays: number | null;
}

/** Recursively collects every string value stored under `key`, at any depth. */
function collect(node: unknown, key: string, out: string[] = []): string[] {
    if (Array.isArray(node)) {
        for (const el of node) collect(el, key, out);
    } else if (node && typeof node === "object") {
        for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
            if (k === key && (typeof v === "string" || typeof v === "number")) {
                out.push(String(v));
            }
            collect(v, key, out);
        }
    }
    return out;
}

function firstNumber(node: unknown, key: string): number | null {
    const v = collect(node, key)[0];
    if (v == null) return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
}

function lastNumber(node: unknown, key: string): number | null {
    const all = collect(node, key);
    if (all.length === 0) return null;
    const n = Number(all[all.length - 1]);
    return Number.isFinite(n) ? n : null;
}

/** Parses N-MFP3 XML into the fields the backing resolver needs. */
export function parseNmfp(xml: string): NmfpData | null {
    const parser = new XMLParser({ removeNSPrefix: true, ignoreAttributes: true });
    let root: unknown;
    try {
        root = parser.parse(xml);
    } catch {
        return null;
    }

    const seriesId = collect(root, "seriesId")[0];
    const netAssets = firstNumber(root, "netAssetOfSeries");
    if (!seriesId || netAssets == null) return null;

    const categories: Record<string, number> = {};
    for (const c of collect(root, "investmentCategory")) {
        categories[c] = (categories[c] ?? 0) + 1;
    }

    return {
        seriesId,
        seriesName: collect(root, "nameOfSeries")[0] ?? "",
        reportDate: collect(root, "reportDate")[0] ?? "",
        netAssets,
        stablePrice: firstNumber(root, "stablePricePerShare"),
        // The daily shadow-NAV series is reported oldest→newest; the last is most recent.
        marketNav: lastNumber(root, "dailyNetAssetValuePerShareSeries"),
        category: collect(root, "moneyMarketFundCategory")[0] ?? null,
        categories,
        wamDays: firstNumber(root, "averagePortfolioMaturity"),
    };
}

/** The NAV/share the filing establishes: market (shadow) NAV, else stable target. */
export function navFromFiling(data: NmfpData): number | null {
    return data.marketNav ?? data.stablePrice;
}

/** Are the fund's portfolio lines all government securities (govt-MMF mandate)? */
export function isAllGovernment(data: NmfpData): boolean {
    const cats = Object.keys(data.categories);
    if (cats.length === 0) return false;
    return cats.every((c) => /treasury|government/i.test(c));
}

/** Turns a parsed filing into one regulator_filing evidence item. */
export function buildRegulatorEvidence(data: NmfpData, source: string): EvidenceItem {
    const composition = Object.entries(data.categories)
        .map(([c, n]) => `${n}× ${c.replace(/\s*\(.*?\)\s*/g, " ").trim()}`)
        .join("; ");
    const bits = [
        data.category ? `${data.category} money-market fund` : "money-market fund",
        data.marketNav != null ? `market NAV $${data.marketNav.toFixed(4)}` : null,
        data.wamDays != null ? `WAM ${data.wamDays}d` : null,
        composition ? `holdings: ${composition}` : null,
    ].filter(Boolean);

    return {
        source_type: "regulator_filing",
        independence: 5,
        reserves_value: data.netAssets,
        coverage_pct: 100,
        as_of: data.reportDate || new Date().toISOString(),
        extraction: "structured",
        confidence: "verified",
        parse_confidence: null,
        citation: null,
        source,
        note: bits.join("; ") + ".",
    };
}
