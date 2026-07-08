import Link from "next/link";
import SearchBar from "@/components/SearchBar";
import DecisionExplorer from "@/components/DecisionExplorer";
import { getUniverse } from "@/lib/service";
import type { AssetSummary } from "@/lib/decision";
import { GITHUB_URL, ARCHITECTURE_URL } from "@/lib/site";

export const dynamic = "force-dynamic";

/* Small horizontal/vertical connector used between schematic stages. */
function Arrow() {
    return (
        <div className="flex items-center justify-center text-text-faint" aria-hidden>
            <svg
                className="hidden h-3 w-8 md:block"
                viewBox="0 0 32 12"
                fill="none"
                stroke="currentColor"
                strokeWidth="1"
            >
                <path d="M0 6h28M24 2l5 4-5 4" />
            </svg>
            <svg
                className="h-8 w-3 md:hidden"
                viewBox="0 0 12 32"
                fill="none"
                stroke="currentColor"
                strokeWidth="1"
            >
                <path d="M6 0v28M2 24l4 5 4-5" />
            </svg>
        </div>
    );
}

function Node({
    label,
    lines,
    accent = false,
}: {
    label: string;
    lines: string[];
    accent?: boolean;
}) {
    return (
        <div
            className={`flex-1 rounded-[3px] border bg-bg-elev px-4 py-3 ${
                accent ? "border-primary" : "border-border"
            }`}
        >
            <div className={`eyebrow mb-2 ${accent ? "text-primary" : ""}`}>{label}</div>
            <ul className="space-y-1">
                {lines.map((l) => (
                    <li key={l} className="font-mono text-[11px] leading-relaxed text-text-muted">
                        {l}
                    </li>
                ))}
            </ul>
        </div>
    );
}

function Schematic() {
    return (
        <div className="flex flex-col items-stretch gap-2 md:flex-row md:items-center">
            <Node
                label="Inputs"
                lines={["on-chain reads", "SEC EDGAR", "attestations", "issuer docs"]}
            />
            <Arrow />
            <Node label="Reconcile" lines={["deterministic rules", "no LLM scoring", "conflict → demote"]} />
            <Arrow />
            <Node label="Verdict" lines={["tier", "confidence", "freshness"]} accent />
        </div>
    );
}

const THESIS: Record<string, { title: string; blurb: string }> = {
    BENJI: {
        title: "Verified through regulation",
        blurb: "Backed by a registered '40-Act money fund whose holdings are filed with the SEC. A real green — earned through a regulator filing, not an on-chain guess.",
    },
    OUSG: {
        title: "Honest unknown",
        blurb: "Reserves sit in segregated accounts at third-party custodians that aren't published on-chain. We resolve no attributable wallet, so we say so rather than infer a green.",
    },
};

const FLAG_DOT: Record<string, string> = {
    green: "bg-green",
    amber: "bg-amber",
    red: "bg-red",
    unknown: "bg-unknown",
};

function ThesisCard({ asset }: { asset: AssetSummary }) {
    const t = THESIS[asset.symbol];
    if (!t) return null;
    return (
        <Link
            href={`/a/${encodeURIComponent(asset.asset_id)}`}
            className="panel-link block p-5"
        >
            <div className="flex items-center gap-2">
                <span className={`h-2 w-2 rounded-full ${FLAG_DOT[asset.backing_flag] ?? "bg-unknown"}`} />
                <span className="font-mono text-sm font-semibold text-text">{asset.symbol}</span>
                <span className="truncate text-xs text-text-faint">{asset.name}</span>
            </div>
            <h3 className="mt-3 text-base font-semibold text-text">{t.title}</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-text-muted">{t.blurb}</p>
            <span className="mt-4 inline-block text-sm font-medium text-primary">Read the full check →</span>
        </Link>
    );
}

export default async function Home() {
    const universe = await getUniverse();
    const bySymbol = (s: string) => universe.find((a) => a.symbol === s);
    const benji = bySymbol("BENJI");
    const ousg = bySymbol("OUSG");

    return (
        <div className="mx-auto max-w-5xl px-5 py-12 sm:py-16">
            {/* ── Hero ─────────────────────────────────────────────────────── */}
            <section className="panel ticked overflow-hidden">
                <div className="p-6 sm:p-10">
                    <p className="eyebrow">Backing verification · open source</p>
                    <h1 className="mt-4 max-w-2xl text-3xl font-semibold leading-[1.1] tracking-tight text-text sm:text-[2.75rem]">
                        See where the proof stops before you deposit.
                    </h1>
                    <p className="mt-5 max-w-2xl text-base leading-relaxed text-text-muted sm:text-lg">
                        We check whether a tokenized asset&apos;s backing reconciles against independent sources —
                        regulator filings, on-chain reserves, attestations — and say plainly where verification ends
                        and issuer trust begins. No composite score. No fake green.
                    </p>
                    <div className="mt-7 flex flex-wrap gap-3">
                        <a href="#explore" className="btn btn-primary">
                            Explore assets
                        </a>
                        <a href={ARCHITECTURE_URL} target="_blank" rel="noopener noreferrer" className="btn btn-ghost">
                            How it works
                        </a>
                    </div>
                </div>

                <div className="blueprint border-t border-border p-6 sm:p-8">
                    <Schematic />
                </div>
            </section>

            {/* ── The thesis in two assets ─────────────────────────────────── */}
            {benji && ousg && (
                <section className="mt-14">
                    <p className="eyebrow">The thesis in two assets</p>
                    <h2 className="mt-2 max-w-2xl text-lg font-semibold text-text">
                        Verifiable backing is rare. This shows it where it exists and refuses to fake it everywhere
                        else.
                    </h2>
                    <div className="mt-5 grid gap-4 sm:grid-cols-2">
                        <ThesisCard asset={benji} />
                        <ThesisCard asset={ousg} />
                    </div>
                </section>
            )}

            {/* ── Decision explorer ────────────────────────────────────────── */}
            <section id="explore" className="mt-16 scroll-mt-8">
                <p className="eyebrow">Decision explorer</p>
                <h2 className="mt-2 max-w-2xl text-lg font-semibold text-text">
                    Tell us where you are and roughly how much. We filter to what you can reach, ranked by backing
                    safety first.
                </h2>
                <div className="mt-6">
                    <DecisionExplorer universe={universe} />
                </div>
            </section>

            {/* ── Manual lookup ────────────────────────────────────────────── */}
            <section className="mt-16 border-t border-border pt-10">
                <p className="eyebrow">Manual lookup</p>
                <h2 className="mt-2 text-lg font-semibold text-text">Check any asset by contract address</h2>
                <p className="mt-1.5 text-sm text-text-muted">
                    Paste a contract address, or search a seeded ticker.
                </p>
                <div className="mt-5 max-w-xl">
                    <SearchBar />
                </div>
            </section>

            {/* ── How to read a verdict ────────────────────────────────────── */}
            <section className="mt-16 panel p-6">
                <p className="eyebrow">How to read a verdict</p>
                <dl className="mt-4 grid gap-x-8 gap-y-4 sm:grid-cols-3">
                    <div>
                        <dt className="flex items-center gap-2 text-sm font-medium text-text">
                            <span className="h-2 w-2 rounded-full bg-green" /> Verified
                        </dt>
                        <dd className="mt-1 text-sm leading-relaxed text-text-muted">
                            Backing reconciles against an independent source — a regulator filing or an on-chain
                            reserve read.
                        </dd>
                    </div>
                    <div>
                        <dt className="flex items-center gap-2 text-sm font-medium text-text">
                            <span className="h-2 w-2 rounded-full bg-amber" /> Caution
                        </dt>
                        <dd className="mt-1 text-sm leading-relaxed text-text-muted">
                            Partly proven, self-reported, or aging. Read the caveat before you rely on it.
                        </dd>
                    </div>
                    <div>
                        <dt className="flex items-center gap-2 text-sm font-medium text-text">
                            <span className="h-2 w-2 rounded-full bg-unknown" /> Unknown
                        </dt>
                        <dd className="mt-1 text-sm leading-relaxed text-text-muted">
                            Evidence to confirm or deny backing isn&apos;t available yet. Never dressed up as a green.
                        </dd>
                    </div>
                </dl>
                <p className="mt-5 border-t border-border pt-4 text-xs leading-relaxed text-text-faint">
                    Yields are approximate; confirm at the provider. We rate assets on public facts — not financial
                    advice, and never a read on any app or wrapper used to access the asset.{" "}
                    <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                        Read the source
                    </a>
                    .
                </p>
            </section>
        </div>
    );
}
