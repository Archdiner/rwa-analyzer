"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Loader2 } from "lucide-react";
import type { SearchHit } from "@/lib/store";

type ResolveResult =
    | { kind: "asset_id"; assetId: string }
    | { kind: "candidates"; hits: SearchHit[] }
    | { kind: "none" };

export default function SearchBar({ autoFocus = false }: { autoFocus?: boolean }) {
    const router = useRouter();
    const [q, setQ] = useState("");
    const [loading, setLoading] = useState(false);
    const [candidates, setCandidates] = useState<SearchHit[] | null>(null);
    const [error, setError] = useState<string | null>(null);

    async function submit(e: React.FormEvent) {
        e.preventDefault();
        const query = q.trim();
        if (!query) return;

        setLoading(true);
        setError(null);
        setCandidates(null);

        try {
            const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
            const json = (await res.json()) as { success: boolean; data?: ResolveResult; error?: string };
            if (!json.success || !json.data) {
                setError(json.error ?? "Search failed.");
                return;
            }
            const result = json.data;
            if (result.kind === "asset_id") {
                router.push(`/a/${encodeURIComponent(result.assetId)}`);
            } else if (result.kind === "candidates") {
                setCandidates(result.hits);
            } else {
                setError(
                    "No match. Paste a contract address (0x…) — ticker/name search covers seeded assets only in v1.",
                );
            }
        } catch {
            setError("Network error.");
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="w-full">
            <form onSubmit={submit} className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-text-faint" />
                <input
                    autoFocus={autoFocus}
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="Paste a contract address, or search a ticker (BUIDL, OUSG…)"
                    className="w-full rounded-xl border border-border bg-[color:var(--bg-elev)] py-3.5 pl-11 pr-28 text-sm text-text placeholder:text-text-faint focus:border-[color:var(--verified)] focus:outline-none"
                />
                <button
                    type="submit"
                    disabled={loading}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg bg-[color:var(--verified)] px-4 py-2 text-sm font-medium text-[color:var(--bg)] disabled:opacity-60"
                >
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Analyze"}
                </button>
            </form>

            {error && <p className="mt-3 text-sm text-amber">{error}</p>}

            {candidates && candidates.length > 0 && (
                <ul className="mt-3 divide-y divide-[color:var(--border)] rounded-xl border border-border bg-[color:var(--bg-elev)]">
                    {candidates.map((c) => (
                        <li key={c.asset_id}>
                            <button
                                onClick={() => router.push(`/a/${encodeURIComponent(c.asset_id)}`)}
                                className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-[color:var(--bg-elev-2)]"
                            >
                                <span className="text-sm text-text">
                                    <span className="font-mono">{c.symbol}</span> · {c.name}
                                </span>
                                <span className="text-xs text-text-faint">{c.issuer_name}</span>
                            </button>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
