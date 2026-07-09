import Link from "next/link";
import SearchBar from "@/components/SearchBar";
import DecisionExplorer from "@/components/DecisionExplorer";
import HeroBackground from "@/components/marketing/HeroBackground";
import AudienceCards from "@/components/marketing/AudienceCards";
import IntegrationGuide from "@/components/marketing/IntegrationGuide";
import YieldExploder from "@/components/marketing/YieldExploder";
import ReconciliationScanner from "@/components/marketing/ReconciliationScanner";
import AgentRouter from "@/components/marketing/AgentRouter";
import YieldCoverage from "@/components/marketing/YieldCoverage";
import { getUniverse } from "@/lib/service";
import type { AssetSummary } from "@/lib/decision";
import { GITHUB_URL } from "@/lib/site";

export const dynamic = "force-dynamic";

const THESIS: Record<
    string,
    { outcome: string; outcomeClass: string; takeaway: string; detail: string; fig: string }
> = {
    BENJI: {
        outcome: "Backing verified",
        outcomeClass: "text-green",
        takeaway: "You can check the reserves yourself.",
        detail: "Holdings are filed with the SEC (N-MFP). On-chain supply is reconciled against that filing - so a green here means arithmetic, not a vibe.",
        fig: "FIG. 05 · MATCH",
    },
    OUSG: {
        outcome: "Not verifiable",
        outcomeClass: "text-amber",
        takeaway: "You cannot. I say so out loud.",
        detail: "Reserves sit with a custodian and are not published on-chain or in a public filing I can read. Higher APY does not change that - the answer stays unknown.",
        fig: "FIG. 06 · HOLD",
    },
};

function ThesisCard({ asset }: { asset: AssetSummary }) {
    const t = THESIS[asset.symbol];
    if (!t) return null;
    const matched = asset.backing_flag === "green";
    return (
        <Link
            href={`/a/${encodeURIComponent(asset.asset_id)}`}
            className="group relative flex h-full flex-col border border-white/12 bg-[#050505]/70 p-6 transition-[border-color] duration-150 hover:border-white/28 sm:p-7"
        >
            <span className="pointer-events-none absolute -left-px -top-px h-2.5 w-2.5 border-l border-t border-white/35" />
            <span className="pointer-events-none absolute -right-px -top-px h-2.5 w-2.5 border-r border-t border-white/35" />
            <span className="pointer-events-none absolute -bottom-px -left-px h-2.5 w-2.5 border-b border-l border-white/35" />
            <span className="pointer-events-none absolute -bottom-px -right-px h-2.5 w-2.5 border-b border-r border-white/35" />

            <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-3">
                <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/35">{t.fig}</span>
                <span className={`font-mono text-[11px] uppercase tracking-[0.12em] ${t.outcomeClass}`}>
                    {t.outcome}
                </span>
            </div>

            <div className="mt-5 flex items-baseline gap-3">
                <span className="font-mono text-sm font-semibold text-text">{asset.symbol}</span>
                <span className="truncate text-xs text-text-faint">{asset.name}</span>
            </div>

            <h3 className="font-display mt-4 text-2xl text-text">{t.takeaway}</h3>
            <p className="mt-3 flex-1 text-sm leading-relaxed text-text-muted">{t.detail}</p>

            <span className="mt-6 inline-flex items-center gap-1 font-mono text-[12px] uppercase tracking-[0.12em] text-white/45 transition-colors group-hover:text-primary">
                Inspect {asset.symbol} <span aria-hidden>→</span>
            </span>

            {matched && (
                <span
                    aria-hidden
                    className="pointer-events-none absolute bottom-0 left-0 h-px w-full opacity-40"
                    style={{ background: "linear-gradient(90deg, transparent, var(--green), transparent)" }}
                />
            )}
        </Link>
    );
}

export default async function Home() {
    const universe = await getUniverse();
    const benji = universe.find((a) => a.symbol === "BENJI");
    const ousg = universe.find((a) => a.symbol === "OUSG");

    return (
        <>
            {/* 1 ── Promise */}
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

            {/* 2 ── Why: token ≠ reserve */}
            <section className="relative z-20">
                <YieldExploder />
            </section>

            {/* 3 ── How: arithmetic, not LLM */}
            <section className="relative z-20 overflow-hidden py-16 sm:py-24">
                <div className="mx-auto max-w-6xl px-5">
                    <div className="max-w-xl">
                        <p className="eyebrow text-primary">The engine</p>
                        <h2 className="font-display mt-3 text-3xl text-text sm:text-[2.75rem]">
                            Deterministic reconciliation
                        </h2>
                        <p className="mt-5 text-base leading-relaxed text-text-muted">
                            I never let a language model score an asset. It only parses documents into structured
                            data. Then plain arithmetic runs against on-chain reads, and if the two sides do not
                            match, the verdict drops. No model gets a vote on the color.
                        </p>
                    </div>
                    <div className="mt-12">
                        <ReconciliationScanner />
                    </div>
                </div>
            </section>

            {/* 4 ── Proof: one green, one unknown */}
            {benji && ousg && (
                <section className="relative z-20 border-t border-border py-16 sm:py-24">
                    <div className="mx-auto max-w-6xl px-5">
                        <p className="eyebrow text-primary">Worked example</p>
                        <h2 className="font-display mt-3 max-w-2xl text-3xl text-text sm:text-[2.75rem]">
                            Same question, two answers.
                        </h2>
                        <p className="mt-5 max-w-2xl text-base leading-relaxed text-text-muted">
                            Both are tokenized Treasuries. Only one has a public filing I can reconcile against.
                            That is the whole product: say when proof exists, and when it does not.
                        </p>
                        <div className="mt-10 grid items-stretch gap-6 sm:grid-cols-2">
                            <ThesisCard asset={benji} />
                            <ThesisCard asset={ousg} />
                        </div>
                    </div>
                </section>
            )}

            {/* 5 ── What an agent does with it */}
            <section className="relative z-20 overflow-hidden border-t border-border py-16 sm:py-24">
                <div className="mx-auto max-w-6xl px-5">
                    <div className="ml-auto max-w-xl lg:text-right">
                        <p className="eyebrow text-primary">Agent routing</p>
                        <h2 className="font-display mt-3 text-3xl text-text sm:text-[2.75rem]">
                            Gate execution on verifiable proof.
                        </h2>
                        <p className="mt-5 text-base leading-relaxed text-text-muted">
                            Your agent asks before it moves money. If backing cannot be verified independently,
                            the deposit is held back and the reason is handed back - not a silent failure.
                        </p>
                    </div>
                    <div className="mt-12">
                        <AgentRouter />
                    </div>
                    <div className="mt-16">
                        <p className="eyebrow text-primary">Who asks</p>
                        <h3 className="font-display mt-3 max-w-xl text-2xl text-text sm:text-3xl">
                            Agents, wallets, and ops that move money before a prospectus.
                        </h3>
                        <div className="mt-10">
                            <AudienceCards />
                        </div>
                    </div>
                </div>
            </section>

            {/* 6 ── Primary action: integrate */}
            <section id="integrate" className="relative z-20 scroll-mt-20 border-y border-border bg-bg py-16 sm:py-24">
                <div className="mx-auto max-w-6xl px-5">
                    <p className="eyebrow text-primary">Get started</p>
                    <h2 className="font-display mt-3 max-w-2xl text-3xl text-text sm:text-[2.75rem]">
                        Wire a pre-deposit check in five minutes.
                    </h2>
                    <p className="mt-5 max-w-2xl text-base leading-relaxed text-text-muted">
                        Same <code className="font-mono text-sm text-white/90">AgentVerdict</code> everywhere.
                        Gate on <code className="font-mono text-sm text-white/90">backing.tier</code> and{" "}
                        <code className="font-mono text-sm text-white/90">market_risk</code>, surface{" "}
                        <code className="font-mono text-sm text-white/90">trust_boundary</code> and{" "}
                        <code className="font-mono text-sm text-white/90">caveats</code>.
                    </p>
                    <div className="mt-12">
                        <IntegrationGuide />
                    </div>
                </div>
            </section>

            {/* 7 ── Coverage map (late, honest roadmap) */}
            <section className="relative z-20 py-16 sm:py-24">
                <div className="mx-auto max-w-6xl px-5">
                    <p className="eyebrow text-primary">Coverage</p>
                    <h2 className="font-display mt-3 max-w-2xl text-3xl text-text sm:text-[2.75rem]">
                        One engine for wherever yield comes from.
                    </h2>
                    <p className="mt-5 max-w-2xl text-base leading-relaxed text-text-muted">
                        Backing was the hardest case, so I built it first. Coverage grows where proof is
                        possible - hover a category to see what is live versus still planned.
                    </p>
                    <div className="mt-12">
                        <YieldCoverage />
                    </div>
                </div>
            </section>

            {/* 8 ── Human try-it (explore + lookup, one section) */}
            <section id="explore" className="scroll-mt-20 border-t border-border py-16 sm:py-24">
                <div className="mx-auto max-w-6xl px-5">
                    <p className="eyebrow text-primary">Try it</p>
                    <h2 className="font-display mt-3 max-w-2xl text-3xl text-text sm:text-[2.75rem]">
                        What can you buy from where you sit?
                    </h2>
                    <p className="mt-5 max-w-2xl text-base leading-relaxed text-text-muted">
                        Set your location and size. I list assets you are allowed to buy, sorted by how far the
                        backing proof goes - verified first, higher APY with weaker proof further down.
                    </p>
                    <div className="mt-12">
                        <DecisionExplorer universe={universe} />
                    </div>
                      <div className="mt-16 max-w-xl border-t border-white/10 pt-10">
                        <p className="eyebrow text-primary">Or look one up</p>
                        <h3 className="mt-3 font-mono text-[13px] uppercase tracking-[0.12em] text-text">
                            Contract address or ticker
                        </h3>
                        <div className="mt-5">
                            <SearchBar />
                        </div>
                    </div>
                </div>
            </section>

            {/* 9 ── Close */}
            <section className="relative overflow-hidden border-t border-border py-20 sm:py-32">
                <div className="relative z-10 mx-auto max-w-6xl px-5 text-center">
                    <h2 className="font-display text-4xl leading-[1.05] text-text sm:text-6xl">
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
                            className="inline-flex items-center rounded-md bg-primary px-8 py-4 text-sm font-medium text-primary-contrast transition-colors hover:bg-primary-hover"
                        >
                            Read the integration guide
                        </a>
                        <a
                            href={GITHUB_URL}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center rounded-md border border-white/20 bg-white/5 px-8 py-4 text-sm font-medium text-white backdrop-blur-sm transition-colors hover:border-white/40 hover:bg-white/10"
                        >
                            View source on GitHub
                        </a>
                    </div>
                </div>
            </section>
        </>
    );
}
