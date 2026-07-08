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
                <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-faint" />
                <input
                    autoFocus={autoFocus}
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="Contract address, or ticker (BUIDL, OUSG…)"
                    className="field w-full py-3 pl-10 pr-28 text-sm text-text placeholder:text-text-faint"
                />
                <button
                    type="submit"
                    disabled={loading}
                    className="btn btn-primary absolute right-1.5 top-1/2 -translate-y-1/2 px-4 py-2"
                >
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Analyze"}
                </button>
            </form>

            {error && <p className="mt-3 text-sm text-amber">{error}</p>}

            {candidates && candidates.length > 0 && (
                <ul className="mt-3 divide-y divide-border overflow-hidden rounded-[3px] border border-border bg-bg-elev">
                    {candidates.map((c) => (
                        <li key={c.asset_id}>
                            <button
                                onClick={() => router.push(`/a/${encodeURIComponent(c.asset_id)}`)}
                                className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-bg-elev-2"
                            >
                                <span className="text-sm text-text">
                                    <span className="font-mono font-medium">{c.symbol}</span>
                                    <span className="ml-2 text-text-muted">{c.name}</span>
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
