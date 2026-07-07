import Link from "next/link";
import { after } from "next/server";
import { parseAssetId } from "@/lib/chains";
import { getAsset, fillQualitative } from "@/lib/service";
import RiskCard from "@/components/RiskCard";

export const dynamic = "force-dynamic";

function Shell({ children }: { children: React.ReactNode }) {
    return <div className="mx-auto max-w-2xl px-5 py-10">{children}</div>;
}

export default async function AssetPage({ params }: { params: Promise<{ assetId: string }> }) {
    const { assetId } = await params;
    const decoded = decodeURIComponent(assetId);

    if (!parseAssetId(decoded)) {
        return (
            <Shell>
                <p className="text-sm text-amber">Malformed asset id. Expected the form {`{chainId}:{address}`}.</p>
                <Link href="/" className="mt-4 inline-block text-sm text-verified hover:underline">
                    ← Back to search
                </Link>
            </Shell>
        );
    }

    const result = await getAsset(decoded);

    if (!result) {
        return (
            <Shell>
                <p className="text-sm text-text-muted">
                    This address doesn&apos;t resolve to a readable tokenized asset on a supported chain, or on-chain
                    data is unavailable (check that the relevant RPC is configured).
                </p>
                <Link href="/" className="mt-4 inline-block text-sm text-verified hover:underline">
                    ← Back to search
                </Link>
            </Shell>
        );
    }

    if (result.needsFill) {
        after(() => fillQualitative(decoded));
    }

    return (
        <Shell>
            <Link href="/" className="mb-5 inline-block text-sm text-text-faint hover:text-text">
                ← Search another asset
            </Link>
            <RiskCard
                record={result.data.record}
                assessment={result.data.assessment}
                computedAt={result.data.computed_at}
                qualitativePending={result.data.record.qualitative_pending === true}
            />
        </Shell>
    );
}
