import SearchBar from "@/components/SearchBar";
import DecisionExplorer from "@/components/DecisionExplorer";
import { getUniverse } from "@/lib/service";

export const dynamic = "force-dynamic";

export default async function Home() {
    const universe = await getUniverse();

    return (
        <div className="mx-auto max-w-2xl px-5 py-14 sm:py-20">
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-text">
                Yield you can actually reach — and how far the safety really goes.
            </h1>
            <p className="mt-3 text-sm sm:text-base text-text-muted leading-relaxed">
                Tell it where you are and roughly how much you have. It filters tokenized-asset yield down to what
                you can legally touch, ranks it <span className="text-text">safety first</span>, and shows — for
                each — where the trust bottoms out. A list makes yield look free. This prices the risk next to it.
            </p>

            <div className="mt-8">
                <DecisionExplorer universe={universe} />
            </div>

            <div className="mt-12 border-t border-border pt-8">
                <p className="text-xs uppercase tracking-wide text-text-faint">Or look up any asset by address</p>
                <div className="mt-3">
                    <SearchBar />
                </div>
            </div>

            <div className="mt-10 grid gap-3 text-xs text-text-faint">
                <p>
                    Safety read: <span className="text-green">verified</span> means backing is independently proven
                    (a regulator filing or an on-chain reserve read), <span className="text-amber">caution</span>{" "}
                    means partly proven or self-reported, <span className="text-text-muted">unknown</span> means we
                    can&apos;t verify it yet — never a fake green. Yields are approximate; verify at the provider.
                </p>
                <p>Information on public facts, not financial advice. We rate assets, not decisions. We never hold your money.</p>
            </div>
        </div>
    );
}
