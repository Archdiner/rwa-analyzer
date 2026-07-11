import { listDirections } from "@/lib/features/store";

export const dynamic = "force-dynamic";

// Maintainer-only (MAINTAINER_KEY via ?key=). Fails closed when the key is unset
// or wrong. This surfaces synthesized demand; it never triggers a build.
export default async function DemandPage({ searchParams }: { searchParams: Promise<{ key?: string }> }) {
    const { key } = await searchParams;
    const maintainerKey = process.env.MAINTAINER_KEY;

    if (!maintainerKey || key !== maintainerKey) {
        return (
            <div className="mx-auto max-w-2xl px-5 py-16">
                <p className="text-sm text-text-muted">Not available.</p>
            </div>
        );
    }

    const directions = await listDirections();

    return (
        <div className="mx-auto max-w-3xl px-5 py-12 sm:py-16">
            <p className="eyebrow mb-2">Demand</p>
            <h1 className="mb-6 text-2xl font-medium text-text">What people want, synthesized</h1>

            {directions.length === 0 ? (
                <p className="text-sm text-text-muted">No directions yet — run the clustering pass once there are triaged suggestions.</p>
            ) : (
                <ul className="flex flex-col gap-4">
                    {directions.map((d) => (
                        <li key={d.cluster_id} className="panel p-5">
                            <div className="flex items-baseline justify-between gap-3">
                                <h2 className="text-base font-medium text-text">{d.label}</h2>
                                <span className="shrink-0 text-xs text-text-faint">
                                    {d.member_count} suggestion{d.member_count === 1 ? "" : "s"}
                                </span>
                            </div>
                            {d.synthesis && <p className="mt-2 text-sm leading-relaxed text-text-muted">{d.synthesis}</p>}
                        </li>
                    ))}
                </ul>
            )}

            <p className="mt-8 text-xs leading-relaxed text-text-faint">
                Advisory only. Demand counts are influenceable — merit and maintainer judgment decide what gets built,
                never popularity alone.
            </p>
        </div>
    );
}
