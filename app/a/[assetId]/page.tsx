import Link from "next/link";
import { after } from "next/server";
import { parseAssetId } from "@/lib/chains";
import { getAsset, fillQualitative } from "@/lib/service";
import RiskCard from "@/components/RiskCard";

export const dynamic = "force-dynamic";

function Shell({ children }: { children: React.ReactNode }) {
    return <div className="mx-auto max-w-3xl px-5 py-10 sm:py-14">{children}</div>;
}

function BackLink() {
    return (
        <Link
            href="/"
            className="mb-6 inline-block text-sm text-text-muted transition-colors hover:text-text"
        >
            ← Search another asset
        </Link>
    );
}

export default async function AssetPage({ params }: { params: Promise<{ assetId: string }> }) {
    const { assetId } = await params;
    const decoded = decodeURIComponent(assetId);

    if (!parseAssetId(decoded)) {
        return (
            <Shell>
                <BackLink />
                <div className="panel p-6">
                    <p className="text-sm font-medium text-text">Malformed asset id</p>
                    <p className="mt-1.5 text-sm text-text-muted">
                        Expected the form <span className="font-mono">{`{chainId}:{address}`}</span>.
                    </p>
                </div>
            </Shell>
        );
    }

    const result = await getAsset(decoded);

    if (!result) {
        return (
            <Shell>
                <BackLink />
                <div className="panel p-6">
                    <p className="text-sm font-medium text-text">Doesn&apos;t resolve to a readable asset</p>
                    <p className="mt-1.5 text-sm leading-relaxed text-text-muted">
                        This address doesn&apos;t resolve to a tokenized asset on a supported chain, or on-chain data is
                        unavailable (check that the relevant RPC is configured).
                    </p>
                </div>
            </Shell>
        );
    }

    if (result.needsFill) {
        after(() => fillQualitative(decoded));
    }

    return (
        <Shell>
            <BackLink />
            <RiskCard
                record={result.data.record}
                assessment={result.data.assessment}
                computedAt={result.data.computed_at}
                qualitativePending={result.data.record.qualitative_pending === true}
            />
        </Shell>
    );
}
