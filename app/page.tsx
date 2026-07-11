import SearchBar from "@/components/SearchBar";
import DecisionExplorer from "@/components/DecisionExplorer";
import HeroClaim from "@/components/marketing/beats/HeroClaim";
import FalseBinary from "@/components/marketing/beats/FalseBinary";
import YieldExploder from "@/components/marketing/YieldExploder";
import VerificationTerminal from "@/components/marketing/beats/VerificationTerminal";
import SpecimenPair from "@/components/marketing/beats/SpecimenPair";
import IntegrationGuide from "@/components/marketing/IntegrationGuide";
import YieldCoverage from "@/components/marketing/YieldCoverage";
import SuggestionBox from "@/components/marketing/beats/SuggestionBox";
import CloseResolve from "@/components/marketing/beats/CloseResolve";
import Blueprint from "@/components/marketing/chrome/Blueprint";
import { getUniverse } from "@/lib/service";

export const dynamic = "force-dynamic";

export default async function Home() {
    const universe = await getUniverse();

    return (
        <div className="landing">
            {/* 01 · the claim, unresolved */}
            <HeroClaim />

            {/* 02 · a color is not a proof */}
            <FalseBinary />

            {/* 03 · a token is a stack of trust */}
            <section className="relative z-20 border-b border-border bg-bg">
                <YieldExploder />
            </section>

            {/* 04 · we check the receipts, live */}
            <VerificationTerminal />

            {/* 05 · three axes, never a grade */}
            <SpecimenPair />

            {/* 06 · drop it in */}
            <section id="integrate" className="scroll-mt-20 border-t border-border bg-bg py-24 sm:py-32">
                <Blueprint
                    section="06"
                    label="§ DROP IT IN"
                    tag="ONE VERDICT, EVERYWHERE"
                    grid={false}
                    className="mx-auto w-full max-w-6xl px-6 pt-16 pb-4 sm:px-8"
                >
                    <h2 className="font-display max-w-2xl text-[clamp(2.1rem,4.4vw,3.4rem)] leading-[1.03] text-text">
                        One line into your agent, CLI, or a plain HTTP call.
                    </h2>
                    <p className="mt-6 max-w-xl text-[15px] leading-relaxed text-text-muted">
                        The same <span className="text-text">AgentVerdict</span> everywhere. Gate on{" "}
                        <span className="text-text">backing.tier</span>, surface{" "}
                        <span className="text-text">trust_boundary</span> and <span className="text-text">caveats</span>.
                        No API key.
                    </p>
                    <div className="mt-12">
                        <IntegrationGuide />
                    </div>
                </Blueprint>
            </section>

            {/* 07 · try it */}
            <section id="explore" className="scroll-mt-20 border-t border-border bg-bg py-24 sm:py-32">
                <Blueprint
                    section="07"
                    label="§ TRY IT"
                    tag="FROM WHERE YOU SIT"
                    grid={false}
                    className="mx-auto w-full max-w-6xl px-6 pt-16 pb-4 sm:px-8"
                >
                    <h2 className="font-display max-w-2xl text-[clamp(2.1rem,4.4vw,3.4rem)] leading-[1.03] text-text">
                        What can you actually buy, and how far does the proof go?
                    </h2>
                    <p className="mt-6 max-w-xl text-[15px] leading-relaxed text-text-muted">
                        Set your location and size. Assets are sorted by how far the backing proof goes &mdash;
                        verified first, higher APY with weaker proof further down.
                    </p>
                    <div className="mt-12">
                        <DecisionExplorer universe={universe} />
                    </div>
                    <div className="mt-16 max-w-xl border-t border-border pt-10">
                        <p className="label mb-4 text-text-faint">OR LOOK ONE UP</p>
                        <SearchBar />
                    </div>
                </Blueprint>
            </section>

            {/* 08 · coverage */}
            <section className="border-t border-border bg-bg py-24 sm:py-32">
                <Blueprint
                    section="08"
                    label="§ COVERAGE"
                    tag="WHERE PROOF IS POSSIBLE"
                    grid={false}
                    className="mx-auto w-full max-w-6xl px-6 pt-16 pb-4 sm:px-8"
                >
                    <h2 className="font-display max-w-2xl text-[clamp(2.1rem,4.4vw,3.4rem)] leading-[1.03] text-text">
                        One engine for wherever yield comes from.
                    </h2>
                    <p className="mt-6 max-w-xl text-[15px] leading-relaxed text-text-muted">
                        Backing was the hardest case, so it came first. Coverage grows where proof is possible.
                    </p>
                    <div className="mt-12">
                        <YieldCoverage />
                    </div>
                </Blueprint>
            </section>

            {/* 09 · the open box */}
            <SuggestionBox />

            {/* 10 · close */}
            <CloseResolve />
        </div>
    );
}
