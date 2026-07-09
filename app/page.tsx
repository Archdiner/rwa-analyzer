import Link from "next/link";
import SearchBar from "@/components/SearchBar";
import DecisionExplorer from "@/components/DecisionExplorer";
import HeroBackground from "@/components/marketing/HeroBackground";
import AudienceCards from "@/components/marketing/AudienceCards";
import IntegrationGuide from "@/components/marketing/IntegrationGuide";
import YieldExploder from "@/components/marketing/YieldExploder";
import ReconciliationScanner from "@/components/marketing/ReconciliationScanner";
import AgentRouter from "@/components/marketing/AgentRouter";
import YieldSourceGrid from "@/components/marketing/YieldSourceGrid";
import { RadialGraph } from "@/components/marketing/Blueprints";
import { getUniverse } from "@/lib/service";
import type { AssetSummary } from "@/lib/decision";
import { GITHUB_URL } from "@/lib/site";

export const dynamic = "force-dynamic";

const THESIS: Record<string, { title: string; blurb: string }> = {
    BENJI: {
        title: "Verified through regulation",
        blurb: "A registered '40-Act money fund whose holdings are filed with the SEC. Agents get tier: verified_backed - earned through a regulator filing, not an on-chain guess.",
    },
    OUSG: {
        title: "Honest unknown",
        blurb: "Reserves sit in custodian accounts not published on-chain. Agents get tier: unverifiable - I say so rather than infer a green your bot could misread as safe.",
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
        <Link href={`/a/${encodeURIComponent(asset.asset_id)}`} className="panel-link flex h-full flex-col p-7">
            <div className="flex items-center gap-2">
                <span className={`h-2 w-2 rounded-full ${FLAG_DOT[asset.backing_flag] ?? "bg-unknown"}`} />
                <span className="font-mono text-sm font-semibold text-text">{asset.symbol}</span>
                <span className="truncate text-xs text-text-faint">{asset.name}</span>
            </div>
            <h3 className="font-display mt-5 text-2xl text-text">{t.title}</h3>
            <p className="mt-3 flex-1 text-sm leading-relaxed text-text-muted">{t.blurb}</p>
            <span className="mt-6 inline-flex items-center gap-1 text-sm font-medium text-primary">
                Full inspection <span aria-hidden>→</span>
            </span>
        </Link>
    );
}

export default async function Home() {
    const universe = await getUniverse();
    const benji = universe.find((a) => a.symbol === "BENJI");
    const ousg = universe.find((a) => a.symbol === "OUSG");

    return (
        <>
            {/* ── Dark hero (dryft-style) ──────────────────────────────────── */}
            <section className="relative flex min-h-[100svh] items-center overflow-hidden pb-20 pt-28 sm:pb-32 sm:pt-40">
                <HeroBackground />
                <div className="relative z-10 mx-auto w-full max-w-6xl px-4 sm:px-5">
                    <div className="max-w-2xl">
                        <p className="eyebrow text-primary">Open source · MCP · CLI · HTTP</p>
                        <h1 className="font-display mt-5 text-[2.35rem] leading-[1.04] text-text sm:mt-6 sm:text-[3.75rem] lg:text-[4.5rem]">
                            Know where the proof stops
                            <span className="font-display italic"> before you deposit.</span>
                        </h1>
                        <p className="mt-6 max-w-xl text-[15px] leading-relaxed text-text sm:mt-7 sm:text-lg">
                            For any tokenized yield, I separate what is independently provable from what you are
                            simply trusting, then hand back a clear read: how strong the backing is, how fresh
                            the proof is, and exactly where it stops. Never a single safe-or-not flag.
                        </p>
                        <div className="mt-8 flex flex-wrap gap-3">
                            <a
                                href="#integrate"
                                className="inline-flex items-center rounded-md bg-primary px-5 py-3 text-sm font-medium text-primary-contrast transition-colors hover:bg-primary-hover"
                            >
                                Add to your agent
                            </a>
                            <a
                                href="#explore"
                                className="inline-flex items-center rounded-md border border-white/20 bg-white/5 px-5 py-3 text-sm font-medium text-white backdrop-blur-sm transition-colors hover:border-white/40 hover:bg-white/10"
                            >
                                Explore assets
                            </a>
                        </div>
                    </div>
                </div>
            </section>

            {/* ── Who this is for ──────────────────────────────────────────── */}
            <section className="relative z-20 border-y border-border bg-bg py-16 sm:py-20">
                <div className="mx-auto max-w-6xl px-5">
                    <p className="eyebrow text-primary">Who this is for</p>
                    <h2 className="font-display mt-3 max-w-2xl text-3xl text-text sm:text-[2.5rem]">
                        Built for anyone who moves money before they can read a prospectus.
                    </h2>
                    <p className="mt-5 max-w-2xl text-base leading-relaxed text-text-muted">
                        Earn tabs show APY. They do not show where the proof stops. I give agents, wallets, and
                        treasury bots a structured gate before a deposit, and give humans the same read without
                        collapsing it into a boolean safe flag.
                    </p>
                    <div className="mt-10">
                        <AudienceCards />
                    </div>
                </div>
            </section>

            {/* ── Exploder Animation ─────────────────────────────────────── */}
            <section className="relative z-20">
                <YieldExploder />
            </section>

            {/* ── Identity: what this verifies (yield-source categories) ───── */}
            <section className="relative z-20 py-16 sm:py-24">
                <div className="mx-auto max-w-6xl px-5">
                    <div className="grid items-center gap-10 lg:grid-cols-[1fr_360px] lg:gap-16">
                        <div>
                            <p className="eyebrow text-primary">Not just an RWA checker</p>
                            <h2 className="font-display mt-4 text-3xl leading-tight text-text sm:text-[2.75rem]">
                                One engine for wherever yield comes from.
                            </h2>
                            <p className="mt-5 max-w-xl text-base leading-relaxed text-text-muted">
                                Backing was the hardest case, so I built it first. The same three-axis engine
                                generalizes by yield-source category, not by token. One lending adapter covers
                                every Aave and Morpho market; one staking adapter covers every LST. Coverage grows
                                where proof is possible, and <span className="text-text">unknown</span> stays a
                                valid, honest answer.
                            </p>
                        </div>
                        <div className="mx-auto w-full max-w-[360px]">
                            <RadialGraph className="h-auto w-full" />
                        </div>
                    </div>

                    <div className="mt-14">
                        <YieldSourceGrid />
                    </div>
                </div>
            </section>

                {/* ── Reconciliation Scanner ─────────────────────────────────── */}
                <section className="relative z-20 py-16 sm:py-24 overflow-hidden">
                    <div className="mx-auto max-w-6xl px-5 text-center mb-16">
                        <p className="eyebrow text-primary">The engine</p>
                        <h2 className="font-display mt-3 text-3xl text-text sm:text-[2.75rem]">
                            Deterministic reconciliation
                        </h2>
                        <p className="mt-5 mx-auto max-w-2xl text-base leading-relaxed text-text-muted">
                            I never let a language model score an asset. It only parses documents into
                            structured data. Then plain arithmetic runs against on-chain reads, and if the two
                            sides do not match, the verdict drops. No model gets a vote on the color.
                        </p>
                    </div>
                    <div className="px-5">
                        <ReconciliationScanner />
                    </div>
                </section>

                {/* ── Agent Router Visualization ─────────────────────────────── */}
                <section className="relative z-20 py-16 sm:py-24 overflow-hidden border-t border-border">
                    <div className="mx-auto max-w-6xl px-5 text-center mb-16">
                        <p className="eyebrow text-primary">Agent routing</p>
                        <h2 className="font-display mt-3 text-3xl text-text sm:text-[2.75rem]">
                            Gate execution on verifiable proof.
                        </h2>
                        <p className="mt-5 mx-auto max-w-2xl text-base leading-relaxed text-text-muted">
                            Your agent asks the engine before it moves money. If backing or market risk cannot be
                            verified independently, the deposit is held back and the reason is handed back in
                            plain terms, not a silent failure.
                        </p>
                    </div>
                    <div className="px-5">
                        <AgentRouter />
                    </div>
                </section>

            {/* ── Integration tutorial ─────────────────────────────────────── */}
            <section id="integrate" className="scroll-mt-20 py-16 sm:py-24 relative z-20 bg-bg border-y border-border">
                <div className="mx-auto max-w-6xl px-5">
                    <p className="eyebrow text-primary">Get started in five minutes</p>
                    <h2 className="font-display mt-3 max-w-2xl text-3xl text-text sm:text-[2.75rem]">
                        Wire a pre-deposit check into your agent, wallet, or bot.
                    </h2>
                    <p className="mt-5 max-w-2xl text-base leading-relaxed text-text-muted">
                            Same <code className="font-mono text-sm text-white/90">AgentVerdict</code> contract everywhere. Gate on{" "}
                            <code className="font-mono text-sm text-white/90">backing.tier</code> and{" "}
                            <code className="font-mono text-sm text-white/90">market_risk</code>, surface{" "}
                            <code className="font-mono text-sm text-white/90">trust_boundary</code> and{" "}
                            <code className="font-mono text-sm text-white/90">caveats</code> - never collapse to safe/unsafe.
                    </p>
                    <div className="mt-12">
                        <IntegrationGuide />
                    </div>
                </div>
            </section>

            {/* ── Thesis ───────────────────────────────────────────────────── */}
            {benji && ousg && (
                <section className="py-16 sm:py-24">
                    <div className="mx-auto max-w-6xl px-5">
                        <p className="eyebrow text-primary">Why this exists</p>
                        <h2 className="font-display mt-3 max-w-2xl text-3xl text-text sm:text-[2.75rem]">
                            One real green. One honest unknown. Your agent should see both.
                        </h2>
                        <div className="mt-10 grid items-stretch gap-6 sm:grid-cols-2">
                            <ThesisCard asset={benji} />
                            <ThesisCard asset={ousg} />
                        </div>
                    </div>
                </section>
            )}

            {/* ── Decision explorer (simulate routing) ─────────────────────────────── */}
            <section id="explore" className="scroll-mt-20 py-16 sm:py-24 border-t border-border">
                <div className="mx-auto max-w-6xl px-5">
                    <p className="eyebrow text-primary">For humans</p>
                    <h2 className="font-display mt-3 max-w-2xl text-3xl text-text sm:text-[2.75rem]">
                        See what you can reach, and how far the proof goes.
                    </h2>
                    <p className="mt-5 max-w-2xl text-base leading-relaxed text-text-muted">
                        Agents call the API. People use this. Same engine underneath, ranked so verifiable
                        backing always sits above higher yield you would have to trust on faith.
                    </p>
                    <div className="mt-12">
                        <DecisionExplorer universe={universe} />
                    </div>
                </div>
            </section>

            {/* ── Manual lookup ──────────────────────────────────────────── */}
            <section className="border-t border-border py-16 sm:py-24">
                <div className="mx-auto max-w-6xl px-5">
                    <p className="eyebrow text-primary">Manual lookup</p>
                    <h2 className="font-display mt-3 text-2xl text-text sm:text-3xl">
                        Any contract address or seeded ticker
                    </h2>
                    <div className="mt-6 max-w-xl">
                        <SearchBar />
                    </div>
                </div>
            </section>

            {/* ── CTA band ──────────────────────────────────────────── */}
            <section className="py-20 sm:py-32 border-t border-border relative overflow-hidden">
                <div className="mx-auto max-w-6xl px-5 text-center relative z-10">
                    <h2 className="font-display text-4xl text-text sm:text-6xl leading-[1.05]">
                        Your earn tab does not verify backing.
                        <br />
                        <span className="text-primary">This does.</span>
                    </h2>
                    <p className="mx-auto mt-7 max-w-lg text-lg leading-relaxed text-text-muted">
                        Open source. Deterministic scoring. One call before you route a deposit.
                    </p>
                    <div className="mt-10 flex flex-wrap justify-center gap-4">
                        <a
                            href="#integrate"
                            className="inline-flex items-center rounded-md bg-primary px-8 py-4 text-sm font-medium text-primary-contrast transition-all hover:bg-primary-hover"
                        >
                            Read the integration guide
                        </a>
                        <a
                            href={GITHUB_URL}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center rounded-md border border-white/20 bg-white/5 backdrop-blur-sm px-8 py-4 text-sm font-medium text-white hover:bg-white/10 hover:border-white/40 transition-all"
                        >
                            View source on GitHub
                        </a>
                    </div>
                </div>
            </section>
        </>
    );
}
