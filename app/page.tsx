import Link from "next/link";
import SearchBar from "@/components/SearchBar";
import { allSeeds } from "@/lib/seed/assets";

export default function Home() {
    const seeds = allSeeds();

    return (
        <div className="mx-auto max-w-2xl px-5 py-16 sm:py-24">
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-text">
                Is this tokenized asset what it claims to be?
            </h1>
            <p className="mt-3 text-sm sm:text-base text-text-muted leading-relaxed">
                A transparent, per-dimension reliability read on tokenized real-world assets. Every claim shows its
                source and its confidence. Auto-extracted data never wears the same badge as verified data — and we
                say plainly what we don&apos;t know.
            </p>

            <div className="mt-8">
                <SearchBar autoFocus />
            </div>

            <div className="mt-10">
                <p className="text-xs uppercase tracking-wide text-text-faint">Flagship assets</p>
                <div className="mt-3 flex flex-wrap gap-2">
                    {seeds.map(({ assetId, seed }) => (
                        <Link
                            key={assetId}
                            href={`/a/${encodeURIComponent(assetId)}`}
                            className="rounded-lg border border-border bg-[color:var(--bg-elev)] px-3 py-1.5 text-sm text-text-muted hover:text-text hover:border-[color:var(--verified)] transition-colors"
                        >
                            <span className="font-mono">{seed.identifiers.symbol}</span>
                        </Link>
                    ))}
                </div>
            </div>

            <div className="mt-12 grid gap-3 text-xs text-text-faint">
                <p>
                    Coverage tiers: <span className="text-verified">Verified</span> (human-checked flagship data),{" "}
                    <span className="text-auto">Auto</span> (LLM-extracted + on-chain, verify yourself),{" "}
                    <span className="text-text-muted">Unverifiable</span> (on-chain only, no qualitative sources found).
                </p>
                <p>This tool rates assets on public facts. It is not a rating agency and not financial advice.</p>
            </div>
        </div>
    );
}
